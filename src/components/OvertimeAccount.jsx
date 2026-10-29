import { useState, useRef } from 'react'
import { db } from '../db'
import { useSettings } from '../hooks/useTimeEntries'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  formatDuration, calculateDailyTarget, calculateWorkedMinutes,
  getWorkingDaysInMonth, isVacationDay, getDayEntries,
} from '../utils/calculations'

export default function OvertimeAccount({ onClose }) {
  const settings = useSettings()
  const allEntries = useLiveQuery(() => db.timeEntries.toArray()) || []
  const allVacations = useLiveQuery(() => db.vacations.toArray()) || []
  const adjustments = useLiveQuery(() => db.overtimeAdjustments.toArray()) || []
  const [showAddForm, setShowAddForm] = useState(false)
  const [adjHours, setAdjHours] = useState('')
  const [adjNote, setAdjNote] = useState('')

  const dailyTarget = settings ? calculateDailyTarget(settings.weeklyHours, settings.workDays) : 480
  const workDays = settings?.workDays || [1, 2, 3, 4, 5]

  const months = getMonthsFromEntries(allEntries)
  const allDates = allEntries.filter(e => e.date).map(e => e.date).sort()
  const firstEntryDate = allDates.length > 0 ? allDates[0] : null
  const today = new Date()

  const monthData = months.map(({ year, month }) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    let workingDays = 0
    let workedMin = 0
    let vacDays = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dateObj = new Date(year, month, d)
      if (firstEntryDate && dateStr < firstEntryDate) continue
      if (dateObj > today) continue
      const dow = dateObj.getDay() === 0 ? 7 : dateObj.getDay()
      if (workDays.includes(dow)) {
        if (isVacationDay(dateObj, allVacations)) {
          vacDays++
        } else {
          workingDays++
        }
      }
      const dayEntries = getDayEntries(allEntries, dateStr)
      workedMin += calculateWorkedMinutes(dayEntries)
    }

    const sollMin = workingDays * dailyTarget
    const diffMin = workedMin - sollMin
    return { year, month, workedMin, sollMin, diffMin }
  })

  const totalDiff = monthData.reduce((s, m) => s + m.diffMin, 0)
  const totalAdj = adjustments.reduce((s, a) => s + a.hours * 60, 0)
  const balance = totalDiff + totalAdj

  const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  async function addAdjustment() {
    const hours = parseFloat(adjHours)
    if (isNaN(hours)) return
    await db.overtimeAdjustments.add({
      date: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`,
      hours,
      note: adjNote,
    })
    setAdjHours('')
    setAdjNote('')
    setShowAddForm(false)
  }

  const touchStart = useRef(null)
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return
    if (e.changedTouches[0].clientX - touchStart.current > 100) onClose()
    touchStart.current = null
  }

  return (
    <div className="page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 24, cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Überstundenkonto</h1>
        <div style={{ width: 24 }} />
      </div>

      {/* Balance */}
      <div style={{
        background: 'var(--card)', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Aktueller Saldo</div>
        <div style={{
          fontSize: 36, fontWeight: 700,
          color: balance >= 0 ? 'var(--green)' : 'var(--red)',
        }}>
          {balance >= 0 ? '+' : ''}{formatDuration(Math.abs(Math.round(balance)))}
        </div>
      </div>

      {/* Monthly breakdown */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, paddingLeft: 4 }}>
          MONATLICHE ÜBERSICHT
        </div>
        <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden' }}>
          {monthData.map((m, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
              borderBottom: i < monthData.length - 1 ? '1px solid #2c2c2e' : 'none',
            }}>
              <span style={{ fontWeight: 500 }}>{MONTH_NAMES[m.month]} {m.year}</span>
              <div style={{ display: 'flex', gap: 20 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Soll: {formatDuration(m.sollMin)}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Ist: {formatDuration(m.workedMin)}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: m.diffMin >= 0 ? 'var(--green)' : 'var(--red)',
                  minWidth: 70, textAlign: 'right',
                }}>
                  {m.diffMin >= 0 ? '+' : ''}{formatDuration(Math.abs(m.diffMin))}
                </span>
              </div>
            </div>
          ))}
          {monthData.length === 0 && (
            <div style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Keine Daten vorhanden
            </div>
          )}
        </div>
      </div>

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, paddingLeft: 4 }}>
            KORREKTUREN
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden' }}>
            {adjustments.map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderBottom: i < adjustments.length - 1 ? '1px solid #2c2c2e' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 14 }}>{a.note || 'Korrektur'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.date}</div>
                </div>
                <span style={{
                  fontWeight: 600, color: a.hours >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {a.hours >= 0 ? '+' : ''}{a.hours}h
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add adjustment */}
      {!showAddForm ? (
        <button onClick={() => setShowAddForm(true)} style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid #3a3a3c',
          background: 'transparent', color: 'var(--text)', fontSize: 15, cursor: 'pointer',
        }}>
          + Korrektur hinzufügen
        </button>
      ) : (
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Stunden (negativ = abgefeiert)
          </label>
          <input
            type="number"
            value={adjHours}
            onChange={e => setAdjHours(e.target.value)}
            placeholder="-2.5"
            step="0.5"
            style={inputStyle}
          />
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, marginTop: 12 }}>
            Notiz
          </label>
          <input
            type="text"
            value={adjNote}
            onChange={e => setAdjNote(e.target.value)}
            placeholder="z.B. Überstunden abgefeiert KW 42"
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button onClick={() => setShowAddForm(false)} style={{
              flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #3a3a3c',
              background: 'transparent', color: 'var(--text)', cursor: 'pointer',
            }}>Abbrechen</button>
            <button onClick={addAdjustment} style={{
              flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
              background: 'var(--green)', color: '#000', fontWeight: 600, cursor: 'pointer',
            }}>Speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}

function getMonthsFromEntries(entries) {
  const set = new Set()
  entries.forEach(e => {
    if (e.date) {
      const [y, m] = e.date.split('-')
      set.add(`${y}-${m}`)
    }
  })
  return [...set].sort().map(s => {
    const [y, m] = s.split('-')
    return { year: Number(y), month: Number(m) - 1 }
  })
}

function countVacationWorkDays(year, month, vacations, workDays) {
  let count = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay() === 0 ? 7 : date.getDay()
    if (!workDays.includes(dow)) continue
    if (isVacationDay(date, vacations)) count++
  }
  return count
}

const inputStyle = {
  width: '100%', padding: '12px 14px', background: '#2c2c2e',
  border: '1px solid #3a3a3c', borderRadius: 10, color: 'var(--text)',
  fontSize: 15, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark',
}
