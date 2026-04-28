const { BrowserWindow } = require('electron')
const path = require('path')

let devWindow = null
const logBuffer = []
const MAX_BUFFER = 1000

function addEntry(level, args) {
    const entry = {
        level,
        time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        message: args.map(a => {
            if (a instanceof Error) return a.stack || a.message
            if (typeof a === 'object' && a !== null) {
                try { return JSON.stringify(a, null, 2) } catch { return String(a) }
            }
            return String(a)
        }).join(' ')
    }
    logBuffer.push(entry)
    if (logBuffer.length > MAX_BUFFER) logBuffer.shift()
    if (devWindow && !devWindow.isDestroyed()) {
        devWindow.webContents.send('log-entry', entry)
    }
}

function patchConsole() {
    const orig = {
        log:   console.log.bind(console),
        warn:  console.warn.bind(console),
        error: console.error.bind(console),
        info:  console.info.bind(console),
    }
    console.log   = (...a) => { orig.log(...a);   addEntry('log',   a) }
    console.warn  = (...a) => { orig.warn(...a);  addEntry('warn',  a) }
    console.error = (...a) => { orig.error(...a); addEntry('error', a) }
    console.info  = (...a) => { orig.info(...a);  addEntry('info',  a) }
}

function toggleDevConsole() {
    if (devWindow && !devWindow.isDestroyed()) {
        devWindow.focus()
        return
    }

    devWindow = new BrowserWindow({
        width: 760,
        height: 520,
        minWidth: 500,
        minHeight: 300,
        title: 'Dev Console',
        autoHideMenuBar: true,
        backgroundColor: '#0d0d0d',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    devWindow.loadFile(path.join(__dirname, '../renderer/devConsole/index.html'))

    devWindow.webContents.on('did-finish-load', () => {
        if (!devWindow.isDestroyed()) {
            devWindow.webContents.send('log-init', logBuffer)
        }
    })

    devWindow.on('closed', () => { devWindow = null })
}

module.exports = { patchConsole, toggleDevConsole, addEntry }