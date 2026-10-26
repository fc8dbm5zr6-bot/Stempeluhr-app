const BUNDESLAENDER = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
}

function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getFeiertage(year, bundesland = 'NW') {
  const easter = easterSunday(year)
  const all = [
    { date: `${year}-01-01`, name: 'Neujahr' },
    { date: fmt(addDays(easter, -2)), name: 'Karfreitag' },
    { date: fmt(addDays(easter, 1)), name: 'Ostermontag' },
    { date: `${year}-05-01`, name: 'Tag der Arbeit' },
    { date: fmt(addDays(easter, 39)), name: 'Christi Himmelfahrt' },
    { date: fmt(addDays(easter, 50)), name: 'Pfingstmontag' },
    { date: `${year}-10-03`, name: 'Tag der Deutschen Einheit' },
    { date: `${year}-12-25`, name: '1. Weihnachtsfeiertag' },
    { date: `${year}-12-26`, name: '2. Weihnachtsfeiertag' },
  ]

  if (['BW', 'BY', 'ST'].includes(bundesland)) {
    all.push({ date: `${year}-01-06`, name: 'Heilige Drei Könige' })
  }
  if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(bundesland)) {
    all.push({ date: fmt(addDays(easter, 60)), name: 'Fronleichnam' })
  }
  if (['BY', 'SL'].includes(bundesland)) {
    all.push({ date: `${year}-08-15`, name: 'Mariä Himmelfahrt' })
  }
  if (['BB', 'MV', 'SN', 'ST', 'TH'].includes(bundesland)) {
    all.push({ date: `${year}-10-31`, name: 'Reformationstag' })
  }
  if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(bundesland)) {
    all.push({ date: `${year}-11-01`, name: 'Allerheiligen' })
  }
  if (bundesland === 'SN') {
    const nov23 = new Date(year, 10, 23)
    let bbt = new Date(year, 10, 23 - ((nov23.getDay() + 3) % 7))
    all.push({ date: fmt(bbt), name: 'Buß- und Bettag' })
  }
  if (['BE', 'HB', 'HH', 'MV', 'NI', 'SH', 'TH', 'SN', 'ST', 'BB'].includes(bundesland)) {
    if (!['SN', 'ST', 'BB'].includes(bundesland) || year >= 2019) {
      // Frauentag for Berlin, Weltkindertag for Thüringen
    }
  }
  if (bundesland === 'BE') {
    all.push({ date: `${year}-03-08`, name: 'Internationaler Frauentag' })
  }
  if (bundesland === 'TH') {
    all.push({ date: `${year}-09-20`, name: 'Weltkindertag' })
  }
  if (['HB', 'HH', 'NI', 'SH'].includes(bundesland)) {
    all.push({ date: `${year}-10-31`, name: 'Reformationstag' })
  }
  if (bundesland === 'MV') {
    all.push({ date: `${year}-03-08`, name: 'Internationaler Frauentag' })
  }

  return all.sort((a, b) => a.date.localeCompare(b.date))
}

export function getBundeslaender() {
  return Object.entries(BUNDESLAENDER).map(([code, name]) => ({ code, name }))
}

export { BUNDESLAENDER }
