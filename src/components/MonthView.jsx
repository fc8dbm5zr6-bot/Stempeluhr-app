import { useState, useMemo, useRef } from 'react'
import { useSettings, useMonthEntries, useVacations } from '../hooks/useTimeEntries'
import { startOfWeek, addDays, getISOWeek, format } from 'date-fns'
import {
  getWeekNumber, formatDuration, calculateDailyTarget, getDayEntries,
  calculateWorkedMinutes, getMonthWeeks, getWorkingDaysInMonth, getWorkingDaysUpToDate, isVacationDay,
} from '../utils/calculations'

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

export default function MonthView() {
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const settings = useSettings()

  const viewDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    return d
  }, [monthOffset])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const entries = useMonthEntries(year, month)
  const vacations = useVacations(year)

  const dailyTarget = settings ? calculateDailyTarget(settings.weeklyHours, settings.workDays) : 8
  const workDays = settings?.workDays || [1, 2, 3, 4, 5]

  const weeklyTarget = (settings?.weeklyHours || 40) * 60
  const weeks = getMonthWeeks(year, month)

  const weekData = weeks.map(weekNum => {
    const jan4 = new Date(year, 0, 4)
    const jan4Week = getISOWeek(jan4)
    const refDate = addDays(jan4, (weekNum - jan4Week) * 7)
    const monday = startOfWeek(refDate, { weekStartsOn: 1 })
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

    let totalWorked = 0
    dates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayEntries = getDayEntries(entries || [], dateStr)
      totalWorked += calculateWorkedMinutes(dayEntries)
    })
    const workingDaysInWeek = dates.filter(d => {
      const dow = d.getDay() === 0 ? 7 : d.getDay()
      return workDays.includes(dow) && d.getMonth() === month
    }).length
    const target = workingDaysInWeek * dailyTarget
    return { weekNum, totalWorked, target, hours: totalWorked / 60 }
  })

  const maxHours = Math.max(...weekData.map(w => w.hours), 1)

  const totalWorkingDays = getWorkingDaysInMonth(year, month, workDays)
  const totalSoll = totalWorkingDays * dailyTarget

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const workingDaysSoFar = isCurrentMonth
    ? getWorkingDaysUpToDate(year, month, today.getDate(), workDays)
    : totalWorkingDays
  const sollBisJetzt = workingDaysSoFar * dailyTarget

  const totalWorked = weekData.reduce((s, w) => s + w.totalWorked, 0)
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
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(diff) > 60) {
      setMonthOffset(m => diff > 0 ? m - 1 : m + 1)
    }
    touchStart.current = null
  }

  return (
    <div className="page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => setMonthOffset(m => m - 1)} style={navBtn}>←</button>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {MONTH_NAMES[month]} {year}
        </h1>
        <button onClick={() => setMonthOffset(m => m + 1)} style={navBtn}>→</button>
      </div>

      {/* Bar chart */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
        height: 180, marginBottom: 24, padding: '0 8px',
      }}>
        {weekData.map((week) => {
          const heightPct = maxHours > 0 ? (week.hours / maxHours) * 100 : 0
          const color = week.totalWorked > week.target ? 'var(--olive)' : 'var(--blue)'
          const isSmall = week.hours < maxHours * 0.3
          return (
            <div key={week.weekNum} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {week.hours > 0 ? week.hours.toFixed(1).replace('.', ',') : ''}
              </span>
              <div style={{
                width: 36, borderRadius: 18,
                height: `${Math.max(heightPct, 3)}%`,
                background: week.hours > 0 ? color : '#2c2c2e',
                minHeight: 8,
                transition: 'height 0.3s ease',
              }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                KW {week.weekNum}
              </span>
            </div>
          )
        })}
      </div>

      {/* Dashed target line reference */}
      <div style={{ borderTop: '1px dashed #3a3a3c', marginBottom: 24 }} />

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
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
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
  return <div style={{ borderBottom: '1px solid #2c2c2e' }} />
}

const navBtn = {
  background: '#2c2c2e', border: 'none', color: 'var(--text)',
  borderRadius: 8, padding: '8px 16px', fontSize: 18, cursor: 'pointer',
}
