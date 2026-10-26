import { useState, useRef } from 'react'
import { useSettings, useTimeEntries, useAllVacations } from '../hooks/useTimeEntries'
import { db } from '../db'
import {
  formatDuration, formatTime, calculateDailyTarget, calculateWorkedMinutes,
  calculatePauseMinutes, getWeekdayNameDE, formatDateDE, isVacationDay, getVacationType,
} from '../utils/calculations'
import EditEntryModal from './EditEntryModal'

function PercentRing({ percent, size = 56, strokeWidth = 5 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(percent, 0), 200)
  const offset = circumference - (Math.min(clamped, 100) / 100) * circumference
  const color = percent >= 100 ? 'var(--green)' : percent >= 75 ? 'var(--olive)' : percent > 0 ? 'var(--blue)' : '#3a3a3c'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#3a3a3c" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

export default function DayDetail({ date, onClose }) {
  const entries = useTimeEntries(date)
  const settings = useSettings()
  const [editEntry, setEditEntry] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const allVacations = useAllVacations()
  const viewDate = new Date(date + 'T12:00:00')
  const isVac = isVacationDay(viewDate, allVacations || [])
  const vacType = getVacationType(viewDate, allVacations || [])
  const vacEntry = (allVacations || []).find(v => date >= v.startDate && date <= v.endDate)
  const touchStart = useRef(null)
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return
    const diff = e.changedTouches[0].clientX - touchStart.current
    if (diff > 100) onClose()
    touchStart.current = null
  }

  const dailyTargetMin = settings ? calculateDailyTarget(settings.weeklyHours, settings.workDays) : 480
  const dailyTarget = dailyTargetMin / 60

  const sortedEntries = [...(entries || [])].sort((a, b) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
  const workEntries = sortedEntries.filter(e => e.type === 'work' && e.endTime)
  const workedMin = calculateWorkedMinutes(sortedEntries)
  const pauseMin = calculatePauseMinutes(sortedEntries)
  const diffMin = workedMin - dailyTargetMin
  const percent = dailyTargetMin > 0 ? Math.round((workedMin / dailyTargetMin) * 100) : 0

  const dayName = getWeekdayNameDE(viewDate)
  const dateStr = formatDateDE(viewDate)

  const completedEntries = sortedEntries.filter(e => e.startTime && e.endTime)
  let timelineStart = null
  let timelineEnd = null
  if (completedEntries.length > 0) {
    timelineStart = Math.min(...completedEntries.map(e => new Date(e.startTime).getTime()))
    timelineEnd = Math.max(...completedEntries.map(e => new Date(e.endTime).getTime()))
  }
  const timelineRange = timelineEnd && timelineStart ? timelineEnd - timelineStart : 1

  const gaps = []
  for (let i = 0; i < completedEntries.length - 1; i++) {
    const end = new Date(completedEntries[i].endTime).getTime()
    const nextStart = new Date(completedEntries[i + 1].startTime).getTime()
    if (nextStart - end > 60000) {
      gaps.push({
        afterIndex: i,
        startTime: completedEntries[i].endTime,
        endTime: completedEntries[i + 1].startTime,
        duration: Math.round((nextStart - end) / 60000),
      })
    }
  }

  async function convertGapToPause(gap) {
    await db.timeEntries.add({
      date,
      startTime: gap.startTime,
      endTime: gap.endTime,
      type: 'pause',
      comment: '',
    })
  }

  async function addManualEntry() {
    const now = new Date()
    const start = new Date(date + 'T09:00:00').toISOString()
    const end = new Date(date + 'T17:00:00').toISOString()
    await db.timeEntries.add({
      date,
      startTime: start,
      endTime: end,
      type: 'work',
      comment: '',
    })
  }

  async function deleteEntry(id) {
    await db.timeEntries.delete(id)
  }

  return (
    <div className="page-fullscreen" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <PercentRing percent={percent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{dayName}</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{dateStr}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{dailyTarget}Std.</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Arbeitszeit</div>
          </div>
        </div>

        {/* Abwesenheit */}
        {isVac && (
          <div style={{
            background: vacType === 'Freizeitausgleich' ? 'var(--orange)' : 'var(--blue)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
              {vacType === 'Freizeitausgleich' ? '⏱ Freizeitausgleich' : vacType}
            </span>
            <button onClick={async () => {
              if (vacEntry && confirm(`${vacType} löschen?`)) {
                await db.vacations.delete(vacEntry.id)
              }
            }} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
              borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
            }}>Entfernen</button>
          </div>
        )}
        {!isVac && (
          <button onClick={async () => {
            const type = prompt('Abwesenheit eintragen:\n1 = Urlaub\n2 = Freizeitausgleich\n3 = Krankheit\n4 = Feiertag')
            const types = { '1': 'Urlaub', '2': 'Freizeitausgleich', '3': 'Krankheit', '4': 'Feiertag' }
            if (types[type]) {
              await db.vacations.add({ startDate: date, endDate: date, type: types[type], note: '' })
            }
          }} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: '1px dashed var(--divider)',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            marginBottom: 12,
          }}>+ Abwesenheit für diesen Tag</button>
        )}

        {/* Info tiles */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <Tile label="Gearbeitet" value={formatDuration(workedMin)} />
          <Tile label="Differenz"
            value={`${diffMin >= 0 ? '+' : ''}${formatDuration(Math.abs(diffMin))}`}
            valueColor={diffMin >= 0 ? 'var(--green)' : 'var(--red)'}
          />
          <Tile label="Pause" value={formatDuration(pauseMin)} />
        </div>

        {/* Timeline bar */}
        {timelineStart && (
          <>
            <div style={{
              height: 20, background: '#2c2c2e', borderRadius: 10,
              overflow: 'hidden', position: 'relative', marginBottom: 8,
            }}>
              {completedEntries.map((entry, i) => {
                const s = new Date(entry.startTime).getTime()
                const e = new Date(entry.endTime).getTime()
                const left = ((s - timelineStart) / timelineRange) * 100
                const width = ((e - s) / timelineRange) * 100
                return (
                  <div key={i} style={{
                    position: 'absolute', left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
                    height: '100%', borderRadius: 2,
                    background: entry.type === 'pause' ? '#5e5ce6' : 'var(--olive)',
                  }} />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 20 }}>
              <span>{formatTime(new Date(timelineStart))}</span>
              <span>{formatTime(new Date(timelineEnd))}</span>
            </div>
          </>
        )}

        {/* Entries list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {completedEntries.map((entry, idx) => {
            const duration = Math.round(
              (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000
            )
            const gap = gaps.find(g => g.afterIndex === idx)
            return (
              <div key={entry.id}>
                <button
                  onClick={() => setEditEntry(entry)}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%',
                    background: 'var(--card)', borderRadius: 12, padding: 16,
                    border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {entry.type === 'pause' ? (
                        <span style={{ color: '#5e5ce6', fontSize: 18 }}>‖</span>
                      ) : (
                        <span style={{ color: 'var(--green)', fontSize: 14 }}>→</span>
                      )}
                      <span style={{ fontSize: 24, fontWeight: 500 }}>{formatTime(new Date(entry.startTime))}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {entry.type !== 'pause' && (
                        <span style={{ color: 'var(--red)', fontSize: 14 }}>←</span>
                      )}
                      {entry.type === 'pause' && <span style={{ width: 18 }} />}
                      <span style={{ fontSize: 24, fontWeight: 500 }}>{formatTime(new Date(entry.endTime))}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {entry.multiplier > 1 && (
                      <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 600, marginBottom: 2 }}>
                        ×{entry.multiplier}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {entry.comment || 'Kommentar'}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      ⏱ {formatDuration(duration)}{entry.multiplier > 1 ? ` → ${formatDuration(Math.round(duration * entry.multiplier))}` : ''}
                    </div>
                  </div>
                </button>

                {gap && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', color: 'var(--text-secondary)', fontSize: 13,
                  }}>
                    <span>⋮ {formatDuration(gap.duration)}</span>
                    <button
                      onClick={() => convertGapToPause(gap)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--orange)',
                        fontSize: 13, cursor: 'pointer', padding: 0,
                      }}
                    >
                      ⓘ In Pause umwandeln
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom action buttons */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24,
        }}>
          <button onClick={onClose} style={circleBtn}>✕</button>
          <button onClick={addManualEntry} style={{ ...circleBtn, background: 'var(--blue)' }}>+</button>
        </div>

      {editEntry && (
        <EditEntryModal
          entry={editEntry}
          date={date}
          onClose={() => setEditEntry(null)}
          onDelete={async () => {
            await deleteEntry(editEntry.id)
            setEditEntry(null)
          }}
        />
      )}
    </div>
  )
}

function Tile({ label, value, valueColor }) {
  return (
    <div style={{
      flex: 1, background: 'var(--card)', borderRadius: 12, padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: valueColor || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const circleBtn = {
  width: 50, height: 50, borderRadius: 25, border: 'none',
  background: '#3a3a3c', color: 'var(--text)', fontSize: 22,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
