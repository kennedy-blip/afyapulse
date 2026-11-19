/** Tiny, dependency-free CSV + download helpers. */

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function toCSV(rows, columns) {
  const header = columns.map((col) => escapeCell(col.label)).join(',')
  const body = rows
    .map((row) => columns.map((col) => escapeCell(typeof col.value === 'function' ? col.value(row) : row[col.key])).join(','))
    .join('\r\n')
  return `${header}\r\n${body}\r\n`
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  triggerDownload(filename, URL.createObjectURL(blob))
}

function triggerDownload(filename, href) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  if (href.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(href), 4000)
  }
}

export function downloadJSON(filename, data) {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json')
}

export function openBlob(href) {
  const win = window.open(href, '_blank', 'noopener')
  if (win) win.focus()
}

export { triggerDownload }
