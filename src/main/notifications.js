const { spawn } = require('child_process')
const path = require('path')
const readline = require('readline')

const BRIDGE_PATH = path.join(
    __dirname,
    '../../native/notification_bridge/build/Release/notification_bridge.exe'
)

let bridgeProcess = null
let onNotificationCallback = null

function startNotificationBridge(onNotification) {
    if (bridgeProcess) return

    onNotificationCallback = onNotification

    try {
        bridgeProcess = spawn(BRIDGE_PATH, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        })
    } catch {
        console.error('[notifications] Failed to spawn notification_bridge, build it first.')
        return
    }

    const stdout = readline.createInterface({ input: bridgeProcess.stdout })
    const stderr = readline.createInterface({ input: bridgeProcess.stderr })

    stdout.on('line', (line) => {
        if (!line.trim()) return
        try {
            const notification = JSON.parse(line)
            if (typeof onNotificationCallback === 'function') {
                onNotificationCallback(notification)
            }
        } catch {
            console.warn('[notifications] Unparseable line:', line)
        }
    })

    stderr.on('line', (line) => {
        if (!line.trim()) return
        try {
            const msg = JSON.parse(line)
            if (msg.error) console.error('[notifications] Bridge error:', msg.error)
            else if (msg.status) console.log('[notifications] Bridge status:', msg.status)
        } catch {
            console.log('[notifications]', line)
        }
    })

    bridgeProcess.on('error', (err) => {
        console.error('[notifications] Process error:', err.message)
        bridgeProcess = null
    })

    bridgeProcess.on('exit', (code, signal) => {
        console.log(`[notifications] Bridge exited (code=${code}, signal=${signal})`)
        bridgeProcess = null
    })
}

function stopNotificationBridge() {
    if (!bridgeProcess) return
    bridgeProcess.kill('SIGTERM')
    bridgeProcess = null
}

module.exports = { startNotificationBridge, stopNotificationBridge }