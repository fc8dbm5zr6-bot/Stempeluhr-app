import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../db'
import { todayStr } from '../utils/calculations'
import { useLiveQuery } from 'dexie-react-hooks'

export function useTimer() {
  const [status, setStatus] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [currentEntryId, setCurrentEntryId] = useState(null)
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)

  const today = todayStr()

  const todayEntries = useLiveQuery(
    () => db.timeEntries.where('date').equals(today).toArray(),
    [today],
    []
  )

  const startTicking = useCallback((fromTime) => {
    startTimeRef.current = fromTime
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }, [])

  useEffect(() => {
    async function checkOpen() {
      const openEntry = await db.timeEntries
        .where('date').equals(today)
        .filter(e => !e.endTime)
        .first()
      if (openEntry) {
        setCurrentEntryId(openEntry.id)
        const startMs = new Date(openEntry.startTime).getTime()
        if (openEntry.type === 'pause') {
          setStatus('paused')
          startTicking(startMs)
        } else {
          setStatus('running')
          startTicking(startMs)
        }
      }
    }
    checkOpen()
    return () => clearInterval(intervalRef.current)
  }, [today, startTicking])

  const start = useCallback(async () => {
    const now = new Date().toISOString()
    const id = await db.timeEntries.add({
      date: today,
      startTime: now,
      endTime: null,
      type: 'work',
      comment: '',
    })
    setCurrentEntryId(id)
    setStatus('running')
    startTicking(Date.now())
  }, [today, startTicking])

  const pause = useCallback(async () => {
    const now = new Date().toISOString()
    if (currentEntryId) {
      await db.timeEntries.update(currentEntryId, { endTime: now })
    }
    const id = await db.timeEntries.add({
      date: today,
      startTime: now,
      endTime: null,
      type: 'pause',
      comment: '',
    })
    setCurrentEntryId(id)
    setStatus('paused')
    setElapsed(0)
    startTicking(Date.now())
  }, [currentEntryId, today, startTicking])

  const resume = useCallback(async () => {
    const now = new Date().toISOString()
    if (currentEntryId) {
      await db.timeEntries.update(currentEntryId, { endTime: now })
    }
    const id = await db.timeEntries.add({
      date: today,
      startTime: now,
      endTime: null,
      type: 'work',
      comment: '',
    })
    setCurrentEntryId(id)
    setStatus('running')
    setElapsed(0)
    startTicking(Date.now())
  }, [currentEntryId, today, startTicking])

  const stop = useCallback(async () => {
    const now = new Date().toISOString()
    if (currentEntryId) {
      await db.timeEntries.update(currentEntryId, { endTime: now })
    }
    setCurrentEntryId(null)
    setStatus('idle')
    setElapsed(0)
    clearInterval(intervalRef.current)
  }, [currentEntryId])

  return { status, elapsed, todayEntries, start, pause, resume, stop, today }
}
