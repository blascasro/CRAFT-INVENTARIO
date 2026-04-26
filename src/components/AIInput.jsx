/**
 * AIInput — Registrar cambios de inventario sin API de pago.
 *
 * Modo Formulario : cuestionario guiado específico por sección.
 * Modo Voz        : Web Speech API del navegador (Chrome / Edge, gratis).
 *                   Transcribe el audio → intenta pre-llenar el formulario.
 *                   Si el navegador no soporta la API, solo muestra el formulario.
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

// ── Fuzzy match ────────────────────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = a[i - 1] === b[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
  return d[m][n]
}

function bestMatch(query, candidates) {
  const q = (query || '').toLowerCase().trim()
  if (!q || !candidates.length) return null
  for (const c of candidates)
    if (c.toLowerCase().includes(q) || q.includes(c.toLowerCase())) return c
  let best = null, bestDist = Infinity
  for (const c of candidates) {
    const dist = levenshtein(q, c.toLowerCase())
    const threshold = Math.max(q.length, c.length) * 0.45
    if (dist < bestDist && dist <= threshold) { best = c; bestDist = dist }
  }
  return best
}

// ── Números en español ────────────────────────────────────────────────────────
const ES_NUM = {
  cero:0,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,
  diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,
  veinte:20,treinta:30,cuarenta:40,cincuenta:50,
  sesenta:60,setenta:70,ochenta:80,noventa:90,
  cien:100,ciento:100,doscientos:200,trescientos:300,
  cuatrocientos:400,quinientos:500,
}

function extractNumbers(text) {
  const fromDigits = (text.match(/\d+/g) || []).map(Number)
  const fromWords = text.toLowerCase().split(/\s+/)
    .map(w => ES_NUM[w]).filter(n => n !== undefined)
  return [...fromDigits, ...fromWords]
}

// ── Parser de voz por sección ─────────────────────────────────────────────────
function parseVoice(transcript, section, loadedData) {
  const text = transcript.toLowerCase()
  const nums = extractNumbers(text)
  const words = text.split(/\s+/)
  const changes = []

  // Sliding-window phrase search
  function findBest(candidates) {
    for (let len = 5; len >= 1; len--)
      for (let i = 0; i <= words.length - len; i++) {
        const m = bestMatch(words.slice(i, i + len).join(' '), candidates)
        if (m) return m
      }
    return null
  }

  if (section === 'supplies') {
    const allNames = Array.isArray(loadedData) ? loadedData : []
    const matched = findBest(allNames)
    if (matched && nums.length)
      changes.push({ name: matched, new_stock: nums[nums.length - 1] })
  }

  if (section === 'equipment') {
    const allTypes = Array.isArray(loadedData) ? loadedData : []
    const COND = {
      dañado:'damaged', roto:'damaged', rota:'damaged',
      deteriorado:'damaged', malo:'damaged',
      bueno:'good', bien:'good', funciona:'good',
      desconocido:'unknown',
    }
    let condition = 'good'
    for (const [w, v] of Object.entries(COND))
      if (text.includes(w)) { condition = v; break }
    const matched = findBest(allTypes)
    if (matched)
      changes.push({ type: matched, number: nums[0]?.toString() || '', condition, notes: '' })
  }

  if (section === 'bags') {
    const { bagNumbers = [], itemNames = [] } = loadedData || {}
    const bagRe = /morral\s*(?:n[uú]mero\s*)?(\d+)|bolso\s*(\d+)/
    const bagM = text.match(bagRe)
    const bagNum = bagM ? (bagM[1] || bagM[2]) : (nums[0]?.toString() ?? null)
    const matchedItem = findBest(itemNames)
    const qty = nums.length ? nums[nums.length - 1] : null
    if (bagNum && matchedItem && qty !== null)
      changes.push({ bag_number: bagNum, item: matchedItem, current_quantity: qty })
  }

  return changes
}

// ── Detección de Web Speech API ───────────────────────────────────────────────
const hasSpeechAPI =
  typeof window !== 'undefined' &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition)

// ── Estilos compartidos ───────────────────────────────────────────────────────
const st = {
  input: {
    padding: '8px 11px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--input-bg)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-family)', width: '100%',
  },
  select: {
    padding: '8px 11px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--input-bg)',
    color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-family)', width: '100%',
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: 5,
  },
  btnAdd: {
    padding: '8px 14px', borderRadius: 8, border: 'none',
    background: '#E8112D', color: 'white', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-family)', whiteSpace: 'nowrap',
  },
  btnPrimary: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#E8112D', color: 'white', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-family)',
  },
  btnSecondary: {
    padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text)', fontSize: 13,
    cursor: 'pointer', fontFamily: 'var(--font-family)',
  },
}

// ── Sub-forms ─────────────────────────────────────────────────────────────────
function SuppliesForm({ items, prefill, onAdd }) {
  const [name, setName] = useState(prefill?.name || '')
  const [qty, setQty]   = useState(prefill?.new_stock != null ? String(prefill.new_stock) : '')

  useEffect(() => {
    if (prefill?.name)      setName(prefill.name)
    if (prefill?.new_stock != null) setQty(String(prefill.new_stock))
  }, [prefill])

  function add() {
    if (!name || qty === '') return
    onAdd({ name, new_stock: parseInt(qty, 10) })
    setQty('')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 10, alignItems: 'end' }}>
      <div>
        <label style={st.label}>Insumo</label>
        <select value={name} onChange={e => setName(e.target.value)} style={st.select}>
          <option value="">Seleccioná un insumo…</option>
          {items.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div>
        <label style={st.label}>Nuevo stock</label>
        <input
          type="number" min="0" value={qty}
          onChange={e => setQty(e.target.value)}
          placeholder="0" style={st.input}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
      </div>
      <button onClick={add} disabled={!name || qty === ''} style={{ ...st.btnAdd, opacity: (!name || qty === '') ? 0.45 : 1 }}>
        + Agregar
      </button>
    </div>
  )
}

function EquipmentForm({ types, prefill, onAdd }) {
  const [type,      setType]      = useState(prefill?.type      || '')
  const [number,    setNumber]    = useState(prefill?.number    || '')
  const [condition, setCondition] = useState(prefill?.condition || 'good')
  const [notes,     setNotes]     = useState(prefill?.notes     || '')

  useEffect(() => {
    if (prefill?.type)      setType(prefill.type)
    if (prefill?.number)    setNumber(prefill.number)
    if (prefill?.condition) setCondition(prefill.condition)
  }, [prefill])

  function add() {
    if (!type.trim()) return
    onAdd({ type: type.trim(), number: number.trim(), condition, notes: notes.trim() })
    setNumber(''); setNotes('')
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={st.label}>Tipo</label>
          <input list="eq-types" value={type} onChange={e => setType(e.target.value)} placeholder="ej. Morral" style={st.input} />
          <datalist id="eq-types">{types.map(t => <option key={t} value={t} />)}</datalist>
        </div>
        <div>
          <label style={st.label}>Número</label>
          <input value={number} onChange={e => setNumber(e.target.value)} placeholder="S/N" style={st.input} />
        </div>
        <div>
          <label style={st.label}>Condición</label>
          <select value={condition} onChange={e => setCondition(e.target.value)} style={st.select}>
            <option value="good">Bueno</option>
            <option value="damaged">Dañado</option>
            <option value="unknown">Desconocido</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
        <div>
          <label style={st.label}>Observaciones</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" style={st.input} />
        </div>
        <button onClick={add} disabled={!type.trim()} style={{ ...st.btnAdd, opacity: !type.trim() ? 0.45 : 1 }}>
          + Agregar
        </button>
      </div>
    </div>
  )
}

function BagsForm({ bagNumbers, itemNames, prefill, onAdd }) {
  const [bagNum, setBagNum] = useState(prefill?.bag_number || '')
  const [item,   setItem]   = useState(prefill?.item       || '')
  const [qty,    setQty]    = useState(prefill?.current_quantity != null ? String(prefill.current_quantity) : '')

  useEffect(() => {
    if (prefill?.bag_number)            setBagNum(prefill.bag_number)
    if (prefill?.item)                  setItem(prefill.item)
    if (prefill?.current_quantity != null) setQty(String(prefill.current_quantity))
  }, [prefill])

  function add() {
    if (!bagNum || !item || qty === '') return
    onAdd({ bag_number: bagNum, item, current_quantity: parseInt(qty, 10) })
    setQty('')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px auto', gap: 10, alignItems: 'end' }}>
      <div>
        <label style={st.label}>Morral #</label>
        <select value={bagNum} onChange={e => setBagNum(e.target.value)} style={st.select}>
          <option value="">Nro…</option>
          {bagNumbers.map(n => <option key={n} value={n}>#{n}</option>)}
        </select>
      </div>
      <div>
        <label style={st.label}>Ítem</label>
        <select value={item} onChange={e => setItem(e.target.value)} style={st.select}>
          <option value="">Seleccioná un ítem…</option>
          {itemNames.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div>
        <label style={st.label}>Cantidad</label>
        <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" style={st.input} />
      </div>
      <button onClick={add} disabled={!bagNum || !item || qty === ''} style={{ ...st.btnAdd, opacity: (!bagNum || !item || qty === '') ? 0.45 : 1 }}>
        + Agregar
      </button>
    </div>
  )
}

// ── Componente de voz ─────────────────────────────────────────────────────────
function VoiceTab({ section, loadedData, onParsed }) {
  const [listening,   setListening]   = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const [parsed,      setParsed]      = useState(null)  // null | [] | [change]
  const recRef = useRef(null)

  if (!hasSpeechAPI) {
    return (
      <div style={{ padding: '16px 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text)' }}>Reconocimiento de voz no disponible.</strong><br />
        Esta función requiere <strong>Chrome</strong> o <strong>Edge</strong>. En Firefox y Safari
        solo está disponible el modo Formulario.
      </div>
    )
  }

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'es-AR'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    let lastTranscript = ''

    rec.onstart  = () => { setListening(true); setTranscript(''); setParsed(null) }
    rec.onresult = (e) => {
      lastTranscript = Array.from(e.results).map(r => r[0].transcript).join(' ')
      setTranscript(lastTranscript)
    }
    rec.onend    = () => {
      setListening(false)
      if (lastTranscript) {
        const result = parseVoice(lastTranscript, section, loadedData)
        setParsed(result)
      }
    }
    rec.onerror  = () => setListening(false)
    rec.start()
    recRef.current = rec
  }

  function stop() { recRef.current?.stop() }

  const detected = parsed && parsed.length > 0

  return (
    <div>
      {/* Mic button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={listening ? stop : start}
          style={{
            padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'var(--font-family)', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            border: `2px solid ${listening ? '#ef4444' : '#E8112D'}`,
            background: listening ? 'rgba(239,68,68,0.08)' : 'rgba(232,17,45,0.07)',
            color: listening ? '#ef4444' : '#E8112D',
            transition: 'all 0.2s',
          }}
        >
          {listening
            ? <><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} /> Escuchando… (detener)</>
            : <>🎙️ Empezar a dictar</>
          }
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Hablá claro, ej:<br /><em>"Guantes M cincuenta"</em>
        </span>
      </div>

      {/* Transcript */}
      {transcript && (
        <div style={{ marginBottom: 12 }}>
          <label style={st.label}>Texto reconocido</label>
          <div style={{
            padding: '9px 13px', borderRadius: 8, fontSize: 14, fontStyle: 'italic',
            background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
          }}>
            "{transcript}"
          </div>
        </div>
      )}

      {/* Result */}
      {parsed !== null && (
        detected ? (
          <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(22,163,74,0.25)', background: 'rgba(22,163,74,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Cambio detectado</div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'monospace' }}>
                {JSON.stringify(parsed[0])}
              </div>
            </div>
            <button
              onClick={() => { onParsed(parsed); setParsed(null); setTranscript('') }}
              style={{ ...st.btnAdd, flexShrink: 0 }}
            >
              Usar →
            </button>
          </div>
        ) : (
          <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', fontSize: 13, color: '#b45309' }}>
            No se pudo interpretar automáticamente. Intentá de nuevo o usá el modo Formulario.
          </div>
        )
      )}
    </div>
  )
}

// ── Lista de cambios acumulados ───────────────────────────────────────────────
function ChangeItem({ change, section, onRemove }) {
  const COND = { good: 'Bueno', damaged: 'Dañado', unknown: 'Desconocido' }
  let label
  if (section === 'supplies')
    label = `${change.name}  →  ${change.new_stock} unidades`
  else if (section === 'equipment')
    label = `${change.type}${change.number ? ' #' + change.number : ''} → ${COND[change.condition]}${change.notes ? ` (${change.notes})` : ''}`
  else
    label = `Morral #${change.bag_number} · ${change.item} → ${change.current_quantity}`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 12px', borderRadius: 6, marginBottom: 6,
      background: 'rgba(232,17,45,0.05)', border: '1px solid rgba(232,17,45,0.15)',
      fontSize: 13, color: 'var(--text)',
    }}>
      <span>{label}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
const SECTION_LABEL = { supplies: 'insumos', equipment: 'equipamiento', bags: 'morrales' }

export default function AIInput({ section, onChangesApplied }) {
  const { user } = useAuth()

  const [open,        setOpen]       = useState(false)
  const [mode,        setMode]       = useState('form')  // 'form' | 'voice'
  const [loadedData,  setLoadedData] = useState(null)
  const [loadingData, setLoading]    = useState(false)
  const [prefill,     setPrefill]    = useState(null)    // datos pre-llenados desde voz
  const [changes,     setChanges]    = useState([])
  const [confirming,  setConfirming] = useState(false)
  const [applying,    setApplying]   = useState(false)
  const [success,     setSuccess]    = useState(false)
  const [error,       setError]      = useState(null)

  // Carga de datos al abrir el panel
  useEffect(() => {
    if (!open || loadedData !== null) return
    setLoading(true)

    if (section === 'supplies') {
      supabase.from('supplies').select('name').order('name')
        .then(({ data }) => { setLoadedData(data?.map(s => s.name) || []); setLoading(false) })
    } else if (section === 'equipment') {
      supabase.from('equipment').select('type')
        .then(({ data }) => {
          setLoadedData([...new Set(data?.map(e => e.type) || [])].sort())
          setLoading(false)
        })
    } else {
      Promise.all([
        supabase.from('bags').select('bag_number').order('bag_number'),
        supabase.from('bag_type_items').select('item_name'),
      ]).then(([bags, items]) => {
        setLoadedData({
          bagNumbers: bags.data?.map(b => b.bag_number) || [],
          itemNames:  [...new Set(items.data?.map(i => i.item_name) || [])].sort(),
        })
        setLoading(false)
      })
    }
  }, [open, section, loadedData])

  function addChange(change) {
    setChanges(prev => [...prev, change])
    setPrefill(null)
    setSuccess(false)
    setError(null)
  }

  // La voz pre-llena el formulario; el usuario revisa antes de agregar
  function handleVoiceParsed(parsed) {
    setPrefill(parsed[0] || null)
    setMode('form')
  }

  async function applyAll() {
    if (!changes.length) return
    setApplying(true)
    setError(null)
    try {
      if (section === 'supplies') {
        for (const c of changes)
          await supabase.from('supplies')
            .update({ current_stock: c.new_stock, updated_at: new Date().toISOString() })
            .ilike('name', c.name)

      } else if (section === 'equipment') {
        for (const c of changes) {
          const upd = { condition: c.condition, updated_at: new Date().toISOString() }
          if (c.notes) upd.notes = c.notes
          let q = supabase.from('equipment').update(upd).ilike('type', c.type)
          if (c.number) q = q.eq('item_number', c.number)
          await q
        }
      } else {
        for (const c of changes) {
          const { data: bag } = await supabase.from('bags').select('id').eq('bag_number', c.bag_number).single()
          if (bag)
            await supabase.from('bag_contents')
              .update({ current_quantity: c.current_quantity })
              .eq('bag_id', bag.id)
              .ilike('item_name', `%${c.item}%`)
        }
      }

      await supabase.from('activity_log').insert({
        user_id:     user.id,
        action_type: 'manual_update',
        description: `[${SECTION_LABEL[section]}] ${changes.length} cambio(s) manual(es)`,
      })

      setSuccess(true)
      setChanges([])
      setConfirming(false)
      onChangesApplied?.()
    } catch (err) {
      setError('Error al aplicar cambios: ' + err.message)
    } finally {
      setApplying(false)
    }
  }

  const arrayItems   = Array.isArray(loadedData) ? loadedData : []
  const bagNumbers   = loadedData?.bagNumbers   || []
  const itemNames    = loadedData?.itemNames    || []

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>

      {/* ── Cabecera / toggle ── */}
      <button
        onClick={() => { setOpen(o => !o); setSuccess(false); setError(null) }}
        style={{
          width: '100%', padding: '14px 20px', background: 'transparent',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: 10, fontFamily: 'var(--font-family)', color: 'var(--text)',
        }}
      >
        <span style={{ fontSize: 15 }}>📋</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Registrar cambios en {SECTION_LABEL[section]}
        </span>
        {changes.length > 0 && (
          <span style={{ padding: '2px 8px', borderRadius: 20, background: '#E8112D', color: 'white', fontSize: 11, fontWeight: 700 }}>
            {changes.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {/* ── Cuerpo ── */}
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>

          {/* Tabs Formulario / Voz */}
          <div style={{ display: 'flex', gap: 4, marginTop: 16, marginBottom: 18 }}>
            {(['form', ...(hasSpeechAPI ? ['voice'] : [])]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-family)',
                  border: '1px solid var(--border)',
                  background: mode === m ? '#E8112D' : 'transparent',
                  color:      mode === m ? 'white'   : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'form' ? '⌨️ Formulario' : '🎙️ Voz'}
              </button>
            ))}
          </div>

          {/* Hint voz → form */}
          {prefill && mode === 'form' && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 7, border: '1px solid rgba(232,17,45,0.25)', background: 'rgba(232,17,45,0.05)', fontSize: 12, color: '#E8112D', fontWeight: 500 }}>
              ✦ Campos pre-llenados desde voz — revisá y hacé clic en "+ Agregar"
            </div>
          )}

          {/* Contenido por modo */}
          {loadingData ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Cargando datos…</div>
          ) : mode === 'form' ? (
            section === 'supplies' ? (
              <SuppliesForm  items={arrayItems}                          prefill={prefill} onAdd={addChange} />
            ) : section === 'equipment' ? (
              <EquipmentForm types={arrayItems}                          prefill={prefill} onAdd={addChange} />
            ) : (
              <BagsForm bagNumbers={bagNumbers} itemNames={itemNames}   prefill={prefill} onAdd={addChange} />
            )
          ) : (
            <VoiceTab section={section} loadedData={loadedData} onParsed={handleVoiceParsed} />
          )}

          {/* Lista de cambios acumulados */}
          {changes.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                Cambios a aplicar ({changes.length})
              </div>
              {changes.map((c, i) => (
                <ChangeItem key={i} change={c} section={section} onRemove={() => setChanges(p => p.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}

          {/* Feedback */}
          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(22,163,74,0.25)', background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: 13, fontWeight: 500 }}>
              ✓ Cambios aplicados correctamente
            </div>
          )}

          {/* Botones de acción */}
          {changes.length > 0 && !confirming && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setChanges([]); setPrefill(null) }} style={st.btnSecondary}>
                Limpiar
              </button>
              <button onClick={() => setConfirming(true)} style={st.btnPrimary}>
                Confirmar {changes.length} cambio{changes.length > 1 ? 's' : ''} →
              </button>
            </div>
          )}

          {confirming && (
            <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 8, border: '1px solid rgba(232,17,45,0.2)', background: 'rgba(232,17,45,0.04)' }}>
              <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
                ¿Aplicar <strong>{changes.length} cambio{changes.length > 1 ? 's' : ''}</strong> a la base de datos?
                Esta acción no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirming(false)} disabled={applying} style={st.btnSecondary}>
                  Cancelar
                </button>
                <button onClick={applyAll} disabled={applying} style={st.btnPrimary}>
                  {applying ? 'Aplicando…' : 'Sí, confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
