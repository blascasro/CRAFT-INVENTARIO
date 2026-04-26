export default function ExportButton({ data, headers, filename }) {
  function handleExport() {
    if (!data || data.length === 0) return

    const rows = [
      headers,
      ...data.map(row => headers.map(h => {
        const val = row[h] ?? ''
        return `"${String(val).replace(/"/g, '""')}"`
      })),
    ]
    const csv = rows.map(r => r.join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={!data || data.length === 0}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        fontSize: 13,
        fontWeight: 500,
        cursor: data?.length ? 'pointer' : 'not-allowed',
        opacity: data?.length ? 1 : 0.5,
        fontFamily: 'var(--font-family)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (data?.length) e.currentTarget.style.background = 'var(--surface-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Exportar CSV
    </button>
  )
}
