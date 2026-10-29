import { useState, useRef } from 'react'
import { db } from '../db'
import { useSettings } from '../hooks/useTimeEntries'

function getMultipliers(settings) {
  const vals = settings?.multipliers || [1, 1.25, 1.5, 2]
  return vals.map(v => ({
    value: v,
    label: v === 1 ? '1x' : `${String(v).replace('.', ',')}x`,
    desc: v === 1 ? 'Normal' : `+${Math.round((v - 1) * 100)}%`,
  }))
}

export default function EditEntryModal({ entry, date, onClose, onDelete }) {
  const settings = useSettings()
  const MULTIPLIERS = getMultipliers(settings)
  const isRunning = !entry.endTime
  const startDate = new Date(entry.startTime)
  const endDate = entry.endTime ? new Date(entry.endTime) : null

  const [startStr, setStartStr] = useState(
    `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`
  )
  const [endStr, setEndStr] = useState(
    endDate ? `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}` : ''
  )
  const [type, setType] = useState(entry.type)
  const [comment, setComment] = useState(entry.comment || '')
  const [multiplier, setMultiplier] = useState(entry.multiplier || 1)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [pendingMultiplier, setPendingMultiplier] = useState(null)

  const touchStart = useRef(null)
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = e.changedTouches[0].clientX - touchStart.current
    if (diff > 100) onClose()
    touchStart.current = null
  }

  function handleMultiplierChange(val) {
    setPendingMultiplier(val)
    setShowApplyDialog(true)
  }

  async function applyMultiplier(wholeDay) {
    if (wholeDay) {
      await db.timeEntries
        .where('date').equals(date)
        .filter(e => e.type === 'work')
        .modify({ multiplier: pendingMultiplier })
    }
    setMultiplier(pendingMultiplier)
    setShowApplyDialog(false)
    setPendingMultiplier(null)
  }

  async function handleSave() {
    const [sh, sm] = startStr.split(':').map(Number)
    const [y, mo, d] = date.split('-').map(Number)
    const newStart = new Date(y, mo - 1, d, sh, sm, 0, 0)

    const updates = {
      startTime: newStart.toISOString(),
      type,
      comment,
      multiplier,
    }

    if (!isRunning && endStr) {
      const [eh, em] = endStr.split(':').map(Number)
      const newEnd = new Date(y, mo - 1, d, eh, em, 0, 0)
      if (newEnd <= newStart) newEnd.setDate(newEnd.getDate() + 1)
      updates.endTime = newEnd.toISOString()
    }

    await db.timeEntries.update(entry.id, updates)
    onClose()
  }

  const duration = (() => {
    if (isRunning || !endStr) return 'läuft...'
    const [sh, sm] = startStr.split(':').map(Number)
    const [eh, em] = endStr.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 1440
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0 && m > 0) return `${h}Std. ${m}Min.`
    if (h > 0) return `${h}Std.`
    return `${m}Min.`
  })()

  const effectiveDuration = (() => {
    const [sh, sm] = startStr.split(':').map(Number)
    const [eh, em] = endStr.split(':').map(Number)
    const mins = Math.round(((eh * 60 + em) - (sh * 60 + sm)) * multiplier)
    if (mins <= 0) return null
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0 && m > 0) return `${h}Std. ${m}Min.`
    if (h > 0) return `${h}Std.`
    return `${m}Min.`
  })()

  return (
    <div className="page-fullscreen-high" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
          {new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
        </h1>

        {/* Zeiten */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{isRunning ? 'Startzeit' : 'Zeiten'}</span>
            <span style={{ fontSize: 16, color: isRunning ? 'var(--green)' : 'var(--text-secondary)' }}>{duration}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input type="time" value={startStr} onChange={e => setStartStr(e.target.value)} style={timeInputStyle} />
            {!isRunning && (
              <input type="time" value={endStr} onChange={e => setEndStr(e.target.value)} style={timeInputStyle} />
            )}
          </div>
          {isRunning && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              Endzeit wird durch Pause/Stopp gesetzt
            </div>
          )}
        </div>

        {/* Type toggle */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 12 }}>Typ</div>
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 10, overflow: 'hidden' }}>
            <button onClick={() => setType('work')} style={{
              flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
              background: type === 'work' ? 'var(--bg-card-hover)' : 'transparent',
              color: 'var(--text)', fontSize: 14, fontWeight: type === 'work' ? 600 : 400,
            }}>Arbeitszeit</button>
            <button onClick={() => setType('pause')} style={{
              flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
              background: type === 'pause' ? 'var(--bg-card-hover)' : 'transparent',
              color: 'var(--text)', fontSize: 14, fontWeight: type === 'pause' ? 600 : 400,
            }}>Pause</button>
          </div>
        </div>

        {/* Zuschlag */}
        {type === 'work' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Zuschlag</span>
              {multiplier > 1 && effectiveDuration && (
                <span style={{ fontSize: 13, color: 'var(--orange)' }}>= {effectiveDuration} angerechnet</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {MULTIPLIERS.map(m => (
                <button key={m.value} onClick={() => {
                  if (m.value !== multiplier) handleMultiplierChange(m.value)
                  else { setMultiplier(m.value); }
                }} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: multiplier === m.value
                    ? (m.value > 1 ? 'var(--orange)' : 'var(--blue)')
                    : 'var(--bg-input)',
                  color: multiplier === m.value ? '#fff' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  <div>{m.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 12 }}>Kommentar</div>
          <input
            type="text" value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Kein Kommentar"
            style={{
              width: '100%', padding: '14px 16px', background: 'var(--card)',
              border: '1px solid var(--divider)', borderRadius: 10, color: 'var(--text)',
              fontSize: 15, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onDelete} style={{
            width: 56, height: 56, borderRadius: 12, border: 'none',
            background: 'var(--card)', color: 'var(--red)', fontSize: 22,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🗑</button>
          <button onClick={onClose} style={{
            flex: 1, padding: '16px 0', borderRadius: 12, border: '1px solid var(--divider)',
            background: 'transparent', color: 'var(--text)', fontSize: 16, cursor: 'pointer',
          }}>Abbrechen</button>
          <button onClick={handleSave} style={{
            flex: 1, padding: '16px 0', borderRadius: 12, border: 'none',
            background: 'var(--green)', color: '#000', fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}>Speichern</button>
        </div>

        {/* Apply to whole day dialog */}
        {showApplyDialog && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}>
            <div style={{
              background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                Zuschlag {MULTIPLIERS.find(m => m.value === pendingMultiplier)?.label}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                Soll der Zuschlag für alle Einträge an diesem Tag gelten?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => applyMultiplier(true)} style={{
                  padding: '14px 0', borderRadius: 10, border: 'none',
                  background: 'var(--orange)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}>Für den ganzen Tag</button>
                <button onClick={() => applyMultiplier(false)} style={{
                  padding: '14px 0', borderRadius: 10, border: 'none',
                  background: 'var(--blue)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}>Nur dieser Eintrag</button>
                <button onClick={() => { setShowApplyDialog(false); setPendingMultiplier(null) }} style={{
                  padding: '14px 0', borderRadius: 10, border: '1px solid var(--divider)',
                  background: 'transparent', color: 'var(--text)', fontSize: 15, cursor: 'pointer',
                }}>Abbrechen</button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

const timeInputStyle = {
  flex: 1, padding: '14px 16px', background: 'var(--card)',
  border: '1px solid var(--divider)', borderRadius: 10, color: 'var(--text)',
  fontSize: 18, fontWeight: 500, textAlign: 'center', outline: 'none',
}
