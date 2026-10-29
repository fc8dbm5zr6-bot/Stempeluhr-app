import { useState } from 'react'
import { useSettings } from '../hooks/useTimeEntries'
import { db } from '../db'
import { exportAll, importAll } from '../utils/csv'
import { useLiveQuery } from 'dexie-react-hooks'
import VacationManager from './VacationManager'
import OvertimeAccount from './OvertimeAccount'
import { getFeiertage, getBundeslaender } from '../utils/feiertage'

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7]

export default function Settings() {
  const settings = useSettings()
  const [showVacations, setShowVacations] = useState(false)
  const [showOvertime, setShowOvertime] = useState(false)
  const [editPlan, setEditPlan] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [themeMode, setThemeMode] = useState(() => { try { return localStorage.getItem('themeMode') || 'system' } catch { return 'system' } })

  const allEntries = useLiveQuery(() => db.timeEntries.toArray()) || []
  const allVacations = useLiveQuery(() => db.vacations.toArray()) || []

  if (!settings) return null

  async function updateSetting(key, value) {
    await db.settings.update(settings.id, { [key]: value })
  }

  function toggleDay(day) {
    const current = settings.workDays || [1, 2, 3, 4, 5]
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => a - b)
    updateSetting('workDays', next)
  }

  async function handleExport() {
    exportAll(allEntries, allVacations, settings)
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const { entries, vacations, settings: importedSettings } = await importAll(file)
      let msg = []
      if (entries.length > 0) {
        await db.timeEntries.bulkAdd(entries)
        msg.push(`${entries.length} Zeiteinträge`)
      }
      if (vacations.length > 0) {
        await db.vacations.bulkAdd(vacations)
        msg.push(`${vacations.length} Abwesenheiten`)
      }
      if (importedSettings) {
        const current = await db.settings.toCollection().first()
        if (current) {
          await db.settings.update(current.id, importedSettings)
        }
        msg.push('Einstellungen')
      }
      alert(msg.length > 0 ? `Importiert: ${msg.join(', ')}` : 'Keine Daten gefunden')
    }
    input.click()
  }

  if (showVacations) return <VacationManager onClose={() => setShowVacations(false)} />
  if (showOvertime) return <OvertimeAccount onClose={() => setShowOvertime(false)} />

  return (
    <div className="page">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Einstellungen</h1>

      {/* Jobs */}
      <SectionHeader>Dein Job</SectionHeader>
      <div style={{ background: 'var(--card)', borderRadius: 12, marginBottom: 24 }}>
        <button onClick={() => setEditPlan(!editPlan)} style={menuItemStyle}>
          <span>📋 {settings.planName || 'Mein Job'}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{editPlan ? '▼' : '›'}</span>
        </button>
      </div>

      {editPlan && (<>
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          {/* Plan name */}
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={settings.planName || ''}
            onChange={e => updateSetting('planName', e.target.value)}
            style={inputStyle}
          />

          {/* Weekly hours */}
          <label style={{ ...labelStyle, marginTop: 16 }}>Wochenstunden</label>
          <input
            type="number"
            value={settings.weeklyHours}
            onChange={e => updateSetting('weeklyHours', Number(e.target.value))}
            style={inputStyle}
            min={0}
            max={168}
            step={0.5}
          />

          {/* Bundesland */}
          <label style={{ ...labelStyle, marginTop: 16 }}>Bundesland (Feiertage)</label>
          <select
            value={settings.bundesland || 'NW'}
            onChange={e => updateSetting('bundesland', e.target.value)}
            style={inputStyle}
          >
            {getBundeslaender().map(bl => (
              <option key={bl.code} value={bl.code}>{bl.name}</option>
            ))}
          </select>
          <button onClick={async () => {
            const bl = settings.bundesland || 'NW'
            const year = new Date().getFullYear()
            const years = [year, year + 1]
            let added = 0
            for (const y of years) {
              const feiertage = getFeiertage(y, bl)
              const existing = await db.vacations.where('type').equals('Feiertag').toArray()
              for (const ft of feiertage) {
                const exists = existing.some(v => v.startDate === ft.date && v.endDate === ft.date)
                if (!exists) {
                  await db.vacations.add({ startDate: ft.date, endDate: ft.date, type: 'Feiertag', note: ft.name })
                  added++
                }
              }
            }
            const blName = getBundeslaender().find(b => b.code === bl)?.name || bl
            alert(`${added} Feiertage für ${year} und ${year + 1} eingetragen (${blName})`)
          }} style={{
            marginTop: 8, padding: '10px 0', borderRadius: 8, border: 'none', width: '100%',
            background: 'var(--blue)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Feiertage synchronisieren</button>

          {/* Vacation days */}
          <label style={{ ...labelStyle, marginTop: 16 }}>Urlaubstage pro Jahr</label>
          <input
            type="number"
            value={settings.vacationDaysPerYear || 30}
            onChange={e => updateSetting('vacationDaysPerYear', Number(e.target.value))}
            style={inputStyle}
            min={0}
            max={365}
          />

          {/* Workdays */}
          <label style={{ ...labelStyle, marginTop: 16 }}>Wochentage</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {DAY_VALUES.map((day, i) => {
              const active = (settings.workDays || [1, 2, 3, 4, 5]).includes(day)
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    border: `2px solid ${active ? 'var(--olive)' : '#3a3a3c'}`,
                    background: active ? 'var(--olive)' : 'transparent',
                    color: active ? '#000' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {DAY_LABELS[i]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Zuschläge */}
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginTop: 12 }}>
          <label style={labelStyle}>Zeitzuschläge (max. 4)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(settings.multipliers || [1, 1.25, 1.5, 2]).map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={m}
                  step="0.01"
                  min="0.5"
                  max="5"
                  onChange={e => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val > 0) {
                      const newMults = [...(settings.multipliers || [1, 1.25, 1.5, 2])]
                      newMults[i] = val
                      updateSetting('multipliers', newMults)
                    }
                  }}
                  style={{ ...inputStyle, width: 80, textAlign: 'center', flex: 'none' }}
                />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {m === 1 ? 'Normal' : `+${Math.round((m - 1) * 100)}% Zuschlag`}
                </span>
                {(settings.multipliers || []).length > 1 && (
                  <button onClick={() => {
                    const newMults = [...(settings.multipliers || [1, 1.25, 1.5, 2])]
                    newMults.splice(i, 1)
                    updateSetting('multipliers', newMults)
                  }} style={{
                    width: 32, height: 32, borderRadius: 8, border: 'none',
                    background: 'transparent', color: 'var(--red)', fontSize: 18, cursor: 'pointer',
                  }}>✕</button>
                )}
              </div>
            ))}
          </div>
          {(settings.multipliers || [1, 1.25, 1.5, 2]).length < 4 && (
            <button onClick={() => {
              const mults = [...(settings.multipliers || [1, 1.25, 1.5, 2])]
              mults.push(1)
              updateSetting('multipliers', mults)
            }} style={{
              width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 8,
              border: '1px dashed var(--divider)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
            }}>+ Zuschlag hinzufügen</button>
          )}
        </div>
      </>)}

      {/* Daten */}
      <SectionHeader>Daten</SectionHeader>
      <div style={{ background: 'var(--card)', borderRadius: 12, marginBottom: 24 }}>
        <button onClick={handleExport} style={menuItemStyle}>
          <span>📄 Alle Daten als CSV exportieren</span>
          <span style={{ color: 'var(--text-secondary)' }}>›</span>
        </button>
        <div style={{ borderBottom: '1px solid var(--divider)', marginLeft: 16 }} />
        <button onClick={handleImport} style={menuItemStyle}>
          <span>📥 Daten aus CSV importieren</span>
          <span style={{ color: 'var(--text-secondary)' }}>›</span>
        </button>
      </div>

      {/* Darstellung */}
      <SectionHeader>Darstellung</SectionHeader>
      <div style={{ background: 'var(--card)', borderRadius: 12, marginBottom: 24 }}>
        <button onClick={() => setShowTheme(!showTheme)} style={menuItemStyle}>
          <span>🌗 Erscheinungsbild</span>
          <span style={{ color: 'var(--text-secondary)' }}>{showTheme ? '▼' : '›'}</span>
        </button>
        {showTheme && (
          <div style={{ padding: '0 16px 12px' }}>
            {[
              { value: 'system', label: 'System (automatisch)' },
              { value: 'dark', label: 'Dunkel' },
              { value: 'light', label: 'Hell' },
            ].map(opt => (
              <button key={opt.value} onClick={() => {
                setThemeMode(opt.value)
                try { localStorage.setItem('themeMode', opt.value) } catch {}
                const root = document.documentElement
                if (opt.value === 'dark') root.setAttribute('data-theme', 'dark')
                else if (opt.value === 'light') root.setAttribute('data-theme', 'light')
                else root.removeAttribute('data-theme')
              }} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '12px 0', background: 'none', border: 'none',
                borderBottom: opt.value !== 'light' ? '1px solid var(--divider)' : 'none',
                color: 'var(--text)', fontSize: 15, cursor: 'pointer', textAlign: 'left',
              }}>
                <span>{opt.label}</span>
                {themeMode === opt.value && <span style={{ color: 'var(--blue)', fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zeit und Ort */}
      <SectionHeader>Zeit und Ort</SectionHeader>
      <div style={{ background: 'var(--card)', borderRadius: 12, marginBottom: 24 }}>
        <button onClick={() => setShowOvertime(true)} style={menuItemStyle}>
          <span>⏱ Überstundenkonto</span>
          <span style={{ color: 'var(--text-secondary)' }}>›</span>
        </button>
        <div style={{ borderBottom: '1px solid var(--divider)', marginLeft: 16 }} />
        <button onClick={() => setShowVacations(true)} style={menuItemStyle}>
          <span>📅 Abwesenheiten</span>
          <span style={{ color: 'var(--text-secondary)' }}>›</span>
        </button>
      </div>

      {/* Danger zone */}
      <SectionHeader>Daten</SectionHeader>
      <div style={{ background: 'var(--card)', borderRadius: 12 }}>
        <button onClick={async () => {
          if (confirm('Alle Zeiteinträge löschen? Dies kann nicht rückgängig gemacht werden.')) {
            await db.timeEntries.clear()
            alert('Alle Zeiteinträge gelöscht.')
          }
        }} style={{ ...menuItemStyle, color: 'var(--red)' }}>
          <span>🗑 Alle Zeiteinträge löschen</span>
        </button>
        <div style={{ borderBottom: '1px solid var(--divider)', marginLeft: 16 }} />
        <button onClick={async () => {
          if (confirm('ALLE Daten löschen (Zeiteinträge, Abwesenheiten, Einstellungen)? Dies kann nicht rückgängig gemacht werden.')) {
            await db.timeEntries.clear()
            await db.vacations.clear()
            await db.overtimeAdjustments.clear()
            await db.settings.clear()
            const { initDefaults } = await import('../db')
            await initDefaults()
            alert('Alle Daten gelöscht und zurückgesetzt.')
          }
        }} style={{ ...menuItemStyle, color: 'var(--red)' }}>
          <span>🗑 Kompletter Reset (alle Daten)</span>
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
      {children}
    </div>
  )
}

const menuItemStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  width: '100%', padding: '14px 16px', background: 'none', border: 'none',
  color: 'var(--text)', fontSize: 15, cursor: 'pointer', textAlign: 'left',
}

const labelStyle = {
  display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6,
}

const inputStyle = {
  width: '100%', padding: '12px 14px', background: 'var(--bg-input)',
  border: '1px solid var(--divider)', borderRadius: 10, color: 'var(--text)',
  fontSize: 16, outline: 'none', boxSizing: 'border-box',
}
