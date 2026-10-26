import { useState, useEffect } from 'react'
import BottomNav from './components/BottomNav'
import Timer from './components/Timer'
import WeekView from './components/WeekView'
import MonthView from './components/MonthView'
import DayDetail from './components/DayDetail'
import Settings from './components/Settings'
import VacationManager from './components/VacationManager'
import { db } from './db'
import { toDateStr } from './utils/calculations'
import { exportAll } from './utils/csv'

export default function App() {
  const [activeTab, setActiveTab] = useState('start')
  const [selectedDate, setSelectedDate] = useState(null)
  const [showVacations, setShowVacations] = useState(false)
  const [showBackupReminder, setShowBackupReminder] = useState(false)

  useEffect(() => {
    const today = new Date()
    if (today.getDate() <= 3) {
      try {
        const lastBackup = localStorage.getItem('lastBackupReminder')
        const thisMonth = `${today.getFullYear()}-${today.getMonth()}`
        if (lastBackup !== thisMonth) {
          setShowBackupReminder(true)
        }
      } catch {}
    }
  }, [])
  const [showQuickAbsence, setShowQuickAbsence] = useState(false)

  const renderTab = () => {
    switch (activeTab) {
      case 'start':
        return <Timer
          onShowDay={(d) => setSelectedDate(d)}
          onShowVacations={() => setShowVacations(true)}
          onAddAbsence={() => setShowQuickAbsence(true)}
        />
      case 'woche':
        return <WeekView onSelectDay={(d) => setSelectedDate(d)} />
      case 'monat':
        return <MonthView />
      case 'urlaub':
        return <VacationManager onClose={() => setActiveTab('start')} />

      case 'setup':
        return <Settings />
      default:
        return null
    }
  }

  return (
    <>
      <div className="app-container">
        {renderTab()}
      </div>
      {selectedDate && (
        <DayDetail date={selectedDate} onClose={() => setSelectedDate(null)} />
      )}
      {showVacations && (
        <div className="page-fullscreen" style={{ zIndex: 250 }}>
          <VacationManager onClose={() => setShowVacations(false)} />
        </div>
      )}
      {showQuickAbsence && (
        <QuickAbsenceForm
          onSave={async (data) => {
            await db.vacations.add(data)
            setShowQuickAbsence(false)
          }}
          onCancel={() => setShowQuickAbsence(false)}
        />
      )}
      {showBackupReminder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💾</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Monatliches Backup</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Sichere deine Daten als CSV — am besten in iCloud Drive, damit nichts verloren geht.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={async () => {
                const entries = await db.timeEntries.toArray()
                const vacations = await db.vacations.toArray()
                const settings = await db.settings.toCollection().first()
                exportAll(entries, vacations, settings)
                try { localStorage.setItem('lastBackupReminder', `${new Date().getFullYear()}-${new Date().getMonth()}`) } catch {}
                setShowBackupReminder(false)
              }} style={{
                padding: '14px 0', borderRadius: 10, border: 'none',
                background: 'var(--green)', color: '#000', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>Jetzt exportieren</button>
              <button onClick={() => {
                try { localStorage.setItem('lastBackupReminder', `${new Date().getFullYear()}-${new Date().getMonth()}`) } catch {}
                setShowBackupReminder(false)
              }} style={{
                padding: '14px 0', borderRadius: 10, border: '1px solid var(--divider)',
                background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
              }}>Später</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </>
  )
}

const TYPES = ['Urlaub', 'Freizeitausgleich', 'Krankheit', 'Feiertag']

function QuickAbsenceForm({ onSave, onCancel }) {
  const today = toDateStr(new Date())
  const [type, setType] = useState('Urlaub')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [note, setNote] = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Abwesenheit eintragen</h2>

        <label style={qfLabel}>Typ</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: t === 'Freizeitausgleich' ? '1 1 100%' : 1,
              padding: '10px 0', borderRadius: 8, border: 'none',
              background: type === t ? (t === 'Freizeitausgleich' ? 'var(--orange)' : 'var(--blue)') : 'var(--bg-input)',
              color: type === t ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t === 'Freizeitausgleich' ? '⏱ Überstunden abfeiern' : t}</button>
          ))}
        </div>

        <label style={qfLabel}>Von</label>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value) }} style={qfInput} />

        <label style={{ ...qfLabel, marginTop: 12 }}>Bis</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={qfInput} />

        <label style={{ ...qfLabel, marginTop: 12 }}>Notiz</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional" style={qfInput} />

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '14px 0', borderRadius: 10, border: '1px solid var(--divider)',
            background: 'transparent', color: 'var(--text)', fontSize: 15, cursor: 'pointer',
          }}>Abbrechen</button>
          <button onClick={() => onSave({ type, startDate, endDate, note })} style={{
            flex: 1, padding: '14px 0', borderRadius: 10, border: 'none',
            background: 'var(--green)', color: '#000', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>Speichern</button>
        </div>
      </div>
    </div>
  )
}

const qfLabel = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }
const qfInput = {
  width: '100%', padding: '12px 14px', background: 'var(--bg-input)',
  border: '1px solid var(--divider)', borderRadius: 10, color: 'var(--text)',
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
}
