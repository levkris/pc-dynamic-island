const { ipcRenderer } = require('electron')

const logEl       = document.getElementById('log')
const emptyEl     = document.getElementById('empty')
const countEl     = document.getElementById('count')
const searchEl    = document.getElementById('search')
const autoScrollEl = document.getElementById('auto-scroll')
const clearBtn    = document.getElementById('btn-clear')

const activeFilters = new Set(['log', 'info', 'warn', 'error'])
let searchText = ''
let totalCount = 0

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function buildEntry(entry) {
    const div = document.createElement('div')
    div.className = `entry level-${entry.level}`
    div.dataset.level = entry.level
    div.dataset.msg = entry.message.toLowerCase()
    div.innerHTML =
        `<span class="entry-time">${escapeHtml(entry.time)}</span>` +
        `<span class="entry-level">${entry.level}</span>` +
        `<span class="entry-msg">${escapeHtml(entry.message)}</span>`
    return div
}

function applyVisibility(div) {
    const levelOk  = activeFilters.has(div.dataset.level)
    const searchOk = !searchText || div.dataset.msg.includes(searchText)
    div.classList.toggle('hidden', !(levelOk && searchOk))
}

function refilterAll() {
    for (const div of logEl.children) applyVisibility(div)
    updateEmpty()
}

function addEntry(entry) {
    totalCount++
    countEl.textContent = `${totalCount} entr${totalCount === 1 ? 'y' : 'ies'}`

    const div = buildEntry(entry)
    applyVisibility(div)
    logEl.appendChild(div)
    emptyEl.style.display = 'none'

    if (autoScrollEl.checked && !div.classList.contains('hidden')) {
        div.scrollIntoView({ block: 'end' })
    }
}

function updateEmpty() {
    const anyVisible = Array.from(logEl.children).some(d => !d.classList.contains('hidden'))
    emptyEl.style.display = (totalCount === 0 || !anyVisible) ? 'block' : 'none'
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.dataset.level
        if (activeFilters.has(level)) {
            activeFilters.delete(level)
            btn.className = 'filter-btn'
        } else {
            activeFilters.add(level)
            btn.className = `filter-btn active-${level}`
        }
        refilterAll()
    })
})

searchEl.addEventListener('input', () => {
    searchText = searchEl.value.toLowerCase().trim()
    refilterAll()
})

clearBtn.addEventListener('click', () => {
    logEl.innerHTML = ''
    totalCount = 0
    countEl.textContent = '0 entries'
    emptyEl.style.display = 'block'
})

ipcRenderer.on('log-init', (_, entries) => {
    for (const entry of entries) addEntry(entry)
    updateEmpty()
})

ipcRenderer.on('log-entry', (_, entry) => {
    addEntry(entry)
})

updateEmpty()