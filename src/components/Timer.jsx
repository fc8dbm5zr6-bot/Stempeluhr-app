import { useState, useEffect, useMemo } from 'react'
import { useTimer } from '../hooks/useTimer'
import { useSettings } from '../hooks/useTimeEntries'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatDuration, formatTime, calculateDailyTarget, calculateWorkedMinutes, calculatePauseMinutes, toDateStr } from '../utils/calculations'

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function Timer({ onShowDay, onShowVacations, onAddAbsence }) {
  const { status, elapsed, todayEntries, start, pause, resume, stop } = useTimer()
  const settings = useSettings()
  const [now, setNow] = useState(Date.now())
  const currentYear = new Date().getFullYear()
  const allEntries = useLiveQuery(() => db.timeEntries.toArray(), [], [])
  const allVacations = useLiveQuery(() => db.vacations.toArray(), [], [])
  const yearVacations = useLiveQuery(
    () => db.vacations.where('startDate').between(`${currentYear}-01-01`, `${currentYear}-12-31`, true, true).toArray(),
    [currentYear], []
  )

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const workDays = settings?.workDays || [1, 2, 3, 4, 5]
  const dailyTargetMin = settings ? calculateDailyTarget(settings.weeklyHours, settings.workDays) : 480
  const overrides = settings?.vacationOverrides || {}
  const vacationDaysTotal = overrides[String(currentYear)] !== undefined
    ? overrides[String(currentYear)]
    : (settings?.vacationDaysPerYear || 30)

  const workedMin = calculateWorkedMinutes(todayEntries || [])
  const currentExtraSec = status === 'running' ? elapsed : 0
  const totalWorkedMin = workedMin + currentExtraSec / 60
  const pauseMin = calculatePauseMinutes(todayEntries || [])
  const diffMin = totalWorkedMin - dailyTargetMin
  const percent = dailyTargetMin > 0 ? Math.min(Math.round((totalWorkedMin / dailyTargetMin) * 100), 999) : 0

  const nowDate = new Date()
  const remainingMin = Math.max(0, dailyTargetMin - totalWorkedMin)
  const finishTime = new Date(nowDate.getTime() + remainingMin * 60000)
  const finishStr = `${pad(finishTime.getHours())}:${pad(finishTime.getMinutes())}`

  const diffSign = diffMin >= 0 ? '+' : ''
  const diffColor = diffMin >= 0 ? 'var(--green)' : 'var(--red)'

  const totalDaySeconds = Math.round(totalWorkedMin * 60)
  const timerDisplay = formatElapsed(totalDaySeconds)

  const overtimeBalance = useMemo(() => {
    if (!allEntries.length) return 0
    const today = new Date()
    const todayStr = toDateStr(today)
    const entryDates = allEntries.filter(e => e.date <= todayStr).map(e => e.date)
    if (entryDates.length === 0) return 0
    const firstEntryDate = entryDates.sort()[0]
    let totalTarget = 0
    let totalWorked = 0
    for (let d = new Date(firstEntryDate + 'T12:00:00'); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = toDateStr(d)
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      if (workDays.includes(dow)) {
        const isVac = allVacations.some(v => ds >= v.startDate && ds <= v.endDate)
        if (!isVac) {
          totalTarget += dailyTargetMin
        }
      }
      const dayEntries = allEntries.filter(e => e.date === ds)
      totalWorked += calculateWorkedMinutes(dayEntries)
    }
    return totalWorked - totalTarget
  }, [allEntries, allVacations, workDays, dailyTargetMin])

  const today = toDateStr(new Date())

  const timelineEntries = (todayEntries || []).filter(e => e.startTime && e.endTime)
  let timelineStart = null
  let timelineEnd = null
  if (timelineEntries.length > 0) {
    const starts = timelineEntries.map(e => new Date(e.startTime).getTime())
    const ends = timelineEntries.map(e => new Date(e.endTime).getTime())
    timelineStart = Math.min(...starts)
    timelineEnd = Math.max(...ends)
  }
  if (status === 'running' && todayEntries) {
    const openEntry = todayEntries.find(e => !e.endTime && e.type === 'work')
    if (openEntry) {
      const s = new Date(openEntry.startTime).getTime()
      if (!timelineStart || s < timelineStart) timelineStart = s
      timelineEnd = Date.now()
    }
  }
  const timelineRange = timelineEnd && timelineStart ? timelineEnd - timelineStart : 1
  const usedVacationDays = yearVacations
    .filter(v => v.type === 'Urlaub')
    .reduce((sum, v) => {
      const s = new Date(v.startDate)
      const e = new Date(v.endDate)
      let days = 0
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay()
        if (workDays.includes(dow)) days++
      }
      return sum + days
    }, 0)
  const remainingVacationDays = vacationDaysTotal - usedVacationDays
  const fzaDays = yearVacations
    .filter(v => v.type === 'Freizeitausgleich')
    .reduce((sum, v) => {
      const s = new Date(v.startDate)
      const e = new Date(v.endDate)
      let days = 0
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay()
        if (workDays.includes(dow)) days++
      }
      return sum + days
    }, 0)

  return (
    <div className="page">
      {/* Zeitkonto + Urlaub */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{
          flex: 1, background: 'var(--card)', borderRadius: 12, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Zeitkonto</span>
          <span style={{
            fontSize: 16, fontWeight: 600,
            color: overtimeBalance >= 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {overtimeBalance >= 0 ? '+' : ''}{formatDuration(Math.abs(overtimeBalance))}
          </span>
        </div>
        <button onClick={() => onShowVacations && onShowVacations()} style={{
          flex: 1, background: 'var(--card)', borderRadius: 12, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          border: 'none', cursor: 'pointer', color: 'var(--text)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Urlaub</span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {remainingVacationDays}/{vacationDaysTotal}
          </span>
        </button>
      </div>
      {fzaDays > 0 && (
        <div style={{
          background: 'var(--card)', borderRadius: 12, padding: '8px 14px',
          marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Freizeitausgleich</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--orange)' }}>{fzaDays} Tage</span>
        </div>
      )}

      {/* Timer display */}
      <div style={{ textAlign: 'center', marginTop: 0, marginBottom: 8 }}>
        <div style={{
          fontSize: 56,
          fontWeight: 200,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: -2,
          color: 'var(--text)',
        }}>
          {timerDisplay}
        </div>
      </div>

      {/* Percentage + timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 18, fontWeight: 600, minWidth: 50 }}>{percent} %</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Heute</span>
      </div>

      {timelineStart && (
        <div style={{
          height: 20,
          background: '#2c2c2e',
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 8,
          display: 'flex',
        }}>
          {timelineEntries.map((entry, i) => {
            const s = new Date(entry.startTime).getTime()
            const e = new Date(entry.endTime).getTime()
            const left = ((s - timelineStart) / timelineRange) * 100
            const width = ((e - s) / timelineRange) * 100
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${Math.max(width, 0.5)}%`,
                height: '100%',
                background: entry.type === 'pause' ? '#5e5ce6' : 'var(--olive)',
                borderRadius: 2,
              }} />
            )
          })}
          {status === 'running' && todayEntries && (() => {
            const openEntry = todayEntries.find(e => !e.endTime && e.type === 'work')
            if (!openEntry) return null
            const s = new Date(openEntry.startTime).getTime()
            const left = ((s - timelineStart) / timelineRange) * 100
            const width = ((Date.now() - s) / timelineRange) * 100
            return (
              <div style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${Math.max(width, 0.5)}%`,
                height: '100%',
                background: 'var(--olive)',
                borderRadius: 2,
              }} />
            )
          })()}
        </div>
      )}

      {timelineStart && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 24 }}>
          <span>{formatTime(new Date(timelineStart))}</span>
          {timelineEnd && <span>{formatTime(new Date(timelineEnd))}</span>}
        </div>
      )}

      {/* Info tiles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        <div style={{
          flex: 1, background: 'var(--card)', borderRadius: 12, padding: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{finishStr}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Fertig um</div>
        </div>
        <div style={{
          flex: 1, background: 'var(--card)', borderRadius: 12, padding: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: diffColor }}>
            {diffSign}{formatDuration(Math.abs(diffMin))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Differenz</div>
        </div>
        <div style={{
          flex: 1, background: 'var(--card)', borderRadius: 12, padding: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{formatDuration(pauseMin)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Pause</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {status === 'idle' && (
          <>
            <button onClick={start} style={{
              flex: 1, padding: '18px 0', borderRadius: 14, border: 'none',
              background: 'var(--green)', color: '#000', fontSize: 20, fontWeight: 600,
              cursor: 'pointer',
            }}>
              Start
            </button>
            <button onClick={() => onShowDay(today)} style={clockBtnStyle}>⏱</button>
          </>
        )}
        {status === 'running' && (
          <>
            <button onClick={stop} style={{
              flex: 1, padding: '18px 0', borderRadius: 14, border: 'none',
              background: 'var(--red)', color: '#fff', fontSize: 20, fontWeight: 600,
              cursor: 'pointer',
            }}>
              Stopp
            </button>
            <button onClick={pause} style={{
              flex: 1, padding: '18px 0', borderRadius: 14, border: 'none',
              background: 'var(--orange)', color: '#000', fontSize: 20, fontWeight: 600,
              cursor: 'pointer',
            }}>
              Pause
            </button>
            <button onClick={() => onShowDay(today)} style={clockBtnStyle}>⏱</button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button onClick={stop} style={{
              flex: 1, padding: '18px 0', borderRadius: 14, border: 'none',
              background: 'var(--red)', color: '#fff', fontSize: 20, fontWeight: 600,
              cursor: 'pointer',
            }}>
              Stopp
            </button>
            <button onClick={resume} style={{
              flex: 1, padding: '18px 0', borderRadius: 14, border: 'none',
              background: 'var(--green)', color: '#000', fontSize: 20, fontWeight: 600,
              cursor: 'pointer',
            }}>
              Weiter
            </button>
            <button onClick={() => onShowDay(today)} style={clockBtnStyle}>⏱</button>
          </>
        )}
      </div>

      {/* Secondary buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => onShowDay(today)} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: '1px solid #3a3a3c',
          background: 'transparent', color: 'var(--text)', fontSize: 15,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span>◑</span> Tagesübersicht
        </button>
        <button onClick={() => onAddAbsence && onAddAbsence()} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: '1px solid #3a3a3c',
          background: 'transparent', color: 'var(--text)', fontSize: 15,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span>📅</span> Abwesenheit eintragen
        </button>
      </div>
    </div>
  )
}

const clockBtnStyle = {
  width: 56, padding: '18px 0', borderRadius: 14, border: 'none',
  background: '#3a3a3c', color: 'var(--text)', fontSize: 22,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
