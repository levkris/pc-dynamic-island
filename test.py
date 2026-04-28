import asyncio
import websockets
import json

async def listen():
    uri = "ws://localhost:8765"
    async with websockets.connect(uri) as websocket:
        print("Connected to assistant server")
        while True:
            try:
                message = await websocket.recv()
                data = json.loads(message)
                event = data.get("event")
                payload = data.get("data")
                print(f"[{event}] {payload}")
            except Exception as e:
                print("Error:", e)
                break

asyncio.run(listen())
