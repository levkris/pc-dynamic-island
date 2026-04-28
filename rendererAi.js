const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

ipcRenderer.on('fadeout', () => {
    document.querySelector('.border').classList.add('fade-out');
    document.querySelector('.content').classList.add('fade-out');
});

document.querySelector('.border').addEventListener('click', (event) => {
    if (event.target.classList.contains('border')) {
        ipcRenderer.send('close-ai');
    }
});

const prompt = document.getElementById('prompt');
const previousPromptsDiv = document.querySelector('.previous-prompts');

let promptVal = "";

prompt.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        ipcRenderer.send('ai-prompt', prompt.value);
        promptVal = sanitize(prompt.value);
        previousPromptsDiv.innerHTML = `
        <div class="previous-prompt maxHeight">
            <p class="prompt">${promptVal}</p>
            <p class="answer">Generating response...</p>
        </div>`;
        prompt.value = '';
    }
});

ipcRenderer.on('ai-response', (event, { response, error }) => {
    if (error) {
        previousPromptsDiv.textContent = `Error: ${error}\n`;
    } else {
        previousPromptsDiv.innerHTML = `
        <div class="previous-prompt maxHeight">
            <p class="prompt">${promptVal}</p>
            <p class="answer">${sanitize(response)}</p>
        </div>`;
    }
    previousPromptsDiv.scrollTop = previousPromptsDiv.scrollHeight;
});

let previousPrompts = [];
try {
    const filePath = path.join(__dirname, 'prompts.json');
    const existing = fs.readFileSync(filePath, 'utf8');
    previousPrompts = JSON.parse(existing).reverse();
} catch (err) {
    console.error('Failed to read existing prompts.json, starting fresh.', err);
}

function sanitize(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#039;')
               .replace(/\n/g, ' ')
               .trim();
}

function viewPrompt(entry) {
    previousPromptsDiv.innerHTML = `
        <div class="previous-prompt maxHeight" data-prompt-id="${entry.timestamp}">
            <p class="prompt">${sanitize(entry.prompt)}</p>
            <p class="answer">${sanitize(entry.answer)}</p>
        </div>
        <button class="back-btn">Back</button>
    `;
    const backBtn = previousPromptsDiv.querySelector('.back-btn');
    backBtn.addEventListener('click', renderAllPrompts);
}

function renderAllPrompts() {
    previousPromptsDiv.innerHTML = '';
    for (const entry of previousPrompts) {
        const div = document.createElement('div');
        div.className = 'previous-prompt';
        div.dataset.promptId = entry.timestamp;
        div.innerHTML = `
            <p class="prompt">${sanitize(entry.prompt)}</p>
            <p class="answer">${sanitize(entry.answer)}</p>
        `;
        div.addEventListener('click', () => viewPrompt(entry));
        previousPromptsDiv.appendChild(div);
    }
}


renderAllPrompts();
