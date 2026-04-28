import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase, withTimeout } from '../lib/supabaseClient'

const PAGE_SIZE = 20

// Format ISO timestamp to Argentina time (UTC-3), DD/MM/YYYY HH:mm
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Extract section name from description prefix like "[insumos] ..."
function sectionFromDesc(desc) {
  const m = (desc || '').match(/^\[([^\]]+)\]/)
  return m ? m[1] : '—'
}

// Remove the "[section] " prefix for cleaner body display
function bodyFromDesc(desc) {
  return (desc || '').replace(/^\[[^\]]+\]\s*/, '')
}

const SECTION_BADGE = {
  insumos:      { color: '#0369a1', bg: 'rgba(3,105,161,0.08)', border: 'rgba(3,105,161,0.2)' },
  equipamiento: { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
  morrales:     { color: '#b45309', bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.2)'  },
}

export default function Auditoria() {
  const [logs,          setLogs]          = useState([])
  const [profiles,      setProfiles]      = useState({})   // { user_id: email }
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [total,         setTotal]         = useState(0)
  const [page,          setPage]          = useState(0)
  const [filterSection, setFilterSection] = useState('')
  const [exporting,     setExporting]     = useState(false)

  // Fetch one page of logs + profiles for the user_ids on that page
  const fetchPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filterSection) {
        q = q.ilike('description', `[${filterSection}]%`)
      }

      const { data, error: dbErr, count } = await withTimeout(q)
      if (dbErr) throw new Error(dbErr.message)

      setLogs(data || [])
      setTotal(count || 0)

      // Fetch profiles for any user_ids not yet cached
      const ids = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
      setProfiles(prev => {
        const missing = ids.filter(id => !prev[id])
        if (!missing.length) return prev
        // Fire-and-forget: fetch missing profiles and merge into state
        supabase.from('profiles').select('id, email').in('id', missing)
          .then(({ data: pd }) => {
            if (!pd?.length) return
            const map = {}
            for (const p of pd) map[p.id] = p.email
            setProfiles(current => ({ ...current, ...map }))
          })
        return prev
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, filterSection])

  useEffect(() => { fetchPage() }, [fetchPage])

  // Change filter and reset to page 0 atomically
  function changeFilter(val) {
    setFilterSection(val)
    setPage(0)
  }

  // Fetch ALL records (ignoring pagination) for Excel export
  async function exportExcel() {
    setExporting(true)
    try {
      let q = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
      if (filterSection) q = q.ilike('description', `[${filterSection}]%`)

      const { data, error: dbErr } = await withTimeout(q, 30000)
      if (dbErr) throw new Error(dbErr.message)
      const rows = data || []

      // Resolve profiles for all user_ids (use cache + fetch missing)
      const allIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
      const profileMap = { ...profiles }
      const missingIds = allIds.filter(id => !profileMap[id])
      if (missingIds.length) {
        const { data: pd } = await supabase.from('profiles').select('id, email').in('id', missingIds)
        for (const p of pd || []) profileMap[p.id] = p.email
      }

      const headers = ['Usuario', 'Sección', 'Descripción', 'Fecha y hora']
      const sheetRows = [
        headers,
        ...rows.map(r => [
          profileMap[r.user_id] || '—',
          sectionFromDesc(r.description),
          bodyFromDesc(r.description),
          formatDate(r.created_at),
        ]),
      ]

      const ws = XLSX.utils.aoa_to_sheet(sheetRows)
      ws['!cols'] = headers.map((h, i) => ({
        wch: Math.max(h.length, ...sheetRows.slice(1).map(row => String(row[i] ?? '').length)) + 2,
      }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoría')
      const today = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `auditoria_cruzroja_${today}.xlsx`)
    } catch (err) {
      console.error('[Auditoria] export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (loading && logs.length === 0) return (
    <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Cargando auditoría…</div>
  )
  if (error) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>
      <button onClick={fetchPage} className="btn-secondary" style={{ fontSize: 13 }}>↺ Reintentar conexión</button>
    </div>
  )

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
            Auditoría
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {total} {total === 1 ? 'registro' : 'registros'} en total
            {filterSection && <span> · filtrando por <strong>{filterSection}</strong></span>}
          </p>
        </div>

        <button
          onClick={exportExcel}
          disabled={exporting || total === 0}
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
            cursor: exporting || total === 0 ? 'not-allowed' : 'pointer',
            opacity: exporting || total === 0 ? 0.5 : 1,
            fontFamily: 'var(--font-family)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!exporting && total > 0) e.currentTarget.style.background = 'var(--surface-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {exporting ? 'Exportando…' : 'Exportar Excel'}
        </button>
      </div>

      {/* Section filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <select
          value={filterSection}
          onChange={e => changeFilter(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            fontSize: 13,
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'var(--font-family)',
          }}
        >
          <option value="">Todas las secciones</option>
          <option value="insumos">Insumos</option>
          <option value="equipamiento">Equipamiento</option>
          <option value="morrales">Morrales</option>
        </select>
        {filterSection && (
          <button
            onClick={() => changeFilter('')}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(232,17,45,0.3)',
              background: 'transparent',
              color: '#E8112D',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
            }}
          >
            ✕ Limpiar filtro
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        marginBottom: 16,
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Usuario</th>
                <th style={{ width: 130 }}>Sección</th>
                <th>Descripción</th>
                <th style={{ width: 160, whiteSpace: 'nowrap' }}>Fecha y hora</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px', fontSize: 14 }}>
                    No hay registros{filterSection ? ` para "${filterSection}"` : ''}.
                  </td>
                </tr>
              ) : logs.map((log, i) => {
                const sec = sectionFromDesc(log.description)
                const badge = SECTION_BADGE[sec]
                return (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {page * PAGE_SIZE + i + 1}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>
                      {profiles[log.user_id] || (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td>
                      {badge ? (
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          color: badge.color,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          display: 'inline-block',
                        }}>
                          {sec}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{sec}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text)' }}>
                      {bodyFromDesc(log.description)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            ← Anterior
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
