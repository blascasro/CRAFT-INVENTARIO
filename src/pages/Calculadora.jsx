import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase, withTimeout } from '../lib/supabaseClient'

// ── Counter ───────────────────────────────────────────────────────────────────
function Counter({ label, sublabel, value, onChange }) {
  const btnSt = {
    width: 38, height: 38,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text)', fontSize: 20, lineHeight: 1,
    fontFamily: 'var(--font-family)', fontWeight: 500,
    transition: 'background 0.1s',
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
      }}>
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          style={btnSt}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >−</button>
        <span style={{
          minWidth: 44, textAlign: 'center', fontSize: 15, fontWeight: 700,
          color: 'var(--text)', padding: '0 4px',
          borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
        }}>
          {value}
        </span>
        <button
          onClick={() => onChange(value + 1)}
          style={btnSt}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >+</button>
      </div>
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '10px 0', fontFamily: 'var(--font-family)',
        width: '100%', textAlign: 'left',
      }}
    >
      <div style={{
        width: 40, height: 22, borderRadius: 11,
        background: value ? '#E8112D' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'white', position: 'absolute',
          top: 2, left: value ? 20 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
    </button>
  )
}

// ── ResultRow ─────────────────────────────────────────────────────────────────
function ResultRow({ item, onDelta }) {
  const isZero = item.qty === 0
  const btnSt = {
    width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text)', fontSize: 16, fontFamily: 'var(--font-family)',
    transition: 'background 0.1s',
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
      opacity: isZero ? 0.4 : 1, gap: 12, transition: 'opacity 0.15s',
    }}>
      <span style={{
        fontSize: 14, color: 'var(--text)', flex: 1,
        textDecoration: isZero ? 'line-through' : 'none',
      }}>
        {item.name}
      </span>
      <div style={{
        display: 'flex', alignItems: 'center', flexShrink: 0,
        border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden',
      }}>
        <button
          onClick={() => onDelta(-1)}
          style={btnSt}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >−</button>
        <span style={{
          minWidth: 36, textAlign: 'center', fontSize: 14, fontWeight: 700,
          color: 'var(--text)', padding: '0 2px',
          borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
        }}>
          {item.qty}
        </span>
        <button
          onClick={() => onDelta(1)}
          style={btnSt}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >+</button>
      </div>
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COVERAGE_FIELDS = [
  { key: 'puesto_3x3',   label: 'Puestos 3x3' },
  { key: 'puesto_3x6',   label: 'Puestos 3x6' },
  { key: 'carpa_9x6',    label: 'Carpas 9x6' },
  { key: 'equipo_movil', label: 'Equipos móviles' },
  { key: 'movil',        label: 'Móviles' },
  { key: 'cuatriciclo',  label: 'Cuatriciclos' },
  { key: 'cascos',       label: 'Cascos necesarios', sublabel: 'Corresponde al número de voluntarios del turno' },
]

const DIET_LABELS = {
  tradicional:  'Tradicional',
  sin_azucar:   'Sin azúcar',
  celiaco:      'Celíaco',
  vegano:       'Vegano',
  sin_sal:      'Sin sal',
  sin_lactosa:  'Sin lactosa',
}

// Preferred display order for morrales
const MORRAL_ORDER = ['Morral estándar', 'BASE/Morral de trauma', 'Morral de trauma', 'Caja de atención']

function sortMorrales(items) {
  return [...items].sort((a, b) => {
    const ai = MORRAL_ORDER.indexOf(a.name)
    const bi = MORRAL_ORDER.indexOf(b.name)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.name.localeCompare(b.name, 'es')
  })
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Calculadora() {
  // Remote data
  const [unitItems, setUnitItems] = useState([])
  const [dietItems, setDietItems] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError]   = useState(null)

  // Paso 1 — Cobertura
  const [counters, setCounters] = useState({
    puesto_3x3: 0, puesto_3x6: 0, carpa_9x6: 0,
    equipo_movil: 0, movil: 0, cuatriciclo: 0, cascos: 0,
  })
  const [necesidadLuz, setNecesidadLuz] = useState(false)

  // Paso 2 — Refrigerios
  const [hayRefrigerios, setHayRefrigerios] = useState(false)
  const [comida,    setComida]    = useState(true)
  const [tentempie, setTentempie] = useState(true)
  const [dietas, setDietas] = useState({
    tradicional: 0, sin_azucar: 0, celiaco: 0, vegano: 0, sin_sal: 0, sin_lactosa: 0,
  })

  // Result (in-memory only)
  const [result, setResult] = useState(null)

  // ── Load data once ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setDataLoading(true)
    setDataError(null)
    try {
      const [unitsRes, dietRes] = await Promise.all([
        withTimeout(supabase.from('calculator_units').select('*')),
        withTimeout(supabase.from('calculator_diet_items').select('*')),
      ])
      if (unitsRes.error) throw new Error(unitsRes.error.message)
      if (dietRes.error)  throw new Error(dietRes.error.message)
      setUnitItems(unitsRes.data || [])
      setDietItems(dietRes.data  || [])
    } catch (err) {
      setDataError(err.message)
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalVolunteers = Object.values(dietas).reduce((s, v) => s + v, 0)

  // ── Calculate ──────────────────────────────────────────────────────────────
  function handleCalculate() {
    const eqTotals  = {}
    const morTotals = {}

    // Sum items from each unit type
    for (const item of unitItems) {
      const count = counters[item.unit_type] ?? 0
      if (count === 0) continue
      const totals = item.category === 'morral' ? morTotals : eqTotals
      totals[item.item_name] = (totals[item.item_name] || 0) + parseFloat(item.quantity) * count
    }

    // Additional cascos from paso 1
    if (counters.cascos > 0) {
      eqTotals['Cascos'] = (eqTotals['Cascos'] || 0) + counters.cascos
    }

    // Luz toggle: 1 Caja de luz per puesto_3x3 and per puesto_3x6
    // (carpa_9x6 already has Caja de luz in its seed — no duplication needed)
    if (necesidadLuz) {
      const lightAdd = counters.puesto_3x3 + counters.puesto_3x6
      if (lightAdd > 0) {
        eqTotals['Caja de luz'] = (eqTotals['Caja de luz'] || 0) + lightAdd
      }
    }

    // Convert to sorted arrays (ceil fractional quantities)
    const toArr = obj =>
      Object.entries(obj)
        .map(([name, qty]) => ({ name, qty: Math.ceil(qty) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))

    // Refrigerios
    let refrigArr = null
    if (hayRefrigerios) {
      const refrigTotals = {}
      for (const [diet, count] of Object.entries(dietas)) {
        if (count === 0) continue
        for (const item of dietItems.filter(i => i.diet_type === diet)) {
          if (!comida    && item.is_food)  continue
          if (!tentempie && item.is_snack) continue
          refrigTotals[item.item_name] =
            (refrigTotals[item.item_name] || 0) + parseFloat(item.quantity) * count
        }
      }
      // Ceil after summing across all diets
      refrigArr = Object.entries(refrigTotals)
        .map(([name, qty]) => ({ name, qty: Math.ceil(qty) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }

    setResult({
      equipamiento: toArr(eqTotals),
      morrales:     sortMorrales(Object.entries(morTotals).map(([name, qty]) => ({ name, qty: Math.ceil(qty) }))),
      refrigerios:  refrigArr,
    })

    // Scroll to result after a tick
    setTimeout(() => {
      document.getElementById('calc-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // ── Update result item ─────────────────────────────────────────────────────
  function updateQty(section, name, delta) {
    setResult(prev => ({
      ...prev,
      [section]: prev[section].map(item =>
        item.name === name ? { ...item, qty: Math.max(0, item.qty + delta) } : item
      ),
    }))
  }

  // ── Export Excel ───────────────────────────────────────────────────────────
  function handleExport() {
    if (!result) return
    const buildSheet = items => {
      const rows = items.filter(i => i.qty > 0)
      const ws = XLSX.utils.aoa_to_sheet([
        ['Ítem', 'Cantidad'],
        ...rows.map(i => [i.name, i.qty]),
      ])
      ws['!cols'] = [
        { wch: rows.length ? Math.max(4, ...rows.map(i => i.name.length)) + 2 : 12 },
        { wch: 10 },
      ]
      return ws
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, buildSheet(result.equipamiento), 'Equipamiento')
    XLSX.utils.book_append_sheet(wb, buildSheet(result.morrales),     'Morrales')
    if (result.refrigerios) {
      XLSX.utils.book_append_sheet(wb, buildSheet(result.refrigerios), 'Refrigerios')
    }
    const today = new Date().toISOString().split('T')[0]
    XLSX.writeFile(wb, `calculadora_cruzroja_${today}.xlsx`)
  }

  // ── Shared styles ──────────────────────────────────────────────────────────
  const cardSt = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '20px 24px', marginBottom: 20,
  }

  function StepBadge({ n }) {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#E8112D',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>{n}</div>
    )
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (dataLoading) return (
    <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
      Cargando datos…
    </div>
  )
  if (dataError) return (
    <div>
      <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{dataError}</p>
      <button onClick={fetchData} className="btn-secondary" style={{ fontSize: 13 }}>↺ Reintentar</button>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680 }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
          Calculadora
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Calculá el equipamiento, morrales y refrigerios para un evento
        </p>
      </div>

      {/* ── PASO 1 — Cobertura ── */}
      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <StepBadge n={1} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Cobertura</h2>
        </div>

        {COVERAGE_FIELDS.map(f => (
          <Counter
            key={f.key}
            label={f.label}
            sublabel={f.sublabel}
            value={counters[f.key]}
            onChange={v => setCounters(prev => ({ ...prev, [f.key]: v }))}
          />
        ))}

        <div style={{ borderBottom: 'none' }}>
          <Toggle label="Necesidad de luz" value={necesidadLuz} onChange={setNecesidadLuz} />
        </div>
      </div>

      {/* ── PASO 2 — Refrigerios ── */}
      <div style={cardSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <StepBadge n={2} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Refrigerios</h2>
        </div>

        <Toggle label="¿Hay refrigerios?" value={hayRefrigerios} onChange={setHayRefrigerios} />

        {hayRefrigerios && (
          <>
            {/* Comida / Tentempié toggles */}
            <div style={{
              display: 'flex', gap: 32, flexWrap: 'wrap',
              paddingBottom: 4, borderBottom: '1px solid var(--border)',
            }}>
              <Toggle label="Comida"     value={comida}    onChange={setComida} />
              <Toggle label="Tentempié"  value={tentempie} onChange={setTentempie} />
            </div>

            {/* Diet counters */}
            <div style={{ marginTop: 4 }}>
              {Object.entries(DIET_LABELS).map(([key, label]) => (
                <Counter
                  key={key}
                  label={label}
                  value={dietas[key]}
                  onChange={v => setDietas(prev => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>

            {/* Total volunteers */}
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                Total de voluntarios
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {totalVolunteers}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Calcular ── */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <button
          onClick={handleCalculate}
          className="btn-primary"
          style={{ padding: '11px 36px', fontSize: 15, fontWeight: 600 }}
        >
          Calcular
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div id="calc-result">

          {/* No items fallback */}
          {result.equipamiento.length === 0 && result.morrales.length === 0 &&
           (!result.refrigerios || result.refrigerios.length === 0) && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
              No hay ítems calculados. Ingresá al menos una unidad en Paso 1.
            </p>
          )}

          {/* Equipamiento y estructura */}
          {result.equipamiento.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text)',
                marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--border)',
              }}>
                Equipamiento y estructura
              </h3>
              {result.equipamiento.map(item => (
                <ResultRow
                  key={item.name}
                  item={item}
                  onDelta={delta => updateQty('equipamiento', item.name, delta)}
                />
              ))}
            </div>
          )}

          {/* Morrales */}
          {result.morrales.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text)',
                marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--border)',
              }}>
                Morrales
              </h3>
              {result.morrales.map(item => (
                <ResultRow
                  key={item.name}
                  item={item}
                  onDelta={delta => updateQty('morrales', item.name, delta)}
                />
              ))}
            </div>
          )}

          {/* Refrigerios */}
          {result.refrigerios && result.refrigerios.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text)',
                marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--border)',
              }}>
                Refrigerios
              </h3>
              {result.refrigerios.map(item => (
                <ResultRow
                  key={item.name}
                  item={item}
                  onDelta={delta => updateQty('refrigerios', item.name, delta)}
                />
              ))}
            </div>
          )}

          {/* Export button */}
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-family)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exportar Excel
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
