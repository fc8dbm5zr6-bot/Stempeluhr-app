import { useState, useMemo, useRef, useEffect } from 'react'
import { useSettings, useMonthEntries, useVacations } from '../hooks/useTimeEntries'
import { startOfWeek, addDays, getISOWeek, format } from 'date-fns'
import {
  getWeekNumber, formatDuration, calculateDailyTarget, getDayEntries,
  calculateWorkedMinutes, getMonthWeeks, getWorkingDaysInMonth, getWorkingDaysUpToDate, isVacationDay, getVacationType, toDateStr,
} from '../utils/calculations'

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const MAX_HOURS = 70

export default function MonthView({ onSelectWeek }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const settings = useSettings()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  const viewDate = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1), [monthOffset])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const entries = useMonthEntries(year, month)
  const prevMonthEntries = useMonthEntries(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1)
  const nextMonthEntries = useMonthEntries(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1)
  const allEntries = [...(prevMonthEntries || []), ...(entries || []), ...(nextMonthEntries || [])]
  const vacations = useVacations(year)

  const dailyTarget = settings ? calculateDailyTarget(settings.weeklyHours, settings.workDays) : 480
  const workDays = settings?.workDays || [1, 2, 3, 4, 5]
  const todayStr = toDateStr(new Date())
  const weeklyTargetHours = (settings?.weeklyHours || 40)

  const weeks = getMonthWeeks(year, month)

  const weekData = weeks.map(weekNum => {
    const jan4 = new Date(year, 0, 4)
    const jan4Week = getISOWeek(jan4)
    const refDate = addDays(jan4, (weekNum - jan4Week) * 7)
    const monday = startOfWeek(refDate, { weekStartsOn: 1 })
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

    let workedMin = 0
    let vacationMin = 0
    let sickMin = 0

    dates.forEach(date => {
      const dateStr = toDateStr(date)
      const dayEntries = getDayEntries(allEntries, dateStr)
      const worked = calculateWorkedMinutes(dayEntries)
      const dow = date.getDay() === 0 ? 7 : date.getDay()
      const isWork = workDays.includes(dow)
      const vacType = getVacationType(date, vacations || [])
      const vacEntry = (vacations || []).find(v => dateStr >= v.startDate && dateStr <= v.endDate)
      const halfFactor = vacEntry?.halfDay ? 0.5 : 1

      if (vacType === 'Krankheit' && isWork) {
        sickMin += dailyTarget * halfFactor
      } else if (vacType && isWork) {
        vacationMin += dailyTarget * halfFactor
      }
      workedMin += worked
      if (dateStr === todayStr) {
        const openEntry = dayEntries.find(e => !e.endTime && e.type === 'work')
        if (openEntry) workedMin += (now - new Date(openEntry.startTime).getTime()) / 60000
      }
    })

    const workedH = workedMin / 60
    const vacH = vacationMin / 60
    const sickH = sickMin / 60
    const totalH = workedH + vacH + sickH

    return { weekNum, workedH, vacH, sickH, totalH, monday }
  })

  const totalWorkingDays = getWorkingDaysInMonth(year, month, workDays)
  const totalSoll = totalWorkingDays * dailyTarget

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const workingDaysSoFar = isCurrentMonth
    ? getWorkingDaysUpToDate(year, month, today.getDate(), workDays)
    : totalWorkingDays
  const sollBisJetzt = workingDaysSoFar * dailyTarget

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let totalWorked = 0
  let liveExtra = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayEntries = getDayEntries(entries || [], dateStr)
    totalWorked += calculateWorkedMinutes(dayEntries)
    if (dateStr === todayStr) {
      const openEntry = dayEntries.find(e => !e.endTime && e.type === 'work')
      if (openEntry) liveExtra = (now - new Date(openEntry.startTime).getTime()) / 60000
    }
  }
  totalWorked += liveExtra
  const diffSoFar = totalWorked - sollBisJetzt
  const diffTotal = totalWorked - totalSoll

  const monthVacations = (vacations || []).filter(v => {
    const vs = new Date(v.startDate)
    const ve = new Date(v.endDate)
    const ms = new Date(year, month, 1)
    const me = new Date(year, month + 1, 0)
    return vs <= me && ve >= ms
  })

  const touchStart = useRef(null)
  const [slideDir, setSlideDir] = useState(null)
  const [isSliding, setIsSliding] = useState(false)
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(diff) > 60) {
      const dir = diff > 0 ? 'right' : 'left'
      setSlideDir(dir)
      setIsSliding(true)
      setTimeout(() => {
        setMonthOffset(m => dir === 'right' ? m - 1 : m + 1)
        setSlideDir(null)
        setIsSliding(false)
      }, 200)
    }
    touchStart.current = null
  }

  const targetLinePct = (weeklyTargetHours / MAX_HOURS) * 100

  return (
    <div className="page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        transform: slideDir === 'left' ? 'translateX(-30px)' : slideDir === 'right' ? 'translateX(30px)' : 'translateX(0)',
        opacity: isSliding ? 0.3 : 1,
      }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => setMonthOffset(m => m - 1)} style={navBtn}>←</button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          {MONTH_NAMES[month]} {year}
        </h1>
        <button onClick={() => setMonthOffset(m => m + 1)} style={navBtn}>→</button>
      </div>

      {/* Bar chart */}
      {(() => {
        const chartH = 200
        const targetLineBottom = (weeklyTargetHours / MAX_HOURS) * chartH
        return (
          <div style={{ position: 'relative', marginBottom: 20, height: chartH + 40 }}>
            {/* Target line */}
            <div style={{
              position: 'absolute', left: 0, right: 0,
              bottom: targetLineBottom + 20,
              borderTop: '2px dashed var(--text-muted)',
              zIndex: 1, pointerEvents: 'none',
            }}>
              <span style={{ position: 'absolute', right: 0, top: -14, fontSize: 10, color: 'var(--text-secondary)' }}>{weeklyTargetHours}h</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: chartH + 40, padding: '0 4px' }}>
              {weekData.map((week) => {
                const sickPx = (week.sickH / MAX_HOURS) * chartH
                const vacPx = (week.vacH / MAX_HOURS) * chartH
                const workedPx = (week.workedH / MAX_HOURS) * chartH
                const totalPx = sickPx + vacPx + workedPx
                return (
                  <button
                    key={week.weekNum}
                    onClick={() => onSelectWeek && onSelectWeek(week.weekNum, week.monday)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, height: 14 }}>
                      {week.totalH > 0 ? week.totalH.toFixed(0) + 'h' : ''}
                    </span>
                    <div style={{ width: 32, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: Math.max(totalPx, 0) }}>
                      {workedPx > 0 && <div style={{ height: workedPx, background: 'var(--green)' }} />}
                      {vacPx > 0 && <div style={{ height: vacPx, background: 'var(--purple)' }} />}
                      {sickPx > 0 && <div style={{ height: sickPx, background: 'var(--yellow)' }} />}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, height: 14 }}>
                      KW{week.weekNum}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, justifyContent: 'center' }}>
        <LegendDot color="var(--green)" label="Arbeit" />
        <LegendDot color="var(--purple)" label="Abwesend" />
        <LegendDot color="var(--yellow)" label="Krank" />
      </div>

      {/* Summary: so far */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <Row label="Bisher geleistete Zeit" value={formatDuration(totalWorked)} />
        <Divider />
        <Row label="Sollstunden bis jetzt" value={formatDuration(sollBisJetzt)} />
        <Divider />
        <Row label="Differenz"
          value={`${diffSoFar >= 0 ? '+' : ''}${formatDuration(Math.abs(diffSoFar))}`}
          valueColor={diffSoFar >= 0 ? 'var(--green)' : 'var(--red)'}
        />
      </div>

      {/* Summary: total month */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <Row label="Geleistete Zeit" value={formatDuration(totalWorked)} />
        <Divider />
        <Row label="Sollstunden" value={formatDuration(totalSoll)} />
        <Divider />
        <Row label="Differenz"
          value={`${diffTotal >= 0 ? '+' : ''}${formatDuration(Math.abs(diffTotal))}`}
          valueColor={diffTotal >= 0 ? 'var(--green)' : 'var(--red)'}
        />
      </div>

      {/* Vacations */}
      {monthVacations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Abwesenheiten im {MONTH_NAMES[month]}: {monthVacations.length}
          </h3>
          {monthVacations.map((v, i) => (
            <div key={i} style={{ background: 'var(--card)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <div style={{ fontWeight: 500 }}>{v.type}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {new Date(v.startDate).toLocaleDateString('de-DE')} – {new Date(v.endDate).toLocaleDateString('de-DE')}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>{/* end slide wrapper */}
    </div>
  )
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 15 }}>{label}</span>
      <span style={{ fontWeight: 500, fontSize: 15, color: valueColor || 'var(--text)' }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ borderBottom: '1px solid var(--divider)' }} />
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 10, height: 10, borderRadius: 5, background: color }} />
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

const navBtn = {
  background: '#2c2c2e', border: 'none', color: 'var(--text)',
  borderRadius: 8, padding: '8px 16px', fontSize: 18, cursor: 'pointer',
}
