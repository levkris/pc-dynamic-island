const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
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

    if (!fs.existsSync(BRIDGE_PATH)) {
        console.error('[notifications] Bridge executable not found at:', BRIDGE_PATH)
        console.error('[notifications] Build it with: cd native/notification_bridge && cmake -B build -G "Visual Studio 17 2022" -A x64 && cmake --build build --config Release')
        return
    }

    console.log('[notifications] Starting bridge:', BRIDGE_PATH)

    try {
        bridgeProcess = spawn(BRIDGE_PATH, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        })
    } catch (err) {
        console.error('[notifications] Failed to spawn bridge:', err.message)
        return
    }

    console.log('[notifications] Bridge spawned, PID:', bridgeProcess.pid)

    const stdout = readline.createInterface({ input: bridgeProcess.stdout })
    const stderr = readline.createInterface({ input: bridgeProcess.stderr })

    stdout.on('line', (line) => {
        if (!line.trim()) return
        try {
            const notification = JSON.parse(line)
            console.log('[notifications] Received:', JSON.stringify(notification))
            if (typeof onNotificationCallback === 'function') {
                onNotificationCallback(notification)
            }
        } catch {
            console.warn('[notifications] Unparseable stdout line:', line)
        }
    })

    stderr.on('line', (line) => {
        if (!line.trim()) return
        try {
            const msg = JSON.parse(line)
            if (msg.error) console.error('[notifications] Bridge error:', msg.error)
            else if (msg.status) console.log('[notifications] Bridge status:', msg.status)
        } catch {
            console.log('[notifications] stderr:', line)
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
    console.log('[notifications] Stopping bridge')
    bridgeProcess.kill('SIGTERM')
    bridgeProcess = null
}

module.exports = { startNotificationBridge, stopNotificationBridge }