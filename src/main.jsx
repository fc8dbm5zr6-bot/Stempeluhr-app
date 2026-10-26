import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { initDefaults } from './db'

initDefaults().catch(err => {
  console.error('DB init error:', err)
  document.getElementById('root').innerHTML = `<div style="padding:40px;color:red;font-family:system-ui">${err.message}</div>`
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
