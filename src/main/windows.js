const { BrowserWindow, screen } = require('electron')
const path = require('path')
const fs = require('fs')

const ISLAND_WIDTH = 400
const ISLAND_HEIGHT = 140
const PEEK_HEIGHT = 4

let aiWindow = null
let animationInterval = null

function createIslandWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize

    const win = new BrowserWindow({
        width: ISLAND_WIDTH,
        height: ISLAND_HEIGHT,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        hasShadow: false,
        x: Math.round((width - ISLAND_WIDTH) / 2),
        y: -(ISLAND_HEIGHT - PEEK_HEIGHT),
        alwaysOnTop: true,
        resizable: false,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    win.loadFile(path.join(__dirname, '../renderer/island/index.html'))

    const watchFiles = [
        path.join(__dirname, '../renderer/island/index.html'),
        path.join(__dirname, '../renderer/island/renderer.js'),
        path.join(__dirname, '../../assets/styles/island.css'),
    ]

    watchFiles.forEach(p => {
        if (fs.existsSync(p)) {
            fs.watch(p, () => { if (!win.isDestroyed()) win.reload() })
        }
    })

    return win
}

function animateTo(win, targetY) {
    if (!win) return
    if (animationInterval) clearInterval(animationInterval)

    const bounds = win.getBounds()
    const startY = bounds.y
    const distance = targetY - startY
    const duration = 150
    const startTime = Date.now()

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    }

    function step() {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        win.setBounds({ ...bounds, y: Math.round(startY + distance * easeInOutQuad(progress)) })

        if (progress < 1) {
            animationInterval = setImmediate(step)
        } else {
            win.setBounds({ ...bounds, y: targetY })
            animationInterval = null
        }
    }

    step()
}

function slideDown(win) {
    animateTo(win, 0)
}

function slideUp(win) {
    if (!win) return
    animateTo(win, -(ISLAND_HEIGHT - PEEK_HEIGHT))
}

function openAiWindow() {
    if (aiWindow) {
        aiWindow.focus()
        return
    }

    aiWindow = new BrowserWindow({
        fullscreen: true,
        autoHideMenuBar: true,
        frame: false,
        transparent: true,
        skipTaskbar: true,
        hasShadow: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    aiWindow.loadFile(path.join(__dirname, '../renderer/ai/index.html'))

    aiWindow.on('blur', () => {
        if (aiWindow && !aiWindow.webContents.isDevToolsOpened()) {
            aiWindow.webContents.send('fadeout')
            setTimeout(() => { if (aiWindow) aiWindow.close() }, 300)
        }
    })

    aiWindow.on('closed', () => { aiWindow = null })
}

function closeAiWindow() {
    if (!aiWindow) return
    aiWindow.webContents.send('fadeout')
    setTimeout(() => {
        if (aiWindow) { aiWindow.close(); aiWindow = null }
    }, 300)
}

function expandIsland(win) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    win.setBounds({ x: 0, y: 0, width, height })
    win.webContents.send('set-mode', 'expanded')
}

function collapseIsland(win) {
    win.webContents.send('set-mode', 'island')
    setTimeout(() => {
        const { width } = screen.getPrimaryDisplay().workAreaSize
        win.setBounds({
            x: Math.round((width - ISLAND_WIDTH) / 2),
            y: -(ISLAND_HEIGHT - PEEK_HEIGHT),
            width: ISLAND_WIDTH,
            height: ISLAND_HEIGHT
        })
    }, 510)
}

module.exports = { createIslandWindow, openAiWindow, closeAiWindow, slideDown, slideUp, expandIsland, collapseIsland }