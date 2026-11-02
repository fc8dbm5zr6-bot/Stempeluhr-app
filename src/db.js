import Dexie from 'dexie'
import { getFeiertage } from './utils/feiertage'

export const db = new Dexie('StempeluhrDB')

db.version(4).stores({
  settings: '++id, planName',
  timeEntries: '++id, date, type',
  vacations: '++id, startDate, endDate, type',
  overtimeAdjustments: '++id, date',
})

export async function initDefaults() {
  const count = await db.settings.count()
  if (count === 0) {
    await db.settings.add({
      planName: 'Mein Job',
      weeklyHours: 40,
      workDays: [1, 2, 3, 4, 5],
      hoursPerDay: 8,
      vacationDaysPerYear: 30,
      vacationOverrides: {},
      bundesland: 'NW',
      multipliers: [1, 1.25, 1.5, 2],
    })
  } else {
    const s = await db.settings.toCollection().first()
    const updates = {}
    if (s.vacationDaysPerYear === undefined) updates.vacationDaysPerYear = 30
    if (s.vacationOverrides === undefined) updates.vacationOverrides = {}
    if (s.bundesland === undefined) updates.bundesland = 'NW'
    if (Object.keys(updates).length > 0) {
      await db.settings.update(s.id, updates)
    }
  }

  // Feiertage automatisch synchronisieren (Jan + Jul, für laufendes + 2 Folgejahre)
  try {
    const now = new Date()
    const currentMonth = now.getMonth()
    const syncKey = `${now.getFullYear()}-${currentMonth < 6 ? 'H1' : 'H2'}-v2`
    let lastSync = null
    try { lastSync = localStorage.getItem('lastFeiertagSync') } catch {}

    if (lastSync !== syncKey) {
      const s = await db.settings.toCollection().first()
      const bl = s?.bundesland || 'NW'
      const thisYear = now.getFullYear()
      const years = [thisYear, thisYear + 1, thisYear + 2]
      const existing = await db.vacations.where('type').equals('Feiertag').toArray()

      for (const y of years) {
        const feiertage = getFeiertage(y, bl)
        for (const ft of feiertage) {
          const exists = existing.some(v => v.startDate === ft.date && v.endDate === ft.date && v.type === 'Feiertag')
          if (!exists) {
            await db.vacations.add({ startDate: ft.date, endDate: ft.date, type: 'Feiertag', note: ft.name, halfDay: ft.halfDay || false })
          }
        }
      }
      try { localStorage.setItem('lastFeiertagSync', syncKey) } catch {}
    }
  } catch (e) {
    console.error('Feiertag sync error:', e)
  }
}
