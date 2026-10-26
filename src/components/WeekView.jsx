import { useState, useMemo, useRef } from 'react'
import { useSettings, useWeekEntries, useVacations } from '../hooks/useTimeEntries'
import {
  getWeekNumber, formatDuration, calculateDailyTarget, getDayEntries,
  calculateWorkedMinutes, calculateRawWorkedMinutes, getWeekDates, formatDateDE, getWeekdayNameDE, isVacationDay, getVacationType, toDateStr,
} from '../utils/calculations'

function PercentRing({ percent, size = 44, strokeWidth = 4, color }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(percent, 0), 200)
  const offset = circumference - (Math.min(clamped, 100) / 100) * circumference
  const c = color || (percent >= 100 ? 'var(--green)' : percent >= 75 ? 'var(--olive)' : percent > 0 ? 'var(--blue)' : '#3a3a3c')
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#3a3a3c" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={c} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

export default function WeekView({ onSelectDay }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const settings = useSettings()

  const baseDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate])
  const weekNum = getWeekNumber(baseDate)
  const year = baseDate.getFullYear()

  const entries = useWeekEntries(baseDate)
  const vacations = useVacations(year)

  const dailyTarget = settings ? calculateDailyTarget(settings.weeklyHours, settings.workDays) : 8
  const workDays = settings?.workDays || [1, 2, 3, 4, 5]

  const days = weekDates.map(date => {
    const dateStr = toDateStr(date)
    const dayEntries = getDayEntries(entries || [], dateStr)
    const workedWithMultiplier = calculateWorkedMinutes(dayEntries)
    const rawWorked = calculateRawWorkedMinutes(dayEntries)
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay()
    const isWork = workDays.includes(dayOfWeek)
    const isVac = isVacationDay(date, vacations || [])
    const vacType = getVacationType(date, vacations || [])
    const target = (isWork && !isVac) ? dailyTarget : 0
    const diff = isVac ? Math.max(0, workedWithMultiplier - (isWork ? dailyTarget : 0)) : (isWork ? workedWithMultiplier - dailyTarget : workedWithMultiplier)
    const percent = isVac ? 100 : (dailyTarget > 0 ? Math.round((workedWithMultiplier / dailyTarget) * 100) : (workedWithMultiplier > 0 ? 100 : 0))
    return { date, dateStr, worked: workedWithMultiplier, rawWorked, target, diff, percent, isWork, isVac, vacType, dayOfWeek }
  })

  const totalWorked = days.reduce((s, d) => s + (d.isVac ? 0 : d.worked), 0)
  const totalTarget = days.reduce((s, d) => s + d.target, 0)
  const totalVacBonus = days.reduce((s, d) => s + (d.isVac ? d.diff : 0), 0)
  const totalDiff = totalWorked - totalTarget + totalVacBonus
  const totalPercent = totalTarget > 0 ? Math.round((totalWorked / totalTarget) * 100) : 0

  const diffSign = totalDiff >= 0 ? '+' : ''
  const diffColor = totalDiff >= 0 ? 'var(--green)' : 'var(--red)'

  const touchStart = useRef(null)
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(diff) > 60) {
      setWeekOffset(w => diff > 0 ? w - 1 : w + 1)
    }
    touchStart.current = null
  }

  return (
    <div className="page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <PercentRing percent={totalPercent} size={56} strokeWidth={5} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Woche {weekNum}</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{year}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{formatDuration(totalWorked)}</div>
          <div style={{ fontSize: 14, color: diffColor }}>{diffSign}{formatDuration(Math.abs(totalDiff))}</div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={navBtnStyle}>←</button>
        <button onClick={() => setWeekOffset(0)} style={{ ...navBtnStyle, fontSize: 12, padding: '6px 16px' }}>Heute</button>
        <button onClick={() => setWeekOffset(w => w + 1)} style={navBtnStyle}>→</button>
      </div>

      {/* Days */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map((day) => (
          <button
            key={day.dateStr}
            onClick={() => onSelectDay(day.dateStr)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
              border: day.dateStr === toDateStr(new Date()) ? '1px solid #3a3a3c' : '1px solid transparent',
              cursor: 'pointer', width: '100%', textAlign: 'left', color: 'var(--text)',
            }}
          >
            <PercentRing percent={day.percent} size={36} strokeWidth={3} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{getWeekdayNameDE(day.date)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateDE(day.date)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {day.isVac
                  ? (day.rawWorked > 0 ? `${day.vacType} +${formatDuration(Math.max(0, day.worked - dailyTarget))}` : day.vacType)
                  : (day.worked > 0 ? formatDuration(day.rawWorked) : '0Sek.')}
              </div>
              {!day.isVac && day.worked !== day.rawWorked && day.rawWorked > 0 && (
                <div style={{ fontSize: 11, color: 'var(--orange)' }}>
                  ×1,5 → {formatDuration(day.worked)}
                </div>
              )}
              {day.isWork && day.worked > 0 && (
                <div style={{
                  fontSize: 12,
                  color: day.diff >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {day.diff >= 0 ? '+' : ''}{formatDuration(Math.abs(day.diff))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

const navBtnStyle = {
  background: '#2c2c2e', border: 'none', color: 'var(--text)',
  borderRadius: 8, padding: '8px 20px', fontSize: 18, cursor: 'pointer',
}
