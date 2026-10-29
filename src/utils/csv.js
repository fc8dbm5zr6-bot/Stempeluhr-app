import Papa from 'papaparse'
import { formatTime } from './calculations'

async function downloadCSV(csvString, filename) {
  const blob = new Blob(['﻿' + csvString], { type: 'text/csv;charset=utf-8;' })
  const file = new File([blob], filename, { type: 'text/csv' })

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch {}
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAll(entries, vacations, settings) {
  const rows = []

  if (settings) {
    rows.push({
      Typ: 'Einstellung',
      Datum: '',
      Start: '',
      Ende: '',
      Zuschlag: '',
      Kommentar: `planName=${settings.planName || 'Mein Job'}|weeklyHours=${settings.weeklyHours}|workDays=${(settings.workDays || []).join(',')}|vacationDaysPerYear=${settings.vacationDaysPerYear || 30}|bundesland=${settings.bundesland || 'NW'}`,
    })
  }

  ;(entries || []).forEach(e => {
    rows.push({
      Typ: e.type === 'pause' ? 'Pause' : 'Arbeit',
      Datum: e.date,
      Start: e.startTime ? formatTime(e.startTime) : '',
      Ende: e.endTime ? formatTime(e.endTime) : '',
      Zuschlag: e.multiplier && e.multiplier !== 1 ? String(e.multiplier) : '',
      Kommentar: e.comment || '',
    })
  })

  ;(vacations || []).forEach(v => {
    rows.push({
      Typ: v.type,
      Datum: v.startDate,
      Start: '',
      Ende: v.endDate,
      Zuschlag: '',
      Kommentar: v.note || '',
    })
  })

  const csv = Papa.unparse(rows, { delimiter: ';', columns: ['Typ', 'Datum', 'Start', 'Ende', 'Zuschlag', 'Kommentar'] })
  downloadCSV(csv, `stempeluhr_${new Date().toISOString().slice(0, 10)}.csv`)
}

export function importAll(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete(results) {
        const entries = []
        const vacations = []
        let settings = null

        for (const row of results.data) {
          const typ = (row.Typ || '').trim()

          if (typ === 'Einstellung') {
            settings = {}
            ;(row.Kommentar || '').split('|').forEach(pair => {
              const [k, v] = pair.split('=')
              if (k === 'planName') settings.planName = v
              if (k === 'weeklyHours') settings.weeklyHours = Number(v)
              if (k === 'workDays') settings.workDays = v.split(',').map(Number)
              if (k === 'vacationDaysPerYear') settings.vacationDaysPerYear = Number(v)
              if (k === 'bundesland') settings.bundesland = v
            })
            continue
          }

          if (typ === 'Arbeit' || typ === 'Pause') {
            const date = row.Datum
            const startStr = row.Start
            const endStr = row.Ende
            if (!date) continue

            function localISO(dateStr, timeStr) {
              if (!timeStr) return null
              const [h, m] = timeStr.split(':').map(Number)
              const [y, mo, day] = dateStr.split('-').map(Number)
              const d = new Date(y, mo - 1, day, h, m, 0, 0)
              return d.toISOString()
            }

            const startISO = localISO(date, startStr)
            let endISO = localISO(date, endStr)
            if (startISO && endISO && new Date(endISO) <= new Date(startISO)) {
              const [y, mo, day] = date.split('-').map(Number)
              const [h, m] = endStr.split(':').map(Number)
              const nextDay = new Date(y, mo - 1, day + 1, h, m, 0, 0)
              endISO = nextDay.toISOString()
            }

            entries.push({
              date,
              startTime: startISO,
              endTime: endISO,
              type: typ === 'Pause' ? 'pause' : 'work',
              multiplier: parseFloat(row.Zuschlag) > 0 ? parseFloat(row.Zuschlag) : 1,
              comment: row.Kommentar || '',
            })
            continue
          }

          if (['Urlaub', 'Freizeitausgleich', 'Krankheit', 'Feiertag', 'Krank'].includes(typ)) {
            const startDate = row.Datum
            const endDate = row.Ende || row.Datum
            if (!startDate) continue
            vacations.push({
              startDate,
              endDate,
              type: typ === 'Krank' ? 'Krankheit' : typ,
              note: row.Kommentar || '',
            })
          }
        }

        resolve({ entries, vacations, settings })
      },
      error: reject,
    })
  })
}
