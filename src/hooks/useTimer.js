import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { db } from '../db'
import { todayStr } from '../utils/calculations'
import { useLiveQuery } from 'dexie-react-hooks'

export function useTimer() {
  const [status, setStatus] = useState('idle')
  const [currentEntryId, setCurrentEntryId] = useState(null)
  const [tick, setTick] = useState(0)
  const intervalRef = useRef(null)

  const today = todayStr()

  const todayEntries = useLiveQuery(
    () => db.timeEntries.where('date').equals(today).toArray(),
    [today],
    []
  )

  const openEntry = useMemo(
    () => todayEntries.find(e => !e.endTime),
    [todayEntries]
  )

  useEffect(() => {
    if (openEntry) {
      setCurrentEntryId(openEntry.id)
      setStatus(openEntry.type === 'pause' ? 'paused' : 'running')
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => setTick(t => t + 1), 1000)
      }
    } else if (todayEntries.length > 0 && !openEntry) {
      if (status !== 'idle') setStatus('idle')
    }
    return () => {}
  }, [openEntry, todayEntries.length])

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  const elapsed = useMemo(() => {
    if (!openEntry) return 0
    return Math.max(0, Math.floor((Date.now() - new Date(openEntry.startTime).getTime()) / 1000))
  }, [openEntry, tick])

  const start = useCallback(async () => {
    const now = new Date().toISOString()
    const id = await db.timeEntries.add({
      date: today, startTime: now, endTime: null, type: 'work', comment: '',
    })
    setCurrentEntryId(id)
    setStatus('running')
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000)
  }, [today])

  const pause = useCallback(async () => {
    const now = new Date().toISOString()
    if (currentEntryId) await db.timeEntries.update(currentEntryId, { endTime: now })
    const id = await db.timeEntries.add({
      date: today, startTime: now, endTime: null, type: 'pause', comment: '',
    })
    setCurrentEntryId(id)
    setStatus('paused')
  }, [currentEntryId, today])

  const resume = useCallback(async () => {
    const now = new Date().toISOString()
    if (currentEntryId) await db.timeEntries.update(currentEntryId, { endTime: now })
    const id = await db.timeEntries.add({
      date: today, startTime: now, endTime: null, type: 'work', comment: '',
    })
    setCurrentEntryId(id)
    setStatus('running')
  }, [currentEntryId, today])

  const stop = useCallback(async () => {
    const now = new Date().toISOString()
    if (currentEntryId) await db.timeEntries.update(currentEntryId, { endTime: now })
    setCurrentEntryId(null)
    setStatus('idle')
    clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [currentEntryId])

  return { status, elapsed, todayEntries, start, pause, resume, stop, today }
}
