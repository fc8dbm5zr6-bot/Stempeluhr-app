import { useState, useMemo, useRef, useEffect } from 'react'
import { db } from '../db'
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
  const [editVac, setEditVac] = useState(null)
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
          {monthVacations.map((v, i) => {
            const isFeiertag = v.type === 'Feiertag'
            return (
              <button
                key={i}
                onClick={() => { if (!isFeiertag) setEditVac(v) }}
                style={{
                  width: '100%', background: 'var(--card)', borderRadius: 12, padding: 14, marginBottom: 8,
                  border: 'none', cursor: isFeiertag ? 'default' : 'pointer',
                  color: 'var(--text)', textAlign: 'left',
                  opacity: isFeiertag ? 0.5 : 1,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{v.type}{v.halfDay ? ' (½)' : ''}{v.note ? ` — ${v.note}` : ''}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {new Date(v.startDate + 'T12:00:00').toLocaleDateString('de-DE')}
                    {v.startDate !== v.endDate && ` – ${new Date(v.endDate + 'T12:00:00').toLocaleDateString('de-DE')}`}
                  </div>
                </div>
                {!isFeiertag && (
                  <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>✎</span>
                )}
              </button>
            )
          })}
        </div>
      )}
      </div>{/* end slide wrapper */}

      {/* Edit vacation modal */}
      {editVac && <EditVacModal vac={editVac} onClose={() => setEditVac(null)} workDays={workDays} allVacations={vacations || []} />}
    </div>
  )
}

const EDIT_TYPES = ['Urlaub', 'Freizeitausgleich', 'Krankheit']

function EditVacModal({ vac, onClose, workDays, allVacations }) {
  const [type, setType] = useState(vac.type)
  const [startDate, setStartDate] = useState(vac.startDate)
  const [endDate, setEndDate] = useState(vac.endDate)
  const [note, setNote] = useState(vac.note || '')
  const [halfDay, setHalfDay] = useState(vac.halfDay || false)
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(vac.startDate)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectPhase, setSelectPhase] = useState('done')

  const isMultiDay = startDate && endDate && startDate !== endDate
  const MON = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

  function handleDayTap(ds) {
    if (selectPhase === 'start' || selectPhase === 'done') {
      setStartDate(ds); setEndDate(ds); setHalfDay(false); setSelectPhase('end')
    } else {
      if (ds < startDate) setStartDate(ds)
      else if (ds === startDate) setSelectPhase('done')
      else { setEndDate(ds); setSelectPhase('done') }
      if (startDate !== ds) setHalfDay(false)
    }
  }

  function isInRange(ds) { return startDate && endDate && ds >= startDate && ds <= endDate }

  const calDays = (() => {
    const first = new Date(calMonth.year, calMonth.month, 1).getDay()
    const offset = first === 0 ? 6 : first - 1
    const dim = new Date(calMonth.year, calMonth.month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < offset; i++) cells.push(null)
    for (let d = 1; d <= dim; d++) cells.push(d)
    return cells
  })()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '40px 12px 12px' }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Abwesenheit bearbeiten</h2>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>TYP</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {EDIT_TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: t === 'Freizeitausgleich' ? '1 1 100%' : 1,
              padding: '10px 0', borderRadius: 8, border: 'none',
              background: type === t ? (t === 'Freizeitausgleich' ? 'var(--orange)' : 'var(--purple)') : 'var(--bg-input)',
              color: type === t ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t === 'Freizeitausgleich' ? '⏱ Überstunden abfeiern' : t}</button>
          ))}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>ZEITRAUM</div>
        <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={() => setCalMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 })} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>←</button>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{MON[calMonth.month]} {calMonth.year}</span>
            <button onClick={() => setCalMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 })} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>→</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => <div key={d} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 0' }}>{d}</div>)}
            {calDays.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const ds = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const inR = isInRange(ds)
              const isS = ds === startDate, isE = ds === endDate, isO = isS && isE
              const dow = new Date(calMonth.year, calMonth.month, day).getDay()
              const isW = workDays.includes(dow === 0 ? 7 : dow)
              return (
                <div key={day} style={{
                  background: inR && !isS && !isE ? 'rgba(175,82,222,0.2)' : isS && !isO ? 'linear-gradient(90deg,transparent 50%,rgba(175,82,222,0.2) 50%)' : isE && !isO ? 'linear-gradient(90deg,rgba(175,82,222,0.2) 50%,transparent 50%)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <button onClick={() => handleDayTap(ds)} style={{
                    width: '100%', aspectRatio: '1', borderRadius: isS || isE ? '50%' : 4,
                    border: selectPhase === 'end' && isS ? '2px dashed var(--purple)' : 'none', cursor: 'pointer',
                    background: isS || isE ? 'var(--purple)' : 'transparent',
                    color: isS || isE ? '#fff' : !isW ? 'var(--text-muted)' : 'var(--text)',
                    fontSize: 14, fontWeight: isS || isE ? 700 : 400,
                  }}>{day}</button>
                </div>
              )
            })}
          </div>
          {selectPhase === 'end' && <div style={{ fontSize: 12, color: 'var(--purple)', marginTop: 8, textAlign: 'center', fontWeight: 500 }}>Endtag antippen</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: isMultiDay ? 'var(--text-muted)' : 'var(--text)' }}>Halber Tag</span>
          <button onClick={() => { if (!isMultiDay) setHalfDay(!halfDay) }} style={{
            width: 51, height: 31, borderRadius: 16, border: 'none',
            background: halfDay ? 'var(--purple)' : 'var(--text-muted)',
            position: 'relative', cursor: isMultiDay ? 'default' : 'pointer', opacity: isMultiDay ? 0.4 : 1,
          }}><div style={{ width: 27, height: 27, borderRadius: 14, background: '#fff', position: 'absolute', top: 2, left: halfDay ? 22 : 2, transition: 'left 0.3s' }} /></button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>NOTIZ</div>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--divider)', borderRadius: 10, color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={async () => { if (confirm('Abwesenheit löschen?')) { await db.vacations.delete(vac.id); onClose() } }} style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: 'var(--bg-input)', color: 'var(--red)', fontSize: 14, cursor: 'pointer' }}>🗑</button>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid var(--divider)', background: 'transparent', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}>Abbrechen</button>
          <button onClick={async () => { await db.vacations.update(vac.id, { type, startDate, endDate, note, halfDay }); onClose() }} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--green)', color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Speichern</button>
        </div>
        <div style={{ height: 40 }} />
      </div>
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
