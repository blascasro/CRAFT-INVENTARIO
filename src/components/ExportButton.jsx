import * as XLSX from 'xlsx'

/**
 * Props (two modes):
 *   Single-sheet:  { data, headers, filename }
 *   Multi-sheet:   { sheets: [{ name, data, headers }], filename }
 */
export default function ExportButton({ data, headers, sheets, filename }) {
  const hasData = sheets
    ? sheets.length > 0 && sheets.some(s => s.data?.length > 0)
    : data?.length > 0

  function buildSheet(sheetHeaders, sheetData) {
    const rows = [
      sheetHeaders,
      ...sheetData.map(row => sheetHeaders.map(h => row[h] ?? '')),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Auto column width
    const colWidths = sheetHeaders.map(h => ({
      wch: Math.max(
        h.length,
        ...sheetData.map(row => String(row[h] ?? '').length),
      ) + 2,
    }))
    ws['!cols'] = colWidths

    return ws
  }

  function handleExport() {
    if (!hasData) return
    const wb = XLSX.utils.book_new()

    if (sheets) {
      sheets.forEach(({ name, data: sheetData, headers: sheetHeaders }) => {
        const ws = buildSheet(sheetHeaders, sheetData || [])
        // Sheet names max 31 chars (Excel limit)
        XLSX.utils.book_append_sheet(wb, ws, String(name).slice(0, 31))
      })
    } else {
      XLSX.utils.book_append_sheet(wb, buildSheet(headers, data), 'Datos')
    }

    XLSX.writeFile(wb, filename)
  }

  return (
    <button
      onClick={handleExport}
      disabled={!hasData}
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
        cursor: hasData ? 'pointer' : 'not-allowed',
        opacity: hasData ? 1 : 0.5,
        fontFamily: 'var(--font-family)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (hasData) e.currentTarget.style.background = 'var(--surface-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Exportar Excel
    </button>
  )
}
