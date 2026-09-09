import { describe, expect, it } from 'vitest'
import { chemistry } from '../score.js'
import { resolveEvent } from '../resolve.js'
import { scoreFrom, shareGrid, tierFor } from '../verdict.js'
import type { RoleVerdict } from '../verdict.js'
import { loadEvents, loadPoliticians } from '../content.js'
import { ROLES } from '../types.js'
import type { Politician, Roster } from '../types.js'

const dummy = (id: string, over: Partial<Politician> = {}): Politician => ({
  id, category: 'politician', tier: 'operator', alignment: 'neutral', name: id,
  country: 'Nowhere', era: 'Now', office: 'None', bio: '', traits: [], reviewed: true, ...over,
})

const rosterOf = (p: Politician): Roster =>
  Object.fromEntries(ROLES.map((r) => [r, p])) as Roster

const all = (verdict: RoleVerdict['verdict']): RoleVerdict[] =>
  ROLES.map((role) => ({ role, verdict, reason: 'because' }))

describe('turning verdicts into a score', () => {
  it('lets a cabinet that did everything asked of it reach the top tier', () => {
    // The old numeric scoring could not: Legendary came out at 0.0-0.1% across
    // every event because the stat budgets compressed everything to the middle.
    expect(scoreFrom(all('triumph'))).toBe(100)
    expect(tierFor(scoreFrom(all('triumph')))).toBe('Legendary')
  })

  it('bottoms out for a cabinet that failed everything', () => {
    expect(scoreFrom(all('disaster'))).toBe(0)
    expect(tierFor(scoreFrom(all('disaster')))).toBe('Catastrophe')
  })

  it('orders the four verdicts', () => {
    const scores = (['disaster', 'fail', 'pass', 'triumph'] as const).map((v) => scoreFrom(all(v)))
    expect(scores).toEqual([...scores].sort((a, b) => a - b))
    expect(new Set(scores).size).toBe(4)
  })

  it('weights a post the event cares about more heavily', () => {
    const heavy: RoleVerdict[] = [
      { role: 'President', verdict: 'disaster', reason: '', weight: 3 },
      { role: 'Treasurer', verdict: 'triumph', reason: '', weight: 1 },
    ]
    const even: RoleVerdict[] = heavy.map((v) => ({ ...v, weight: 1 }))
    expect(scoreFrom(heavy)).toBeLessThan(scoreFrom(even))
  })

  it('applies chemistry to the total', () => {
    expect(scoreFrom(all('pass'), -12)).toBeLessThan(scoreFrom(all('pass')))
    expect(scoreFrom(all('pass'), 12)).toBeGreaterThan(scoreFrom(all('pass')))
  })

  it('never leaves the 0-100 range whatever chemistry does', () => {
    expect(scoreFrom(all('triumph'), 50)).toBe(100)
    expect(scoreFrom(all('disaster'), -50)).toBe(0)
  })

  it('draws one square per post and leaves untested posts blank', () => {
    const grid = shareGrid([{ role: 'President', verdict: 'triumph', reason: '' }])
    expect([...grid]).toHaveLength(ROLES.length)
    expect(grid.startsWith('🟩')).toBe(true)
    expect(grid).toContain('⬜')
  })
})

describe('chemistry, which never depended on the numbers', () => {
  it('penalises a cabinet of rivals', () => {
    const a = dummy('a', { rivals: ['b'] })
    const b = dummy('b')
    const roster = { ...rosterOf(a), Treasurer: b } as Roster
    const result = chemistry(roster)
    expect(result.effects.some((e) => e.id.startsWith('rivalry'))).toBe(true)
    expect(result.total).toBeLessThan(0)
  })

  it('rewards a cabinet from one time and place', () => {
    const result = chemistry(rosterOf(dummy('a')))
    expect(result.effects.map((e) => e.id)).toEqual(
      expect.arrayContaining(['same-era', 'same-country']),
    )
    expect(result.total).toBeGreaterThan(0)
  })

  it('will not depose a President who is not out of their depth', () => {
    const strong = dummy('strong', { tier: 'titan' })
    const grasping = dummy('grasping', { tier: 'titan', traits: ['paranoid', 'cunning'] })
    const roster = { ...rosterOf(strong), VicePresident: grasping } as Roster
    expect(chemistry(roster).coup).toBeNull()
  })

  it('deposes a President who is, when the deputy is the grasping sort', () => {
    const weak = dummy('weak', { tier: 'liability' })
    const grasping = dummy('grasping', { tier: 'titan', traits: ['paranoid', 'cunning'] })
    const roster = { ...rosterOf(weak), VicePresident: grasping } as Roster
    expect(chemistry(roster).coup?.usurper).toBe('VicePresident')
  })

  it('never lets furniture mount a coup', () => {
    const weak = dummy('weak', { tier: 'liability' })
    const thing = dummy('thing', { tier: 'titan', category: 'object', traits: ['paranoid', 'cunning'] })
    const roster = { ...rosterOf(weak), VicePresident: thing } as Roster
    expect(chemistry(roster).coup).toBeNull()
  })
})

describe('the fallback adjudicator', () => {
  const events = loadEvents()
  const figures = loadPoliticians()

  it('judges every post and stays inside the tier bands', () => {
    for (const event of events) {
      const result = resolveEvent(event, rosterOf(figures[0]!))
      expect(result.verdicts.length, event.id).toBe(event.checks.length + 1)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.judged, event.id).toBe(false)
    }
  })

  it('is deterministic for the same cabinet and crisis', () => {
    const roster = rosterOf(figures[3]!)
    const a = resolveEvent(events[0]!, roster)
    const b = resolveEvent(events[0]!, roster)
    expect(a.verdicts).toEqual(b.verdicts)
    expect(a.score).toBe(b.score)
  })

  it('does not let furniture triumph', () => {
    const thing = figures.find((f) => f.category === 'object')!
    for (const event of events) {
      const result = resolveEvent(event, rosterOf(thing))
      expect(result.verdicts.every((v) => v.verdict !== 'triumph'), `${event.id}/${thing.id}`).toBe(true)
    }
  })
})
