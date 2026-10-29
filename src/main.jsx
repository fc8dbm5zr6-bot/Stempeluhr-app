import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { initDefaults } from './db'

try {
  const mode = localStorage.getItem('themeMode')
  if (mode === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light')
} catch {}

initDefaults().catch(err => {
  console.error('DB init error:', err)
  document.getElementById('root').innerHTML = `<div style="padding:40px;color:red;font-family:system-ui">${err.message}</div>`
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
