const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, screen, ipcMain, systemPreferences, globalShortcut } = require('electron');
const robot = require('robotjs');
const findProcess = require("find-process");
const { getIcon } = require("extract-file-icon");
const { spawn, exec } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
let win
let animationInterval
let usingExpandedApp = false
let oldWin

const enableAi = true
const aiModel = 'llama3.2'

function createWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize
    const windowWidth = 400
    const windowHeight = 140
    win = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        hasShadow: false,
        x: Math.round((width - windowWidth) / 2),
        y: Math.round(1 - windowHeight),
        alwaysOnTop: true,
        resizable: false,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    win.loadFile('index.html')   

    const htmlPath = path.join(__dirname, 'index.html')
    fs.watch(htmlPath, () => {
        if (!win.isDestroyed()) win.reload()
    })

    const cssPath = path.join(__dirname, 'assets', 'styles', 'main.css')
    fs.watch(cssPath, () => {
        if (!win.isDestroyed()) win.reload()
    })

    const jsPath = path.join(__dirname, 'renderer.js')
    fs.watch(jsPath, () => {
        if (!win.isDestroyed()) win.reload()
    })
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
function animateTo(targetY) {
    if (!win) return
    if (animationInterval) clearInterval(animationInterval)

    const shouldAnimate = process.platform === 'win32'
        ? systemPreferences.getAnimationSettings().shouldRenderRichAnimation
        : true

    const bounds = win.getBounds()
    const startY = bounds.y
    const distance = targetY - startY
    const duration = 150
    let startTime = Date.now()

    if (!shouldAnimate) {
        win.setBounds({ ...bounds, y: targetY })
        return
    }

    function easeInOutQuad(t) {
        return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t
    }

    function step() {
        const now = Date.now()
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = easeInOutQuad(progress)
        const newY = Math.round(startY + distance * eased)
        win.setBounds({ ...bounds, y: newY })

        if (progress < 1) {
            animationInterval = setImmediate(step)
        } else {
            win.setBounds({ ...bounds, y: targetY })
            animationInterval = null
        }
    }

    step()
}

ipcMain.on('slide-down', () => {
    if (usingExpandedApp === true) return
    animateTo(0)
})

ipcMain.on('slide-up', () => {
    if (usingExpandedApp === true) return
    if (!win) return
    const bounds = win.getBounds()
    animateTo(1 - bounds.height)
})


ipcMain.on('toggle-playback', () => {
    try { robot.keyTap('audio_play'); } catch {}
});
ipcMain.on('previous-track', () => {
    try { robot.keyTap('audio_prev'); } catch {}
});
ipcMain.on('next-track', () => {
    try { robot.keyTap('audio_next'); } catch {}
});

let aiWindow = null

app.on('ready', () => {
	globalShortcut.register('Alt+Enter', () => {
        openAiWindow()
	})
})

function openAiWindow() {
    if (aiWindow) return
    if (!enableAi) return

    aiWindow = new BrowserWindow({
        fullscreen: true,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        hasShadow: false,
        alwaysOnTop: true,
        resizable: false,
        animate: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    aiWindow.loadFile('ai_prompt.html')

    aiWindow.on('blur', () => {
        if (!aiWindow.webContents.isDevToolsOpened()) {
            aiWindow.webContents.send('fadeout')
            setTimeout(() => {
                aiWindow.close() 
            }, 300)
        }
    })

    aiWindow.on('closed', () => {
        aiWindow = null
    })
}

ipcMain.on('open-ai', () => {
    openAiWindow()
})

app.on('will-quit', () => {
	globalShortcut.unregisterAll()
})

ipcMain.on('close-ai', () => {
    if (aiWindow) {
        aiWindow.webContents.send('fadeout')
        setTimeout(() => {
            aiWindow.close() 
            aiWindow = null
        }, 300)
    }
})

ipcMain.on('ai-prompt', async (event, prompt) => {
    if (aiWindow && enableAi) {
        try {
            const personalityPrompt = `Respond in a simple, friendly, and concise way. Your name is DynAI. Your job is to answer questions, explain concepts, and give helpful advice. Keep answers casual and short. 

            Math rules: always repeat the formula or question and give the answer. Only explain steps if the user asks. If you don’t know the answer, say "I don't know". Never make up answers.  

            Current date and time: ${new Date().toLocaleString()}, today’s day name: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}.  

            You must reply to any topic the user asks about.  

            User: ${prompt}
            AI:`;

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: aiModel,
                    prompt: personalityPrompt,
                    max_tokens: 150
                })
            });

            const textData = await response.text();
            const jsonChunks = textData.match(/\{.*?\}/g) || [];
            let finalText = '';

            for (const chunk of jsonChunks) {
                try {
                    const obj = JSON.parse(chunk);
                    if (obj.response) finalText += obj.response;
                    if (obj.done) break;
                } catch (err) {
                    console.error('Failed to parse chunk:', chunk, err);
                }
            }

            finalText = finalText.trim();
            event.reply('ai-response', { response: finalText });

            const filePath = path.join(__dirname, 'prompts.json');
            let prompts = [];

            if (fs.existsSync(filePath)) {
                try {
                    const existing = fs.readFileSync(filePath, 'utf8');
                    prompts = JSON.parse(existing);
                } catch (err) {
                    console.error('Failed to read existing prompts.json, starting fresh.', err);
                }
            }

            const timestamp = new Date().toISOString();
            prompts.push({ prompt, answer: finalText, timestamp });

            try {
                fs.writeFileSync(filePath, JSON.stringify(prompts, null, 2), 'utf8');
            } catch (err) {
                console.error('Failed to write prompts.json:', err);
            }

        } catch (err) {
            event.reply('ai-response', { error: err.message });
        }
    }
});

ipcMain.on('expand-to-app', () => {
    if (!win) return
    usingExpandedApp = true

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    win.setBounds({ x: 0, y: 0, width: screenWidth, height: screenHeight })
    win.webContents.send('set-mode', 'expanded')
})

ipcMain.on('collapse-to-island', () => {
    if (!win) return
    usingExpandedApp = false

    win.webContents.send('set-mode', 'island')

    setTimeout(() => {
        const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize
        const windowWidth = 400
        const windowHeight = 140
        const x = Math.round((screenWidth - windowWidth) / 2)
        const y = 0

        win.setBounds({ x, y, width: windowWidth, height: windowHeight })
    }, 510)
})
