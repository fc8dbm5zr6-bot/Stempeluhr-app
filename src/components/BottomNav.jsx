const tabs = [
  { id: 'start', label: 'Start', icon: '▶' },
  { id: 'woche', label: 'Woche', icon: '☰' },
  { id: 'monat', label: 'Monat', icon: '📅' },
  { id: 'setup', label: 'Setup', icon: '⚙' },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`nav-item${isActive ? ' active' : ''}`}
          >
            <span style={{ fontSize: tab.id === 'monat' ? 20 : 22 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
