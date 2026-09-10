import { describe, expect, it } from 'vitest'
import { isDaily, isStaleDaily, runFromUrl, sharedFromUrl } from '../session.js'
import { createRun, todayKey } from '../../engine/run.js'
import { EVENTS } from '../data.js'
import { ROLES } from '../../engine/types.js'

const dayBefore = (key: string) => {
  const d = new Date(`${key}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

describe('the daily turns over', () => {
  it('drops a daily save from a previous day', () => {
    // The bug this exists for: nothing checked the date, so the first player to
    // finish a daily was pinned to it for good.
    expect(isStaleDaily({ seed: dayBefore(todayKey()), eventId: null })).toBe(true)
    expect(isStaleDaily({ seed: '2024-01-01', eventId: null })).toBe(true)
  })

  it('keeps today’s own daily, finished or not', () => {
    expect(isStaleDaily({ seed: todayKey(), eventId: null })).toBe(false)
  })

  it('never expires a shared link', () => {
    // A sent cabinet carries its own seed and crisis. It is no more stale
    // tomorrow than it was when somebody sent it.
    expect(isStaleDaily({ seed: 'ab12cd34', eventId: EVENTS[0]!.id })).toBe(false)
    expect(isStaleDaily({ seed: dayBefore(todayKey()), eventId: EVENTS[0]!.id })).toBe(false)
  })

  it('only today’s dated run counts as the daily', () => {
    expect(isDaily({ seed: todayKey(), eventId: null })).toBe(true)
    expect(isDaily({ seed: dayBefore(todayKey()), eventId: null })).toBe(false)
  })
})

describe('one crisis a day', () => {
  it('gives every player on a given date the same crisis', () => {
    const a = createRun('2026-09-10', EVENTS, null)
    const b = createRun('2026-09-10', EVENTS, null)
    expect(a.event.id).toBe(b.event.id)
  })

  it('does not hand out the same crisis two days running', () => {
    // Not a guarantee the seeding can make, but a run of identical days would
    // mean the date is not reaching the draw.
    const week = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']
      .map((d) => createRun(d, EVENTS, null).event.id)
    expect(new Set(week).size).toBeGreaterThan(1)
  })
})

describe('free play is a development affordance', () => {
  const link = `?event=${EVENTS[0]!.id}&seed=2026-01-01`

  it('opens a named crisis when the build allows it', () => {
    expect(runFromUrl(link, true)).toEqual({ seed: '2026-01-01', eventId: EVENTS[0]!.id })
  })

  it('refuses one when it does not', () => {
    // Otherwise the crisis picker is still there, just typed instead of clicked,
    // and one crisis a day stops being true the moment anyone notices.
    expect(runFromUrl(link, false)).toBeNull()
  })

  it('still opens a cabinet somebody sent, either way', () => {
    // The link a player shares has to work for the person who receives it.
    const picks = ROLES.map(() => 'lincoln').join('.')
    const marks = ROLES.map(() => 'pass').join('.')
    const sent = sharedFromUrl(`${link}&picks=${picks}&marks=${marks}&score=70`)
    expect(sent?.ref.eventId).toBe(EVENTS[0]!.id)
  })
})
