const { app, BrowserWindow, globalShortcut } = require('electron')
const { createIslandWindow, openAiWindow } = require('./windows')
const { registerIpcHandlers } = require('./ipc')
const { startNotificationBridge, stopNotificationBridge } = require('./notifications')

let islandWindow = null

app.whenReady().then(() => {
    islandWindow = createIslandWindow()
    registerIpcHandlers(islandWindow)

    globalShortcut.register('Alt+Enter', () => openAiWindow())

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            islandWindow = createIslandWindow()
            registerIpcHandlers(islandWindow)
        }
    })
    startNotificationBridge((notif) => {
        if (notif.kind === 'added') islandWindow.webContents.send('notification', notif)
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    stopNotificationBridge()
})