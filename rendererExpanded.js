const { ipcRenderer } = require('electron')
const path = require('path')
const extractIcon = require('extract-file-icon')
const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');
const { stringify } = require('querystring');

function getAppIcon(exePath) {
    const iconBuffer = extractIcon(exePath)
    if (!iconBuffer) return null
    const blob = new Blob([iconBuffer], { type: 'image/png' })
    return URL.createObjectURL(blob)
}

let hovering = false
let page = 1

document.body.addEventListener('mouseenter', () => {
    hovering = true
    ipcRenderer.send('slide-down')
})

document.body.addEventListener('mouseleave', () => {
    hovering = false
    ipcRenderer.send('slide-up')
})

let isShowingMessage = false

const monitor = new SMTCMonitor();
let currentUrl = null;
let lastSongName = '';
let lastProgress = -1;

let currentPosition = 0;
let currentDuration = 0;
let playbackStatus = 0;
let lastPlaybackStatus = 0;

const playIcon = document.getElementById('play-icon');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const songSmall = document.getElementById('song-small');
const songImage = document.getElementById('song-image');
const progressBar = document.getElementById('progress');
const songTime = document.getElementById('song-time');
const songDuration = document.getElementById('song-duration');

function formatTime(sec) {
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}

function triggerSlide(closeDelay = 4000) {
    if (!hovering && !isShowingMessage) {
        ipcRenderer.send('slide-down', lastSongName);
        page = 2;
        updateActivePage();
        setTimeout(() => {
            if (!hovering) {
                ipcRenderer.send('slide-up');
                page = 1;
                updateActivePage();
            }
        }, closeDelay);
    }
}
function checkPlaybackStatus() {
    const sessions = monitor._mediaSessions;
    if (sessions.size === 0) return;

    const firstEntry = sessions.entries().next().value;
    if (!firstEntry) return;

    const mediaSession = firstEntry[1];
    const { playback } = mediaSession;

    playbackStatus = playback.playbackStatus;

    if (playbackStatus !== lastPlaybackStatus) {
        lastPlaybackStatus = playbackStatus;
        triggerSlide(2000);
    }

    const iconSrc = Number(playbackStatus) === 4 ? './assets/icons/pause.svg' : './assets/icons/play.svg';
    if (playIcon.src !== iconSrc) playIcon.src = iconSrc;
}

function fetchMediaInfo() {
    const sessions = monitor._mediaSessions;
    if (sessions.size === 0) {
        songTitle.textContent = 'No song playing';
        songArtist.textContent = '';
        songSmall.innerHTML = `<span></span>`;
        songImage.src = './assets/icons/music_note.svg';
        songTime.textContent = '00:00';
        songDuration.textContent = '00:00';
        progressBar.style.width = '0%';
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        currentUrl = null;
        return;
    }

    const firstEntry = sessions.entries().next().value;
    if (!firstEntry) return;

    const appName = firstEntry[0];
    const mediaSession = firstEntry[1];
    const { media, timeline } = mediaSession;
    const { title, artist, thumbnail } = media;

    if (title !== lastSongName) {
        lastSongName = title;
        currentPosition = timeline.position;
        currentDuration = timeline.duration;

        console.log('appName', appName);

        if (appName === 'Spotify.exe') {
            progressBar.style.backgroundColor = '#1db954';
        } else if (appName === 'Chrome') {
            progressBar.style.backgroundColor = '#4285f4';
        }

        songTitle.textContent = title;
        songArtist.textContent = artist;
        songSmall.innerHTML = `<span>${title} - ${artist}</span>`;

        if (thumbnail) {
            const blob = new Blob([thumbnail], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            songImage.src = url;
            if (currentUrl) URL.revokeObjectURL(currentUrl);
            currentUrl = url;
        }
    } else {
        if (timeline.position < currentPosition - 1) {
            currentPosition = timeline.position;
        }
        currentDuration = timeline.duration;
    }
}

function updateProgress() {
    if (playbackStatus === 4) currentPosition += 1;

    const progress = Math.floor((currentPosition / currentDuration) * 100);
    if (progress !== lastProgress) {
        progressBar.style.width = `${progress}%`;
        lastProgress = progress;
    }

    songTime.textContent = formatTime(currentPosition);
    songDuration.textContent = formatTime(currentDuration);
}

function showMedia() {
    fetchMediaInfo();
    updateProgress();
    checkPlaybackStatus();
}

showMedia();

setInterval(checkPlaybackStatus, 1000);
setInterval(updateProgress, 1000);
setInterval(fetchMediaInfo, 4000);



document.getElementById('play-button').addEventListener('click', () => {
    if (document.getElementById('play-icon').src === './assets/icons/play.svg') {
        document.getElementById('play-icon').src = './assets/icons/pause.svg';
    } else {
        document.getElementById('play-icon').src = './assets/icons/play.svg';
    }
    ipcRenderer.send('toggle-playback');
});

document.getElementById('prev-button').addEventListener('click', () => {
    ipcRenderer.send('previous-track');
});

document.getElementById('next-button').addEventListener('click', () => {
    ipcRenderer.send('next-track');
});

function showPage(localPage) {
    if (localPage === 1) {
        page = 1;
        updateActivePage();
    } else if (localPage === 2) {
        page = 2;
        updateActivePage();
        showMedia();
    }
}

function updateActivePage() {
    document.getElementById('page-1').classList.remove('active');
    document.getElementById('page-2').classList.remove('active');
    document.getElementById('page-ui-2').style.display = 'none';
    document.getElementById('page-ui-1').style.display = 'none';
    document.getElementById(`page-${page}`).classList.add('active');
    document.getElementById(`page-ui-${page}`).style.display = 'flex';
}

document.getElementById('page-1').addEventListener('click', () => showPage(1));
document.getElementById('page-2').addEventListener('click', () => showPage(2));

document.getElementById('current-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

setInterval(() => {
    document.getElementById('current-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}, 1000);

document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
        showPage(page - 1);
    } else if (event.key === 'ArrowRight') {
        showPage(page + 1);
    }
});


document.getElementById('app-2').addEventListener('click', () => {
    ipcRenderer.send('open-ai');
    ipcRenderer.send('slide-up');
});

document.getElementById('collapse-to-island').addEventListener('click', () => {
    ipcRenderer.send('collapse-to-island');
});