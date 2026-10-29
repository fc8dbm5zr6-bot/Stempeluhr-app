import { useState, useRef } from 'react'
import { db } from '../db'
import { useVacations, useSettings } from '../hooks/useTimeEntries'

const TYPES = ['Urlaub', 'Freizeitausgleich', 'Krankheit', 'Feiertag']

export default function VacationManager({ onClose }) {
  const vSwipe = useRef(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [editVac, setEditVac] = useState(null)
  const [editingOverride, setEditingOverride] = useState(false)
  const [overrideValue, setOverrideValue] = useState('')
  const vacations = useVacations(year)
  const settings = useSettings()

  const workDays = settings?.workDays || [1, 2, 3, 4, 5]
  const defaultDays = settings?.vacationDaysPerYear || 30
  const overrides = settings?.vacationOverrides || {}
  const hasOverride = overrides[String(year)] !== undefined
  const vacationDaysTotal = hasOverride ? overrides[String(year)] : defaultDays

  function countWorkDaysInRange(start, end) {
    let count = 0
    const d = new Date(start)
    const e = new Date(end)
    while (d <= e) {
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      if (workDays.includes(dow)) count++
      d.setDate(d.getDate() + 1)
    }
    return count
  }

  const usedVacation = (vacations || [])
    .filter(v => v.type === 'Urlaub')
    .reduce((sum, v) => sum + countWorkDaysInRange(v.startDate, v.endDate), 0)

  const usedFZA = (vacations || [])
    .filter(v => v.type === 'Freizeitausgleich')
    .reduce((sum, v) => sum + countWorkDaysInRange(v.startDate, v.endDate), 0)

  const remainingVacation = vacationDaysTotal - usedVacation

  const grouped = {}
  ;(vacations || []).forEach(v => {
    if (!grouped[v.type]) grouped[v.type] = []
    grouped[v.type].push(v)
  })

  return (
    <div className="page" onTouchStart={e => { vSwipe.current = e.touches[0].clientX }} onTouchEnd={e => {
      if (vSwipe.current !== null && e.changedTouches[0].clientX - vSwipe.current > 100) onClose()
      vSwipe.current = null
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 24, cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Abwesenheiten</h1>
        <button onClick={() => { setEditVac(null); setShowForm(true) }} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 24, cursor: 'pointer' }}>+</button>
      </div>

      {/* Year selector */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        <button onClick={() => setYear(y => y - 1)} style={yearBtn}>←</button>
        <span style={{ fontSize: 20, fontWeight: 600 }}>{year}</span>
        <button onClick={() => setYear(y => y + 1)} style={yearBtn}>→</button>
      </div>

      {/* Urlaubskonto */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Urlaubskonto {year}</div>

        {/* Genereller Anspruch */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Genereller Anspruch</span>
          {editingOverride !== 'default' ? (
            <button onClick={() => setEditingOverride('default')} style={{
              background: 'none', border: 'none', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0,
            }}>{defaultDays} Tage ✎</button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={overrideValue || defaultDays}
                onChange={e => setOverrideValue(e.target.value)}
                style={{ width: 60, padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--divider)', borderRadius: 6, color: 'var(--text)', fontSize: 14, textAlign: 'center', outline: 'none' }}
                min={0} max={365}
              />
              <button onClick={async () => {
                const val = parseInt(overrideValue)
                if (!isNaN(val) && val > 0) await db.settings.update(settings.id, { vacationDaysPerYear: val })
                setEditingOverride(false)
              }} style={{ background: 'var(--green)', border: 'none', color: '#000', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>OK</button>
            </div>
          )}
        </div>
        <div style={{ borderBottom: '1px solid var(--divider)' }} />

        {/* Anspruch dieses Jahr */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Anspruch {year}</span>
          {editingOverride !== 'year' ? (
            <button onClick={() => { setOverrideValue(String(remainingVacation)); setEditingOverride('year') }} style={{
              background: 'none', border: 'none', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0,
            }}>{vacationDaysTotal} Tage{hasOverride ? ' ✎' : ''}</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Verbleibend für {year}:</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" value={overrideValue}
                  onChange={e => setOverrideValue(e.target.value)}
                  style={{ width: 60, padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--divider)', borderRadius: 6, color: 'var(--text)', fontSize: 14, textAlign: 'center', outline: 'none' }}
                  min={0} max={365}
                />
                <button onClick={async () => {
                  const val = parseInt(overrideValue)
                  if (!isNaN(val) && val >= 0) {
                    const total = val + usedVacation
                    const newOverrides = { ...overrides, [String(year)]: total }
                    await db.settings.update(settings.id, { vacationOverrides: newOverrides })
                  }
                  setEditingOverride(false)
                }} style={{ background: 'var(--green)', border: 'none', color: '#000', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>OK</button>
                {hasOverride && (
                  <button onClick={async () => {
                    const newOverrides = { ...overrides }
                    delete newOverrides[String(year)]
                    await db.settings.update(settings.id, { vacationOverrides: newOverrides })
                    setEditingOverride(false)
                  }} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer', padding: 0 }}>↺</button>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ borderBottom: '1px solid var(--divider)' }} />

        {/* Genommen / Restlich */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Genommen</span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{usedVacation} Tage</span>
        </div>
        <div style={{ borderBottom: '1px solid var(--divider)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Restlich</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: remainingVacation > 0 ? 'var(--green)' : 'var(--red)' }}>
            {remainingVacation} Tage
          </span>
        </div>
        {usedFZA > 0 && (
          <>
            <div style={{ borderBottom: '1px solid var(--divider)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Freizeitausgleich</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--orange)' }}>{usedFZA} Tage</span>
            </div>
          </>
        )}
      </div>

      {/* Groups */}
      {TYPES.filter(t => grouped[t]).map(type => (
        <div key={type} style={{ marginBottom: 16 }}>
          <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
              <span style={{ fontWeight: 600 }}>{type}</span>
              <span style={{
                background: type === 'Freizeitausgleich' ? 'var(--orange)' : 'var(--blue)',
                color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 13, fontWeight: 600,
              }}>
                {grouped[type].reduce((s, v) => s + countWorkDaysInRange(v.startDate, v.endDate), 0)}
              </span>
            </div>
            {grouped[type].map(v => {
              const start = new Date(v.startDate)
              const end = new Date(v.endDate)
              const wd = countWorkDaysInRange(v.startDate, v.endDate)
              return (
                <button
                  key={v.id}
                  onClick={() => { setEditVac(v); setShowForm(true) }}
                  style={{
                    width: '100%', padding: '12px 16px', background: 'none',
                    border: 'none', borderBottom: '1px solid var(--divider)',
                    color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>
                    {start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })} bis {end.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {wd} Arbeitstage
                  </div>
                  {v.note && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{v.note}</div>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {(!vacations || vacations.length === 0) && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 40 }}>
          Keine Abwesenheiten in {year}
        </div>
      )}

      {showForm && (
        <VacationForm
          vacation={editVac}
          onSave={async (data) => {
            if (editVac) {
              await db.vacations.update(editVac.id, data)
            } else {
              await db.vacations.add(data)
            }
            setShowForm(false)
            setEditVac(null)
          }}
          onDelete={editVac ? async () => {
            await db.vacations.delete(editVac.id)
            setShowForm(false)
            setEditVac(null)
          } : null}
          onCancel={() => { setShowForm(false); setEditVac(null) }}
        />
      )}
    </div>
  )
}

function VacationForm({ vacation, onSave, onDelete, onCancel }) {
  const [type, setType] = useState(vacation?.type || 'Urlaub')
  const [startDate, setStartDate] = useState(vacation?.startDate || new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(vacation?.endDate || new Date().toISOString().split('T')[0])
  const [note, setNote] = useState(vacation?.note || '')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
          {vacation ? 'Abwesenheit bearbeiten' : 'Neue Abwesenheit'}
        </h2>

        <label style={fLabelStyle}>Typ</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: t === 'Freizeitausgleich' ? '1 1 100%' : 1,
              padding: '10px 0', borderRadius: 8, border: 'none',
              background: type === t ? (t === 'Freizeitausgleich' ? 'var(--orange)' : 'var(--blue)') : 'var(--bg-input)',
              color: type === t ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t === 'Freizeitausgleich' ? '⏱ Überstunden abfeiern' : t}</button>
          ))}
        </div>

        <label style={fLabelStyle}>Von</label>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value) }} style={fInputStyle} />

        <label style={{ ...fLabelStyle, marginTop: 12 }}>Bis</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={fInputStyle} />

        <label style={{ ...fLabelStyle, marginTop: 12 }}>Notiz</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" style={fInputStyle} />

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {onDelete && (
            <button onClick={onDelete} style={{
              padding: '12px 16px', borderRadius: 10, border: 'none',
              background: 'var(--bg-input)', color: 'var(--red)', fontSize: 14, cursor: 'pointer',
            }}>🗑</button>
          )}
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid var(--divider)',
            background: 'transparent', color: 'var(--text)', fontSize: 14, cursor: 'pointer',
          }}>Abbrechen</button>
          <button onClick={() => onSave({ type, startDate, endDate, note })} style={{
            flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
            background: 'var(--green)', color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Speichern</button>
        </div>
      </div>
    </div>
  )
}

const yearBtn = {
  background: 'var(--olive)', border: 'none', color: '#000',
  borderRadius: 20, width: 36, height: 36, fontSize: 18, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const fLabelStyle = {
  display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6,
}

const fInputStyle = {
  width: '100%', padding: '12px 14px', background: 'var(--bg-input)',
  border: '1px solid var(--divider)', borderRadius: 10, color: 'var(--text)',
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
}
