import Dexie from 'dexie'

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

  // multiplier defaults handled in calculations.js (e.multiplier || 1)
}
