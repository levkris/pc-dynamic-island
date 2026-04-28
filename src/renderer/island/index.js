const { ipcRenderer } = require('electron')
const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor')

const monitor = new SMTCMonitor()

let hovering = false
let expanded = false
let page = 1
let isPlaying = false
let currentUrl = null
let lastSongName = ''
let lastProgress = -1
let currentPosition = 0
let currentDuration = 0
let playbackStatus = 0
let lastPlaybackStatus = 0

const el = {
    playIcon:    document.getElementById('play-icon'),
    songTitle:   document.getElementById('song-title'),
    songArtist:  document.getElementById('song-artist'),
    songSmall:   document.getElementById('song-small'),
    songImage:   document.getElementById('song-image'),
    progress:    document.getElementById('progress'),
    songTime:    document.getElementById('song-time'),
    songDur:     document.getElementById('song-duration'),
    clock:       document.getElementById('current-time'),
    page1:       document.getElementById('page-1'),
    page2:       document.getElementById('page-2'),
    pageUi1:     document.getElementById('page-ui-1'),
    pageUi2:     document.getElementById('page-ui-2'),
}

function formatTime(sec) {
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

function setPlayIcon(playing) {
    el.playIcon.src = playing
        ? '../../assets/icons/pause.svg'
        : '../../assets/icons/play.svg'
}

function updateClock() {
    el.clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function updateActivePage() {
    el.page1.classList.toggle('active', page === 1)
    el.page2.classList.toggle('active', page === 2)
    el.pageUi1.style.display = page === 1 ? 'flex' : 'none'
    el.pageUi2.style.display = page === 2 ? 'flex' : 'none'
}

function showPage(n) {
    page = Math.max(1, Math.min(2, n))
    updateActivePage()
}

function triggerAutoSlide(delay = 4000) {
    if (hovering || expanded) return
    ipcRenderer.send('slide-down')
    showPage(2)
    setTimeout(() => {
        if (!hovering) {
            ipcRenderer.send('slide-up')
            showPage(1)
        }
    }, delay)
}

function checkPlaybackStatus() {
    const sessions = monitor._mediaSessions
    if (!sessions.size) return

    const entry = sessions.entries().next().value
    if (!entry) return

    playbackStatus = entry[1].playback.playbackStatus
    isPlaying = Number(playbackStatus) === 4

    if (playbackStatus !== lastPlaybackStatus) {
        lastPlaybackStatus = playbackStatus
        triggerAutoSlide(2000)
    }

    setPlayIcon(isPlaying)
}

function fetchMediaInfo() {
    const sessions = monitor._mediaSessions

    if (!sessions.size) {
        el.songTitle.textContent = 'No song playing'
        el.songArtist.textContent = ''
        el.songSmall.innerHTML = '<span></span>'
        el.songImage.src = '../../assets/icons/music_note.svg'
        el.songTime.textContent = '00:00'
        el.songDur.textContent = '00:00'
        el.progress.style.width = '0%'
        if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl = null }
        return
    }

    const [appName, session] = sessions.entries().next().value
    const { title, artist, thumbnail } = session.media
    const { position, duration } = session.timeline

    if (title !== lastSongName) {
        lastSongName = title
        currentPosition = position
        currentDuration = duration

        const appColors = { 'Spotify.exe': '#1db954', 'Chrome': '#4285f4' }
        if (appColors[appName]) el.progress.style.backgroundColor = appColors[appName]

        el.songTitle.textContent = title
        el.songArtist.textContent = artist
        el.songSmall.innerHTML = `<span>${title} — ${artist}</span>`

        if (thumbnail) {
            const url = URL.createObjectURL(new Blob([thumbnail], { type: 'image/png' }))
            el.songImage.src = url
            if (currentUrl) URL.revokeObjectURL(currentUrl)
            currentUrl = url
        }
    } else {
        if (position < currentPosition - 1) currentPosition = position
        currentDuration = duration
    }
}

function updateProgress() {
    if (isPlaying) currentPosition += 1

    const pct = currentDuration > 0 ? Math.floor((currentPosition / currentDuration) * 100) : 0
    if (pct !== lastProgress) {
        el.progress.style.width = `${pct}%`
        lastProgress = pct
    }

    el.songTime.textContent = formatTime(currentPosition)
    el.songDur.textContent = formatTime(currentDuration)
}

document.body.addEventListener('mouseenter', () => {
    hovering = true
    if (!expanded) ipcRenderer.send('slide-down')
})

document.body.addEventListener('mouseleave', () => {
    hovering = false
    if (!expanded) ipcRenderer.send('slide-up')
})

document.getElementById('play-button').addEventListener('click', () => {
    ipcRenderer.send('toggle-playback')
    isPlaying = !isPlaying
    setPlayIcon(isPlaying)
})

document.getElementById('prev-button').addEventListener('click', () => ipcRenderer.send('previous-track'))
document.getElementById('next-button').addEventListener('click', () => ipcRenderer.send('next-track'))

el.page1.addEventListener('click', () => showPage(1))
el.page2.addEventListener('click', () => showPage(2))

document.getElementById('app-2').addEventListener('click', () => {
    ipcRenderer.send('open-ai')
    ipcRenderer.send('slide-up')
})

document.getElementById('collapse-to-island').addEventListener('click', () => ipcRenderer.send('collapse-to-island'))
document.getElementById('expand-to-app').addEventListener('click', () => ipcRenderer.send('expand-to-app'))

document.addEventListener('keydown', ({ key }) => {
    if (key === 'ArrowLeft') showPage(page - 1)
    else if (key === 'ArrowRight') showPage(page + 1)
})

ipcRenderer.on('set-mode', (_, mode) => {
    document.body.classList.remove('expanded', 'island')
    document.body.classList.add(mode)
    expanded = mode === 'expanded'
})

updateClock()
fetchMediaInfo()
updateProgress()
checkPlaybackStatus()
updateActivePage()

setInterval(updateClock, 1000)
setInterval(updateProgress, 1000)
setInterval(checkPlaybackStatus, 1000)
setInterval(fetchMediaInfo, 4000)