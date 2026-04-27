import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase, withTimeout } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import AIInput from '../components/AIInput'
import ExportButton from '../components/ExportButton'

function pct(supply) {
  if (supply.ideal_stock <= 0) return 0
  return Math.max(0, Math.round(((supply.ideal_stock - supply.current_stock) / supply.ideal_stock) * 100))
}

function rowBg(supply) {
  const p = pct(supply)
  if (p > 50) return 'rgba(239,68,68,0.06)'
  if (p >= 20) return 'rgba(245,158,11,0.06)'
  return 'transparent'
}

function barColor(p) {
  if (p > 50) return '#ef4444'
  if (p >= 20) return '#f59e0b'
  return '#22c55e'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    const d = payload[0].payload
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 13,
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div>Faltante: <strong>{payload[0].value}%</strong></div>
        <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
          Actual {d.actual} / Ideal {d.ideal}
        </div>
      </div>
    )
  }
  return null
}

export default function Supplies() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [supplies, setSupplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbErr } = await withTimeout(
        supabase.from('supplies').select('*').order('name'),
      )
      if (dbErr) throw new Error(dbErr.message)
      setSupplies(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveStock(id) {
    const val = parseInt(editValue, 10)
    if (isNaN(val) || val < 0) { setEditingId(null); return }
    const { error } = await supabase
      .from('supplies')
      .update({ current_stock: val, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setSupplies(prev => prev.map(s => s.id === id ? { ...s, current_stock: val } : s))
    }
    setEditingId(null)
  }

  const chartData = supplies
    .filter(s => s.ideal_stock > 0 && pct(s) > 0)
    .map(s => ({ name: s.name, faltante: pct(s), actual: s.current_stock, ideal: s.ideal_stock }))
    .sort((a, b) => b.faltante - a.faltante)

  const filtered = supplies.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalFaltante = supplies.reduce((sum, s) => sum + Math.max(0, s.ideal_stock - s.current_stock), 0)

  const exportData = supplies.map(s => ({
    Insumo: s.name,
    'Stock ideal': s.ideal_stock,
    'Stock actual': s.current_stock,
    'Faltante': Math.max(0, s.ideal_stock - s.current_stock),
    'Faltante %': pct(s) + '%',
    Unidad: s.unit,
  }))

  const today = new Date().toISOString().split('T')[0]

  const inputStyle = {
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'var(--text)',
    fontSize: 13,
    width: 80,
    outline: 'none',
    textAlign: 'center',
    fontFamily: 'var(--font-family)',
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Cargando insumos…</div>
  if (error) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>
      <button onClick={fetchData} className="btn-secondary" style={{ fontSize: 13 }}>↺ Reintentar conexión</button>
    </div>
  )
  const chartHeight = Math.max(chartData.length * 32 + 50, 180)

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
            Insumos
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {supplies.length} insumos · {totalFaltante} unidades faltantes en total
          </p>
        </div>
        {isAdmin && (
          <ExportButton
            data={exportData}
            headers={['Insumo', 'Stock ideal', 'Stock actual', 'Faltante', 'Faltante %', 'Unidad']}
            filename={`inventario_cruzroja_insumos_${today}.csv`}
          />
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid var(--border)',
          padding: '20px 16px 12px',
          marginBottom: 28,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
            % Faltante por insumo (mayor a menor)
          </h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 48, top: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={170}
                tick={{ fontSize: 12, fill: 'var(--text)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="faltante" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.faltante)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingLeft: 8 }}>
            {[
              { color: '#ef4444', label: 'Crítico >50%' },
              { color: '#f59e0b', label: 'Bajo 20–50%' },
              { color: '#22c55e', label: 'Aceptable <20%' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar insumo…"
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
            width: 220,
            fontFamily: 'var(--font-family)',
          }}
        />
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th style={{ textAlign: 'right' }}>Ideal</th>
              <th style={{ textAlign: 'right' }}>Actual</th>
              <th style={{ textAlign: 'right' }}>Faltante</th>
              <th style={{ textAlign: 'right' }}>%</th>
              {isAdmin && <th>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(supply => {
              const missing = Math.max(0, supply.ideal_stock - supply.current_stock)
              const p = pct(supply)
              return (
                <tr key={supply.id} style={{ background: rowBg(supply) }}>
                  <td style={{ fontWeight: 500 }}>{supply.name}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{supply.ideal_stock}</td>
                  <td style={{ textAlign: 'right' }}>
                    {editingId === supply.id ? (
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        style={inputStyle}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveStock(supply.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onBlur={() => saveStock(supply.id)}
                      />
                    ) : (
                      <span
                        title={isAdmin ? 'Clic para editar' : ''}
                        onClick={() => { if (isAdmin) { setEditingId(supply.id); setEditValue(String(supply.current_stock)) } }}
                        style={{
                          fontWeight: 600,
                          color: p > 50 ? '#ef4444' : p >= 20 ? '#d97706' : 'var(--text)',
                          cursor: isAdmin ? 'pointer' : 'default',
                          padding: '2px 6px',
                          borderRadius: 4,
                          transition: 'background 0.1s',
                        }}
                      >
                        {supply.current_stock}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', color: missing > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: missing > 0 ? 600 : 400 }}>
                    {missing > 0 ? `-${missing}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {p > 0 ? (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        color: p > 50 ? '#ef4444' : p >= 20 ? '#d97706' : '#16a34a',
                        background: p > 50 ? 'rgba(239,68,68,0.1)' : p >= 20 ? 'rgba(245,158,11,0.1)' : 'rgba(22,163,74,0.1)',
                      }}>
                        {p}%
                      </span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>✓</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      {editingId === supply.id ? null : (
                        <button
                          onClick={() => { setEditingId(supply.id); setEditValue(String(supply.current_stock)) }}
                          className="btn-secondary"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 24 }}>
          <AIInput section="supplies" onChangesApplied={fetchData} />
        </div>
      )}
    </div>
  )
}
