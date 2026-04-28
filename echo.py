import asyncio
import json
import numpy as np
import simpleaudio as sa
import speech_recognition as sr
import websockets
from ollama import chat
from TTS.api import TTS
import threading
import queue
import time
import re
from datetime import datetime
from tools.time import get_time, get_date
from tools.conversation import start_conversation, end_conversation

r = sr.Recognizer()
conversation_mode = False
tts = TTS(model_name="tts_models/en/vctk/vits")
assistant_name = "echo"

with open("instructions.json") as f:
    instructions = json.load(f)

connected_clients = set()
current_playback = None

audio_queue = queue.Queue()

def audio_callback(recognizer, audio):
    audio_queue.put(audio)
    
async def broadcast(event_type, data):
    message = json.dumps({"event": event_type, "data": data})
    if connected_clients:
        await asyncio.wait([asyncio.create_task(client.send(message)) for client in connected_clients])

def format_time_for_speech(text):
    def repl(match):
        hour = int(match.group(1))
        minute = int(match.group(2))
        suffix = "AM"
        if hour >= 12:
            suffix = "PM"
            if hour > 12:
                hour -= 12
        elif hour == 0:
            hour = 12
        hour_words = number_to_words(hour)
        return f"{hour_words} {minute:02d} {suffix}"

    pattern = r'(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*\d{1,2})?'
    return re.sub(pattern, repl, text)

def number_to_words(n):
    words = ["twelve","one","two","three","four","five","six","seven","eight","nine","ten","eleven"]
    return words[n % 12]

def speak_worker(text_queue, speed=2):
    global current_playback
    while True:
        text = text_queue.get()
        if text is None:
            break
        if current_playback:
            current_playback.stop()
        audio = tts.tts(text, speaker="p229", speed=speed)
        if isinstance(audio, list):
            audio = np.concatenate([np.array(a).reshape(-1) if np.array(a).ndim == 0 else np.array(a) for a in audio])
        else:
            audio = np.array(audio).reshape(-1) if audio.ndim == 0 else np.array(audio)
        audio = (audio * 32767).astype(np.int16)
        current_playback = sa.play_buffer(audio, 1, 2, 22050)
        current_playback.wait_done()
        current_playback = None

def generate_response_stream(prompt, loop):
    instruction_template = instructions.get("instructions", "")
    messages = [{"role": "system", "content": instruction_template}, {"role": "user", "content": prompt}]

    buffer = ''
    text_queue = queue.Queue()
    threading.Thread(target=speak_worker, args=(text_queue,), daemon=True).start()

    PREBUFFER_SIZE = 40
    PREBUFFER_DELAY = 10

    while True:
        stream = chat(
            model="llama3.1:8b-instruct-q4_0",
            messages=messages,
            tools=[get_time, get_date, start_conversation, end_conversation],
            stream=True
        )

        content = ''
        tool_calls = []

        for chunk in stream:
            if chunk.message.content:
                buffer += chunk.message.content
                asyncio.run_coroutine_threadsafe(
                    broadcast("response_stream_part", chunk.message.content), loop
                )

                if len(buffer) >= PREBUFFER_SIZE:
                    punctuation_pos = [pos for pos in (buffer.rfind('.'), buffer.rfind('!'), buffer.rfind('?')) if pos >= PREBUFFER_SIZE]
                    if punctuation_pos:
                        split_pos = max(punctuation_pos) + 1
                        text_to_speak = buffer[:split_pos]
                        buffer = buffer[split_pos:].lstrip()
                    else:
                        text_to_speak = buffer
                        buffer = ''

                    time.sleep(PREBUFFER_DELAY)
                    text_to_speak = format_time_for_speech(text_to_speak)
                    text_queue.put(text_to_speak)
                    content += text_to_speak

            if chunk.message.tool_calls:
                tool_calls.extend(chunk.message.tool_calls)
                for call in chunk.message.tool_calls:
                    asyncio.run_coroutine_threadsafe(
                        broadcast("response_stream_part", str(call)), loop
                    )
                    
        if buffer:
            text_to_speak = format_time_for_speech(buffer)
            text_queue.put(text_to_speak)
            content += text_to_speak
            buffer = ''

        if content or tool_calls:
            messages.append({'role': 'assistant', 'content': content, 'tool_calls': tool_calls})

        if not tool_calls:
            break

        for call in tool_calls:
            if call.function.name == 'get_time':
                result = get_time(**call.function.arguments)
            elif call.function.name == 'get_date':
                result = get_date(**call.function.arguments)
            elif call.function.name == 'start_conversation':
                result = start_conversation(**call.function.arguments)
            elif call.function.name == 'end_conversation':
                result = end_conversation(**call.function.arguments)
            else:
                result = 'Unknown tool'
            messages.append({'role': 'tool', 'tool_name': call.function.name, 'content': str(result)})

    text_queue.put(None)
    return True

def assistant_loop_threadsafe(loop):
    global conversation_mode, current_playback

    mic = sr.Microphone()
    with mic as source:
        r.adjust_for_ambient_noise(source)

    asyncio.run_coroutine_threadsafe(broadcast("listening", "Microphone ready"), loop)

    while True:
        with sr.Microphone() as source:
            if conversation_mode:
                asyncio.run_coroutine_threadsafe(broadcast("listening", "Listening..."), loop)
            
            try:
                audio = r.listen(source)
                text = r.recognize_google(audio, language="en-US")
                
                if text:
                    asyncio.run_coroutine_threadsafe(broadcast("transcribed", text), loop)

                    if assistant_name in text.lower() or conversation_mode:
                        asyncio.run_coroutine_threadsafe(broadcast("generating", True), loop)
                        stream_done = generate_response_stream(text, loop)
                        while not stream_done:
                            time.sleep(0.1)
                        asyncio.run_coroutine_threadsafe(broadcast("generating", False), loop)

            except sr.UnknownValueError:
                pass
            except Exception as e:
                asyncio.run_coroutine_threadsafe(broadcast("error", str(e)), loop)

async def handler(websocket):
    connected_clients.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.remove(websocket)

async def main():
    server = await websockets.serve(handler, "0.0.0.0", 8765)
    print("Server started on ws://0.0.0.0:8765")
    
    loop = asyncio.get_running_loop()
    import threading
    threading.Thread(target=assistant_loop_threadsafe, args=(loop,), daemon=True).start()
    
    await asyncio.Future()
    
asyncio.run(main())
