import { useState, useRef } from 'react'
import { db } from '../db'
import { useSettings } from '../hooks/useTimeEntries'
import { useLiveQuery } from 'dexie-react-hooks'
import { getWorkingDaysInMonth, toDateStr, calculateWorkedMinutes, getDayEntries, formatDuration, countAbsenceWorkDays } from '../utils/calculations'
import { getFeiertage } from '../utils/feiertage'

export default function YearSummary({ onClose }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const settings = useSettings()
  const workDays = settings?.workDays || [1, 2, 3, 4, 5]
  const vacationDaysPerYear = settings?.vacationDaysPerYear || 30
  const overrides = settings?.vacationOverrides || {}
  const vacationBudget = overrides[String(year)] !== undefined ? overrides[String(year)] : vacationDaysPerYear
  const bundesland = settings?.bundesland || 'NW'

  const allEntries = useLiveQuery(() => db.timeEntries.toArray(), [], [])
  const allVacations = useLiveQuery(() => db.vacations.toArray(), [], [])

  const touchStart = useRef(null)

  let totalWorkDays = 0
  for (let m = 0; m < 12; m++) totalWorkDays += getWorkingDaysInMonth(year, m, workDays)

  const daysWorked = new Set()
  let totalWorkedMin = 0
  ;(allEntries || []).forEach(e => {
    if (e.date && e.date.startsWith(String(year))) {
      daysWorked.add(e.date)
    }
  })

  const yearDates = []
  for (let m = 0; m < 12; m++) {
    const dim = new Date(year, m + 1, 0).getDate()
    for (let d = 1; d <= dim; d++) {
      yearDates.push(`${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
  }
  yearDates.forEach(dateStr => {
    const dayEntries = getDayEntries(allEntries || [], dateStr)
    totalWorkedMin += calculateWorkedMinutes(dayEntries)
  })

  const yearVacs = (allVacations || []).filter(v => v.startDate.startsWith(String(year)) || v.endDate.startsWith(String(year)))

  function countDays(type) {
    return yearVacs.filter(v => v.type === type).reduce((sum, v) => {
      return sum + countAbsenceWorkDays(v.startDate, v.endDate, workDays, yearVacs, v.id, v.halfDay)
    }, 0)
  }

  const urlaubTage = countDays('Urlaub')
  const krankTage = countDays('Krankheit')
  const fzaTage = countDays('Freizeitausgleich')
  const feiertage = countDays('Feiertag')
  const feiertageListe = getFeiertage(year, bundesland)

  const urlaubRest = vacationBudget - urlaubTage
  const abwesenheitGesamt = urlaubTage + krankTage + fzaTage + feiertage
  const effektiveArbeitstage = totalWorkDays - feiertage

  const [showMissing, setShowMissing] = useState(false)

  const today = new Date()
  const isCurrentYear = year === today.getFullYear()
  const lastRelevantDate = isCurrentYear ? today : new Date(year, 11, 31)

  function isVacDay(dateStr) {
    return yearVacs.some(v => dateStr >= v.startDate && dateStr <= v.endDate)
  }

  const missingDays = []
  const firstEntry = (allEntries || []).filter(e => e.date && e.date.startsWith(String(year))).map(e => e.date).sort()[0]

  if (firstEntry) {
    for (const dateStr of yearDates) {
      if (dateStr < firstEntry) continue
      if (new Date(dateStr) > lastRelevantDate) continue
      const dateObj = new Date(dateStr)
      const dow = dateObj.getDay() === 0 ? 7 : dateObj.getDay()
      if (!workDays.includes(dow)) continue
      if (isVacDay(dateStr)) continue
      if (!daysWorked.has(dateStr)) missingDays.push(dateStr)
    }
  }

  const startedLate = firstEntry && firstEntry > `${year}-01-10`
  const isIncomplete = missingDays.length > 0 || !firstEntry || startedLate
  const firstMonthTracked = firstEntry ? parseInt(firstEntry.split('-')[1]) : null
  const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

  const fmt = v => v % 1 !== 0 ? v.toFixed(1) : String(v)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onTouchStart={e => { touchStart.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchStart.current === null) return
        const diff = e.changedTouches[0].clientX - touchStart.current
        if (diff > 100) onClose()
        else if (Math.abs(diff) > 60) setYear(y => diff > 0 ? y - 1 : y + 1)
        touchStart.current = null
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={() => setYear(y => y - 1)} style={navBtn}>←</button>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{year}</h1>
          <button onClick={() => setYear(y => y + 1)} style={navBtn}>→</button>
        </div>

        {/* Hinweis bei unvollständigem Datensatz */}
        {isIncomplete && (
          <div style={{
            background: 'rgba(255, 59, 48, 0.1)', border: '1px solid var(--red)',
            borderRadius: 12, padding: 14, marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 6 }}>
              ⚠ Datensatz für {year} unvollständig
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {!firstEntry
                ? `Keine Einträge für ${year} vorhanden.`
                : startedLate && missingDays.length === 0
                ? `Tracking begann erst am ${new Date(firstEntry + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}. Daten davor sind nicht erfasst.`
                : `Tracking begann am ${new Date(firstEntry + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}. ${missingDays.length} Arbeitstage ohne Eintrag.`
              }
            </div>
            {missingDays.length > 0 && (
              <button onClick={() => setShowMissing(!showMissing)} style={{
                background: 'none', border: 'none', color: 'var(--red)',
                fontSize: 13, cursor: 'pointer', padding: 0, marginTop: 8,
              }}>
                {showMissing ? '▼' : '►'} Fehlende Tage anzeigen ({missingDays.length})
              </button>
            )}
            {showMissing && missingDays.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {missingDays.map(d => (
                  <span key={d} style={{
                    background: 'rgba(255, 59, 48, 0.15)', color: 'var(--red)',
                    borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 500,
                  }}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', weekday: 'short' })}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Arbeitszeit */}
        <SectionHeader>Arbeitszeit</SectionHeader>
        <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <Row label="Potenzielle Arbeitstage" value={fmt(totalWorkDays)} />
          <Row label="− Feiertage" value={`−${fmt(feiertage)}`} color="var(--text-secondary)" />
          <Row label="= Effektive Arbeitstage" value={fmt(effektiveArbeitstage)} color="var(--text)" bold />
          <Row label="Tage gearbeitet" value={fmt(daysWorked.size)} color="var(--green)" />
          <Row label="Geleistete Stunden" value={formatDuration(totalWorkedMin)} color="var(--green)" />
        </div>

        {/* Urlaub */}
        <SectionHeader>Urlaub</SectionHeader>
        <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <Row label="Jahresanspruch" value={`${fmt(vacationBudget)} Tage`} />
          <Row label="Genommen" value={`${fmt(urlaubTage)} Tage`} color="var(--blue)" />
          <Row label="Verbleibend" value={`${fmt(urlaubRest)} Tage`} color={urlaubRest > 0 ? 'var(--green)' : 'var(--red)'} bold />
        </div>

        {/* Abwesenheiten */}
        <SectionHeader>Abwesenheiten</SectionHeader>
        <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <Row label="Urlaub" value={`${fmt(urlaubTage)} Tage`} color="var(--blue)" />
          <Row label="Krankheit" value={`${fmt(krankTage)} Tage`} color="var(--yellow)" />
          <Row label="Freizeitausgleich" value={`${fmt(fzaTage)} Tage`} color="var(--orange)" />
          <Row label="Feiertage" value={`${fmt(feiertage)} Tage`} color="var(--text-secondary)" />
          <Row label="Gesamt abwesend" value={`${fmt(abwesenheitGesamt)} Tage`} bold />
        </div>

        <div style={{ height: 70 }} />
      </div>

      {/* Back button */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '10px 0', flexShrink: 0 }}>
        <button onClick={onClose} style={circleBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ children }) {
  return <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>{children}</div>
}

function Row({ label, value, color, bold }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 16px', borderBottom: '1px solid var(--divider)',
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: bold ? 700 : 500, color: color || 'var(--text)' }}>{value}</span>
    </div>
  )
}

const navBtn = {
  background: '#2c2c2e', border: 'none', color: 'var(--text)',
  borderRadius: 8, padding: '8px 16px', fontSize: 18, cursor: 'pointer',
}

const circleBtn = {
  width: 50, height: 50, borderRadius: 25, border: 'none',
  background: '#3a3a3c', color: 'var(--text)', fontSize: 22,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
