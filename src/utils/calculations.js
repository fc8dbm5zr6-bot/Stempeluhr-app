import { format, getISOWeek, startOfWeek, addDays, getDaysInMonth, getDay, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const WEEKDAY_SHORT = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.']

export function getWeekNumber(date) {
  return getISOWeek(date)
}

export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '0Sek.'
  const neg = minutes < 0
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = Math.floor(abs % 60)
  const s = Math.round((abs - Math.floor(abs)) * 60)
  const prefix = neg ? '-' : ''
  if (h === 0 && m === 0) return `${prefix}${s}Sek.`
  if (h === 0) return `${prefix}${m}Min. ${s}Sek.`
  return `${prefix}${h}Std. ${m}Min.`
}

export function formatDurationShort(minutes) {
  if (minutes == null || isNaN(minutes)) return '0:00'
  const neg = minutes < 0
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = Math.floor(abs % 60)
  return `${neg ? '-' : ''}${h}:${String(m).padStart(2, '0')}`
}

export function formatHoursDecimal(minutes) {
  if (minutes == null || isNaN(minutes)) return '0,0'
  return (minutes / 60).toFixed(1).replace('.', ',')
}

export function formatTime(date) {
  if (!date) return '--:--'
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'HH:mm')
}

export function formatDateDE(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd.MM.yyyy')
}

export function getWeekdayNameDE(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return WEEKDAY_NAMES[d.getDay()]
}

export function getWeekdayShortDE(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return WEEKDAY_SHORT[d.getDay()]
}

export function getMonthNameDE(month) {
  const names = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  return names[month]
}

export function calculateDailyTarget(weeklyHours, workDays) {
  if (!workDays || workDays.length === 0) return 0
  return (weeklyHours / workDays.length) * 60
}

export function getWorkingDaysInMonth(year, month, workDays) {
  const days = getDaysInMonth(new Date(year, month))
  let count = 0
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay()
    const isoDow = dow === 0 ? 7 : dow
    if (workDays.includes(isoDow)) count++
  }
  return count
}

export function getWorkingDaysUpToDate(year, month, day, workDays) {
  let count = 0
  for (let d = 1; d <= day; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay()
    const isoDow = dow === 0 ? 7 : dow
    if (workDays.includes(isoDow)) count++
  }
  return count
}

export function getDayEntries(entries, dateStr) {
  return (entries || []).filter(e => e.date === dateStr)
}

export function calculateWorkedMinutes(entries) {
  return (entries || [])
    .filter(e => e.type === 'work' && e.startTime && e.endTime)
    .reduce((sum, e) => {
      const start = new Date(e.startTime)
      const end = new Date(e.endTime)
      const raw = (end - start) / 60000
      const multiplier = e.multiplier || 1
      return sum + raw * multiplier
    }, 0)
}

export function calculateRawWorkedMinutes(entries) {
  return (entries || [])
    .filter(e => e.type === 'work' && e.startTime && e.endTime)
    .reduce((sum, e) => {
      const start = new Date(e.startTime)
      const end = new Date(e.endTime)
      return sum + (end - start) / 60000
    }, 0)
}

export function calculatePauseMinutes(entries) {
  return (entries || [])
    .filter(e => e.type === 'pause' && e.startTime && e.endTime)
    .reduce((sum, e) => {
      const start = new Date(e.startTime)
      const end = new Date(e.endTime)
      return sum + (end - start) / 60000
    }, 0)
}

export function getWeekDates(date) {
  const monday = startOfWeek(date, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function getMonthWeeks(year, month) {
  const weeks = new Set()
  const days = getDaysInMonth(new Date(year, month))
  for (let d = 1; d <= days; d++) {
    weeks.add(getISOWeek(new Date(year, month, d)))
  }
  return [...weeks]
}

export function isVacationDay(date, vacations) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const dateStr = format(d, 'yyyy-MM-dd')
  return (vacations || []).some(v => dateStr >= v.startDate && dateStr <= v.endDate)
}

export function getVacationType(date, vacations) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const dateStr = format(d, 'yyyy-MM-dd')
  const v = (vacations || []).find(v => dateStr >= v.startDate && dateStr <= v.endDate)
  return v ? v.type : null
}

export function toDateStr(date) {
  return format(typeof date === 'string' ? parseISO(date) : date, 'yyyy-MM-dd')
}

export function todayStr() {
  return format(new Date(), 'yyyy-MM-dd')
}
