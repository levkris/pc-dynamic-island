const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const robot = require('robotjs')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))
const { openAiWindow, closeAiWindow, slideDown, slideUp, expandIsland, collapseIsland } = require('./windows')

const AI_MODEL = 'llama3.2'
const PROMPTS_PATH = path.join(__dirname, '../../data/prompts.json')

function loadPrompts() {
    try {
        return JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'))
    } catch {
        return []
    }
}

function savePrompt(entry) {
    const prompts = loadPrompts()
    prompts.push(entry)
    fs.mkdirSync(path.dirname(PROMPTS_PATH), { recursive: true })
    fs.writeFileSync(PROMPTS_PATH, JSON.stringify(prompts, null, 2), 'utf8')
}

let usingExpandedApp = false

function registerIpcHandlers(win) {
    ipcMain.on('slide-down', () => { if (!usingExpandedApp) slideDown(win) })
    ipcMain.on('slide-up', () => { if (!usingExpandedApp) slideUp(win) })

    ipcMain.on('toggle-playback', () => { try { robot.keyTap('audio_play') } catch {} })
    ipcMain.on('previous-track', () => { try { robot.keyTap('audio_prev') } catch {} })
    ipcMain.on('next-track', () => { try { robot.keyTap('audio_next') } catch {} })

    ipcMain.on('open-ai', () => openAiWindow())
    ipcMain.on('close-ai', () => closeAiWindow())

    ipcMain.on('expand-to-app', () => {
        usingExpandedApp = true
        expandIsland(win)
    })

    ipcMain.on('collapse-to-island', () => {
        usingExpandedApp = false
        collapseIsland(win)
    })

    ipcMain.on('ai-prompt', async (event, prompt) => {
        const systemPrompt = `You are DynAI, a helpful and friendly assistant. Keep responses short and casual.
Math: always show the formula and give the answer. Only explain steps if asked. Say "I don't know" if unsure.
Current date/time: ${new Date().toLocaleString()}, ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}.`

        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: AI_MODEL,
                    prompt: `${systemPrompt}\n\nUser: ${prompt}\nDynAI:`,
                    stream: true
                })
            })

            if (!response.ok) throw new Error(`Ollama error: ${response.status}`)

            let fullText = ''
            const decoder = new TextDecoder()

            for await (const chunk of response.body) {
                const lines = decoder.decode(chunk, { stream: true }).split('\n').filter(Boolean)
                for (const line of lines) {
                    try {
                        const obj = JSON.parse(line)
                        if (obj.response) {
                            fullText += obj.response
                            event.sender.send('ai-stream', obj.response)
                        }
                        if (obj.done) {
                            event.sender.send('ai-done', { response: fullText })
                            savePrompt({ prompt, answer: fullText, timestamp: new Date().toISOString() })
                        }
                    } catch {}
                }
            }
        } catch (err) {
            event.sender.send('ai-done', { error: err.message })
        }
    })
}

module.exports = { registerIpcHandlers }