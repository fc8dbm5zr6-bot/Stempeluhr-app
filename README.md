# Stempeluhr

Zeiterfassungs-App für iPhone und Web. Einfach Arbeitszeiten tracken, Überstunden verwalten und Urlaub planen — komplett offline, ohne Account, ohne Cloud.

**Live-App:** [stempeluhr-app.vercel.app](https://stempeluhr-app.vercel.app)

## Features

- **Stempeluhr** — Start/Pause/Stopp mit fortlaufender Tageszeit
- **Zeitkonto** — automatische Überstundenberechnung ab dem ersten Tracking-Tag
- **Urlaubsverwaltung** — Urlaubstage planen, Resttage im Blick behalten
- **Freizeitausgleich** — Überstunden abfeiern als eigener Abwesenheitstyp
- **Zuschläge** — 1,25x / 1,5x / 2x für Wochenend- oder Nachtarbeit
- **Wochenübersicht** — tägliche Arbeitszeit mit +/- Differenz, Swipe-Navigation
- **Monatsübersicht** — Balkendiagramm pro KW, Soll/Ist-Vergleich
- **Feiertage** — gesetzliche Feiertage nach Bundesland (offline berechnet)
- **CSV Import/Export** — alle Daten in einer Datei, als Backup oder zur Migration
- **Monatliches Backup** — Erinnerung zum Sichern der Daten
- **Light & Dark Mode** — passt sich automatisch an das System-Theme an
- **Offline-fähig** — alle Daten lokal auf dem Gerät, kein Server nötig

## Installation

### Als Web-App (empfohlen)

1. [stempeluhr-app.vercel.app](https://stempeluhr-app.vercel.app) im Browser öffnen
2. **iPhone:** Safari → Teilen → "Zum Home-Bildschirm"
3. **Android:** Chrome → "Zum Startbildschirm hinzufügen"

### Als native iOS-App

Voraussetzung: Mac mit Xcode, iPhone per USB verbunden.

```bash
git clone https://github.com/DEIN-USERNAME/stempeluhr.git
cd stempeluhr
npm install
npm run build
npx cap sync ios
open ios/App/App.xcodeproj
# In Xcode: iPhone auswählen → ▶ drücken
```

## Tech-Stack

- React 18 + Vite
- Capacitor (native iOS-App)
- Dexie.js (IndexedDB)
- date-fns
- PWA mit Service Worker

## Datenschutz

Alle Daten werden ausschließlich lokal auf dem Gerät gespeichert (IndexedDB). Es werden keine Daten an Server übertragen. Kein Account, kein Tracking, keine Cookies.

## Lizenz

MIT
