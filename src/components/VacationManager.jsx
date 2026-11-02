import { useState, useRef } from 'react'
import { db } from '../db'
import { useVacations, useSettings } from '../hooks/useTimeEntries'
import { countAbsenceWorkDays } from '../utils/calculations'

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

  const usedVacation = (vacations || [])
    .filter(v => v.type === 'Urlaub')
    .reduce((sum, v) => sum + countAbsenceWorkDays(v.startDate, v.endDate, workDays, vacations, v.id, v.halfDay), 0)

  const usedFZA = (vacations || [])
    .filter(v => v.type === 'Freizeitausgleich')
    .reduce((sum, v) => sum + countAbsenceWorkDays(v.startDate, v.endDate, workDays, vacations, v.id, v.halfDay), 0)

  const remainingVacation = vacationDaysTotal - usedVacation

  const grouped = {}
  ;(vacations || []).forEach(v => {
    if (!grouped[v.type]) grouped[v.type] = []
    grouped[v.type].push(v)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} onTouchStart={e => { vSwipe.current = e.touches[0].clientX }} onTouchEnd={e => {
      if (vSwipe.current !== null && e.changedTouches[0].clientX - vSwipe.current > 100) onClose()
      vSwipe.current = null
    }}>
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Abwesenheiten</h1>
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
                {grouped[type].reduce((s, v) => s + countAbsenceWorkDays(v.startDate, v.endDate, workDays, vacations, v.id, v.halfDay), 0)}
              </span>
            </div>
            {grouped[type].map(v => {
              const start = new Date(v.startDate)
              const end = new Date(v.endDate)
              const wd = countAbsenceWorkDays(v.startDate, v.endDate, workDays, vacations, v.id, v.halfDay)
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
                    {v.halfDay ? `${wd * 0.5} Arbeitstage (halbe Tage)` : `${wd} Arbeitstage`}
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
          workDays={workDays}
          halfDaysGifted={settings?.halfDaysGifted || false}
          existingVacations={vacations}
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

      {/* Spacer */}
      <div style={{ height: 70 }} />
    </div>{/* end scroll area */}

      {/* Action buttons - fixed between content and nav */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 16,
        padding: '10px 0', flexShrink: 0,
      }}>
        <button onClick={() => {
          if (showForm) { setShowForm(false); setEditVac(null) }
          else onClose()
        }} style={actionBtnStyle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        </button>
        {showForm ? (
          <button onClick={() => {
            const btn = document.querySelector('[data-vac-save]')
            if (btn) btn.click()
          }} style={{ ...actionBtnStyle, background: 'var(--green)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
        ) : (
          <button onClick={() => { setEditVac(null); setShowForm(true) }} style={{ ...actionBtnStyle, background: 'var(--blue)' }}>+</button>
        )}
      </div>
    </div>
  )
}

function VacationForm({ vacation, onSave, onDelete, onCancel, workDays: wd, halfDaysGifted, existingVacations }) {
  const workDays = wd || [1, 2, 3, 4, 5]
  const [type, setType] = useState(vacation?.type || 'Urlaub')
  const [startDate, setStartDate] = useState(vacation?.startDate || null)
  const [endDate, setEndDate] = useState(vacation?.endDate || null)
  const [note, setNote] = useState(vacation?.note || '')
  const [halfDay, setHalfDay] = useState(vacation?.halfDay || false)
  const [calMonth, setCalMonth] = useState(() => {
    const d = vacation?.startDate ? new Date(vacation.startDate) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const isMultiDay = startDate && endDate && startDate !== endDate
  const calDays = buildCalendar(calMonth.year, calMonth.month)
  const MON_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  const [selectPhase, setSelectPhase] = useState(vacation ? 'done' : 'start')

  function handleDayTap(dateStr) {
    if (selectPhase === 'start' || selectPhase === 'done') {
      setStartDate(dateStr)
      setEndDate(dateStr)
      setHalfDay(false)
      setSelectPhase('end')
    } else {
      if (dateStr < startDate) {
        setStartDate(dateStr)
      } else if (dateStr === startDate) {
        setSelectPhase('done')
      } else {
        setEndDate(dateStr)
        setSelectPhase('done')
      }
      if (startDate !== dateStr) setHalfDay(false)
    }
  }

  function isInRange(dateStr) {
    if (!startDate || !endDate) return false
    return dateStr >= startDate && dateStr <= endDate
  }

  function countFormWorkDays() {
    return countAbsenceWorkDays(startDate, endDate, workDays, existingVacations, null, halfDay)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300,
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      padding: '40px 12px 12px',
    }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
          {vacation ? 'Abwesenheit bearbeiten' : 'Neue Abwesenheit'}
        </h2>

        <label style={fLabelStyle}>Typ</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: t === 'Freizeitausgleich' ? '1 1 100%' : 1,
              padding: '10px 0', borderRadius: 8, border: 'none',
              background: type === t ? (t === 'Freizeitausgleich' ? 'var(--orange)' : 'var(--purple)') : 'var(--bg-input)',
              color: type === t ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t === 'Freizeitausgleich' ? '⏱ Überstunden abfeiern' : t}</button>
          ))}
        </div>

        {/* Inline Calendar */}
        <label style={fLabelStyle}>Zeitraum</label>
        <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={() => setCalMonth(m => {
              const nm = m.month - 1
              return nm < 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: nm }
            })} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>←</button>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{MON_NAMES[calMonth.month]} {calMonth.year}</span>
            <button onClick={() => setCalMonth(m => {
              const nm = m.month + 1
              return nm > 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: nm }
            })} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>→</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
              <div key={d} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 0' }}>{d}</div>
            ))}
            {calDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const inRange = isInRange(dateStr)
              const isStart = dateStr === startDate
              const isEnd = dateStr === endDate
              const isOnly = isStart && isEnd
              const dow = new Date(calMonth.year, calMonth.month, day).getDay()
              const isoDow = dow === 0 ? 7 : dow
              const isWorkDay = workDays.includes(isoDow)
              return (
                <div key={day} style={{
                  background: inRange && !isStart && !isEnd ? 'rgba(175, 82, 222, 0.2)' :
                    isStart && !isOnly ? 'linear-gradient(90deg, transparent 50%, rgba(175, 82, 222, 0.2) 50%)' :
                    isEnd && !isOnly ? 'linear-gradient(90deg, rgba(175, 82, 222, 0.2) 50%, transparent 50%)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <button onClick={() => handleDayTap(dateStr)} style={{
                  width: '100%', aspectRatio: '1', borderRadius: isStart || isEnd ? '50%' : 4,
                  border: selectPhase === 'end' && isStart ? '2px dashed var(--purple)' : 'none',
                  cursor: 'pointer',
                  background: isStart || isEnd ? 'var(--purple)' : 'transparent',
                  color: isStart || isEnd ? '#fff' : !isWorkDay ? 'var(--text-muted)' : 'var(--text)',
                  fontSize: 14, fontWeight: isStart || isEnd ? 700 : 400,
                }}>
                  {day}
                </button>
                </div>
              )
            })}
          </div>
          {selectPhase === 'end' && (
            <div style={{ fontSize: 12, color: 'var(--purple)', marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
              Endtag antippen
            </div>
          )}
          {startDate && selectPhase !== 'end' && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>
              {startDate === endDate
                ? new Date(startDate + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
                : `${new Date(startDate + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${new Date(endDate + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
              }
              {' · '}{countFormWorkDays()} Arbeitstage
            </div>
          )}
          {startDate && selectPhase === 'end' && startDate === endDate && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>
              Start: {new Date(startDate + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: isMultiDay ? 'var(--text-muted)' : 'var(--text)' }}>Halber Tag</span>
          <button onClick={() => { if (!isMultiDay) setHalfDay(!halfDay) }} style={{
            width: 51, height: 31, borderRadius: 16, border: 'none',
            background: halfDay ? 'var(--purple)' : 'var(--text-muted)',
            position: 'relative', cursor: isMultiDay ? 'default' : 'pointer',
            transition: 'background 0.3s', opacity: isMultiDay ? 0.4 : 1,
          }}>
            <div style={{
              width: 27, height: 27, borderRadius: 14, background: '#fff',
              position: 'absolute', top: 2, left: halfDay ? 22 : 2, transition: 'left 0.3s',
            }} />
          </button>
        </div>

        <label style={fLabelStyle}>Notiz</label>
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
          <button data-vac-save onClick={() => onSave({ type, startDate, endDate, note, halfDay })} style={{
            flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
            background: 'var(--green)', color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Speichern</button>
        </div>
        <div style={{ height: 180 }} />
      </div>
    </div>
  )
}

const actionBtnStyle = {
  width: 50, height: 50, borderRadius: 25, border: 'none',
  background: '#3a3a3c', color: 'var(--text)', fontSize: 22,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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

function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}
