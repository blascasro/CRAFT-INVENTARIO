import { useState, useEffect, useCallback } from 'react'
import { supabase, withTimeout } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import AIInput from '../components/AIInput'
import ExportButton from '../components/ExportButton'

function completeness(contents) {
  if (!contents || contents.length === 0) return 0
  const ideal = contents.reduce((s, c) => s + c.ideal_quantity, 0)
  const actual = contents.reduce((s, c) => s + c.current_quantity, 0)
  if (ideal === 0) return 100
  return Math.min(100, Math.round((actual / ideal) * 100))
}

function pctColor(p) {
  if (p >= 90) return '#16a34a'
  if (p >= 50) return '#d97706'
  return '#ef4444'
}

function BagCard({ bag, canEdit, isAdmin, onUpdate, onDelete }) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)

  const pct = completeness(bag.bag_contents)
  const color = pctColor(pct)

  const missingItems = (bag.bag_contents || []).filter(
    c => c.current_quantity < c.ideal_quantity
  )

  function startEdit() {
    const map = {}
    bag.bag_contents?.forEach(c => { map[c.id] = c.current_quantity })
    setValues(map)
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true)

    // Capture changed items from React state before applying updates
    const changedItems = (bag.bag_contents || []).filter(c => {
      const newQty = parseInt(values[c.id], 10) || 0
      return newQty !== c.current_quantity
    })

    const updates = Object.entries(values).map(([id, qty]) =>
      supabase.from('bag_contents').update({ current_quantity: parseInt(qty, 10) || 0 }).eq('id', parseInt(id, 10))
    )
    await Promise.all(updates)

    const newPct = completeness(
      bag.bag_contents?.map(c => ({ ...c, current_quantity: parseInt(values[c.id], 10) || 0 }))
    )
    const newCondition = newPct >= 100 ? 'complete' : newPct > 0 ? 'incomplete' : 'damaged'
    await supabase.from('bags').update({ condition: newCondition, updated_at: new Date().toISOString() }).eq('id', bag.id)

    if (changedItems.length > 0 && user) {
      const parts = changedItems.map(c =>
        `${c.item_name}: ${c.current_quantity} → ${parseInt(values[c.id], 10) || 0}`
      )
      const { error: logErr } = await supabase.from('activity_log').insert({
        user_id:     user.id,
        action_type: 'manual_update',
        description: `[morrales] Morral ${bag.bag_number} — ${parts.join(' | ')}`,
      })
      if (logErr) console.error('[activity_log] insert failed:', logErr)
    }

    setSaving(false)
    setEditing(false)
    onUpdate?.()
  }

  const conditionMeta = {
    complete:   { label: 'Completo',   color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    incomplete: { label: 'Incompleto', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
    damaged:    { label: 'Dañado',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  }
  const cm = conditionMeta[bag.condition] || conditionMeta.incomplete

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Card header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: pct < 90 ? `rgba(${pct < 50 ? '239,68,68' : '217,119,6'},0.04)` : 'transparent',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Morral #{bag.bag_number}
            </span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: cm.bg, color: cm.color, fontWeight: 600 }}>
              {cm.label}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {bag.bag_type?.name || 'Morral estándar'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>completo</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>

      {/* Items list */}
      <div style={{ padding: '12px 18px', flex: 1, overflow: 'auto', maxHeight: 280 }}>
        {missingItems.length === 0 && !editing && (
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 500, padding: '4px 0' }}>
            ✓ Todo completo
          </div>
        )}
        {(editing ? bag.bag_contents || [] : missingItems).map(item => (
          <div key={item.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
            borderBottom: '1px solid var(--border)',
            gap: 10,
          }}>
            <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{item.item_name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {editing ? (
                <input
                  type="number"
                  min="0"
                  value={values[item.id] ?? item.current_quantity}
                  onChange={e => setValues(v => ({ ...v, [item.id]: e.target.value }))}
                  style={{
                    width: 60,
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    textAlign: 'center',
                    outline: 'none',
                    fontFamily: 'var(--font-family)',
                  }}
                />
              ) : (
                <span style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: item.current_quantity < item.ideal_quantity ? '#ef4444' : '#16a34a',
                }}>
                  {item.current_quantity}
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {item.ideal_quantity}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Card footer */}
      {(canEdit || isAdmin) && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={saving}>
                  Cancelar
                </button>
                <button onClick={saveEdit} className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            ) : (
              <button onClick={startEdit} className="btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }}>
                Editar cantidades
              </button>
            )}
          </div>
          {isAdmin && !editing && (
            <button
              onClick={() => onDelete?.(bag)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid rgba(239,68,68,0.35)',
                background: 'rgba(239,68,68,0.06)',
                color: '#ef4444',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
                fontWeight: 500,
              }}
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Bags() {
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const canEdit = isAdmin || profile?.role === 'volunteer'
  const [bags, setBags] = useState([])
  const [bagTypes, setBagTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addingType, setAddingType] = useState(null) // bag_type id currently being added

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [bagsRes, typesRes] = await Promise.all([
        withTimeout(
          supabase
            .from('bags')
            .select('*, bag_type_id, bag_type:bag_types(id, name), bag_contents(*)')
            .order('bag_number')
        ),
        withTimeout(
          supabase.from('bag_types').select('*').order('name')
        ),
      ])
      if (bagsRes.error) throw new Error(bagsRes.error.message)
      if (typesRes.error) throw new Error(typesRes.error.message)
      setBags(bagsRes.data || [])
      setBagTypes(typesRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function addBag(bagType) {
    setAddingType(bagType.id)
    try {
      // Find next bag_number for this type
      const bagsOfType = bags.filter(b => b.bag_type_id === bagType.id)
      const maxNum = bagsOfType.reduce((max, b) => Math.max(max, b.bag_number || 0), 0)
      const newNumber = maxNum + 1

      // Insert bag
      const { data: newBag, error: bagErr } = await supabase
        .from('bags')
        .insert({
          bag_number:  newNumber,
          bag_type_id: bagType.id,
          condition:   'incomplete',
        })
        .select()
        .single()
      if (bagErr) throw new Error(bagErr.message)

      // Fetch template items for this bag type
      const { data: templateItems, error: tplErr } = await supabase
        .from('bag_type_items')
        .select('*')
        .eq('bag_type_id', bagType.id)
      if (tplErr) throw new Error(tplErr.message)

      // Insert bag_contents from template with current_quantity = 0
      if (templateItems && templateItems.length > 0) {
        const contents = templateItems.map(t => ({
          bag_id:           newBag.id,
          item_name:        t.item_name,
          ideal_quantity:   t.ideal_quantity,
          current_quantity: 0,
        }))
        const { error: contErr } = await supabase.from('bag_contents').insert(contents)
        if (contErr) throw new Error(contErr.message)
      }

      // Log to activity_log
      if (user) {
        const { error: logErr } = await supabase.from('activity_log').insert({
          user_id:     user.id,
          action_type: 'manual_update',
          description: `[morrales] Morral ${newNumber} (${bagType.name}) agregado`,
        })
        if (logErr) console.error('[activity_log] insert failed:', logErr)
      }

      await fetchData()
    } catch (err) {
      console.error('Error adding bag:', err)
      alert('Error al agregar morral: ' + err.message)
    } finally {
      setAddingType(null)
    }
  }

  async function deleteBag(bag) {
    const typeName = bag.bag_type?.name || 'Morral'
    if (!window.confirm(`¿Eliminar ${typeName} #${bag.bag_number}? Esta acción no se puede deshacer.`)) return

    const { error: delErr } = await supabase.from('bags').delete().eq('id', bag.id)
    if (delErr) {
      alert('Error al eliminar morral: ' + delErr.message)
      return
    }

    if (user) {
      const { error: logErr } = await supabase.from('activity_log').insert({
        user_id:     user.id,
        action_type: 'manual_update',
        description: `[morrales] Morral ${bag.bag_number} (${typeName}) eliminado`,
      })
      if (logErr) console.error('[activity_log] insert failed:', logErr)
    }

    await fetchData()
  }

  const complete = bags.filter(b => completeness(b.bag_contents) >= 100).length
  const incomplete = bags.filter(b => completeness(b.bag_contents) < 100).length

  const exportSheets = bags.map(b => ({
    name: `Morral ${b.bag_number}`,
    headers: ['Ítem', 'Cantidad ideal', 'Cantidad actual', 'Faltante'],
    data: (b.bag_contents || []).map(c => ({
      'Ítem': c.item_name,
      'Cantidad ideal': c.ideal_quantity,
      'Cantidad actual': c.current_quantity,
      'Faltante': Math.max(0, c.ideal_quantity - c.current_quantity),
    })),
  }))

  const today = new Date().toISOString().split('T')[0]

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Cargando morrales…</div>
  if (error) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</p>
      <button onClick={fetchData} className="btn-secondary" style={{ fontSize: 13 }}>↺ Reintentar conexión</button>
    </div>
  )

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.4px' }}>
            Morrales
          </h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{complete}</span>
              <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 500 }}>completos</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{incomplete}</span>
              <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>incompletos</span>
            </div>
          </div>
        </div>
        {isAdmin && (
          <ExportButton
            sheets={exportSheets}
            filename={`inventario_cruzroja_morrales_${today}.xlsx`}
          />
        )}
      </div>

      {/* Grouped by bag type */}
      {bagTypes.length === 0 && bags.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          No hay morrales registrados.
        </div>
      )}

      {bagTypes.map(bagType => {
        const typeBags = bags.filter(b => b.bag_type_id === bagType.id)
        const typeComplete = typeBags.filter(b => completeness(b.bag_contents) >= 100).length
        const isAdding = addingType === bagType.id

        return (
          <div key={bagType.id} style={{ marginBottom: 36 }}>
            {/* Group header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: '2px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                  {bagType.name}
                </h2>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: 20,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>
                  {typeBags.length} morral{typeBags.length !== 1 ? 'es' : ''}
                </span>
                {typeBags.length > 0 && (
                  <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
                    {typeComplete}/{typeBags.length} completos
                  </span>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => addBag(bagType)}
                  disabled={isAdding}
                  className="btn-primary"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  {isAdding ? 'Agregando…' : '+ Agregar morral'}
                </button>
              )}
            </div>

            {/* Cards grid */}
            {typeBags.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
                No hay morrales de este tipo.
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}>
                {typeBags.map(bag => (
                  <BagCard
                    key={bag.id}
                    bag={bag}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    onUpdate={fetchData}
                    onDelete={deleteBag}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Bags without a known type (fallback) */}
      {bags.filter(b => !bagTypes.find(t => t.id === b.bag_type_id)).length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid var(--border)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Sin tipo asignado</h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {bags
              .filter(b => !bagTypes.find(t => t.id === b.bag_type_id))
              .map(bag => (
                <BagCard
                  key={bag.id}
                  bag={bag}
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  onUpdate={fetchData}
                  onDelete={deleteBag}
                />
              ))
            }
          </div>
        </div>
      )}

      {canEdit && (
        <AIInput section="bags" onChangesApplied={fetchData} />
      )}
    </div>
  )
}
