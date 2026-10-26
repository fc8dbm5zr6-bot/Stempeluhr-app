import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { format, addDays, startOfWeek } from 'date-fns'

export function useTimeEntries(dateStr) {
  return useLiveQuery(
    () => dateStr ? db.timeEntries.where('date').equals(dateStr).toArray() : [],
    [dateStr],
    []
  )
}

export function useWeekEntries(refDate) {
  const monday = startOfWeek(refDate, { weekStartsOn: 1 })
  const dates = Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'))
  return useLiveQuery(
    () => db.timeEntries.where('date').anyOf(dates).toArray(),
    [dates.join(',')],
    []
  )
}

export function useMonthEntries(year, month) {
  const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd')
  const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd')
  return useLiveQuery(
    () => db.timeEntries
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray(),
    [startDate, endDate],
    []
  )
}

export function useSettings() {
  return useLiveQuery(() => db.settings.toCollection().first(), [], null)
}

export function useVacations(year) {
  return useLiveQuery(
    () => {
      if (!year) return []
      const start = `${year}-01-01`
      const end = `${year}-12-31`
      return db.vacations
        .where('startDate')
        .between(start, end, true, true)
        .toArray()
    },
    [year],
    []
  )
}

export function useAllVacations() {
  return useLiveQuery(() => db.vacations.toArray(), [], [])
}

export function useOvertimeAdjustments() {
  return useLiveQuery(() => db.overtimeAdjustments.toArray(), [], [])
}
