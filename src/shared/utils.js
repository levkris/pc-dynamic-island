function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function sanitize(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function timeAgo(isoString) {
    const diff = Date.now() - new Date(isoString).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

module.exports = { formatTime, sanitize, timeAgo }