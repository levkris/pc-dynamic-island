const { ipcRenderer } = require('electron')
const path = require('path')
const fs = require('fs')

const PROMPTS_PATH = path.join(__dirname, '../../../data/prompts.json')

const promptInput = document.getElementById('prompt')
const historyDiv = document.querySelector('.history')

let currentPrompt = ''
let streaming = false

ipcRenderer.on('fadeout', () => {
    document.querySelector('.backdrop').classList.add('fade-out')
    document.querySelector('.panel').classList.add('fade-out')
})

document.querySelector('.backdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) ipcRenderer.send('close-ai')
})

function sanitize(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>')
        .trim()
}

function createBubble(promptText, answerText = '', streaming = false) {
    const div = document.createElement('div')
    div.className = 'bubble'
    div.innerHTML = `
        <p class="bubble-prompt">${sanitize(promptText)}</p>
        <p class="bubble-answer ${streaming ? 'streaming' : ''}">${sanitize(answerText) || '<span class="cursor">▍</span>'}</p>
    `
    return div
}

function showStreaming(promptText) {
    historyDiv.innerHTML = ''
    const bubble = createBubble(promptText, '', true)
    historyDiv.appendChild(bubble)
    return bubble.querySelector('.bubble-answer')
}

promptInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !promptInput.value.trim() || streaming) return

    currentPrompt = promptInput.value.trim()
    promptInput.value = ''
    streaming = true

    const answerEl = showStreaming(currentPrompt)
    let accumulated = ''

    ipcRenderer.send('ai-prompt', currentPrompt)

    ipcRenderer.once('ai-done', (_, { response, error }) => {
        streaming = false
        answerEl.classList.remove('streaming')
        if (error) {
            answerEl.innerHTML = `<span class="error">Error: ${sanitize(error)}</span>`
        } else {
            answerEl.innerHTML = sanitize(response || accumulated)
        }
        historyDiv.scrollTop = historyDiv.scrollHeight
        loadHistory()
    })
})

ipcRenderer.on('ai-stream', (_, chunk) => {
    const answerEl = historyDiv.querySelector('.bubble-answer.streaming')
    if (!answerEl) return
    const cursor = answerEl.querySelector('.cursor')
    if (cursor) cursor.remove()
    answerEl.innerHTML += sanitize(chunk).replace(/<br>/g, ' ')
    historyDiv.scrollTop = historyDiv.scrollHeight
})

function loadHistory() {
    try {
        const prompts = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8')).reverse()
        historyDiv.innerHTML = ''
        prompts.forEach(entry => {
            const bubble = createBubble(entry.prompt, entry.answer)
            bubble.addEventListener('click', () => {
                historyDiv.innerHTML = ''
                const expanded = createBubble(entry.prompt, entry.answer)
                expanded.classList.add('expanded')
                historyDiv.appendChild(expanded)

                const back = document.createElement('button')
                back.className = 'back-btn'
                back.textContent = '← Back'
                back.addEventListener('click', loadHistory)
                historyDiv.appendChild(back)
            })
            historyDiv.appendChild(bubble)
        })
    } catch {
        historyDiv.innerHTML = '<p class="empty">No previous prompts.</p>'
    }
}

loadHistory()
promptInput.focus()