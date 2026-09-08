import { describe, expect, it } from 'vitest'
import { ROLE_WEIGHTS, roleScore } from '../score.js'
import { resolveEvent, tierFor } from '../resolve.js'
import { loadEvents, loadPoliticians } from '../content.js'
import { ROLES } from '../types.js'
import type { Politician, Roster, StatBlock } from '../types.js'

const flat = (n: number): StatBlock => ({
  charisma: n, cunning: n, integrity: n, grit: n, intellect: n, force: n,
})

const dummy = (id: string, stats: StatBlock, traits: string[] = []): Politician => ({
  id, category: 'politician', tier: 'operator', name: id, country: 'Nowhere', era: 'Now', office: 'None',
  bio: '', stats, traits, reviewed: true,
})

const rosterOf = (p: Politician): Roster =>
  Object.fromEntries(ROLES.map((r) => [r, p])) as Roster

describe('role scoring', () => {
  it('normalises every role to the full 0-100 range', () => {
    for (const role of ROLES) {
      expect(roleScore(flat(1), role)).toBeGreaterThanOrEqual(0)
      expect(roleScore(flat(10), role)).toBeLessThanOrEqual(100)
    }
  })

  it('penalises integrity for the Propaganda Minister', () => {
    const honest = { ...flat(5), integrity: 10 }
    const shameless = { ...flat(5), integrity: 1 }
    expect(roleScore(shameless, 'PropagandaMinister')).toBeGreaterThan(
      roleScore(honest, 'PropagandaMinister'),
    )
    // ...and rewards it everywhere else it appears.
    expect(roleScore(honest, 'Treasurer')).toBeGreaterThan(roleScore(shameless, 'Treasurer'))
  })

  it('keeps the negative weight deliberate, not a typo', () => {
    expect(ROLE_WEIGHTS.PropagandaMinister.integrity).toBeLessThan(0)
  })
})

describe('event resolution', () => {
  const cuban = loadEvents().find((e) => e.id === 'cuban-missile-crisis')!

  it('rewards restraint on an inverted check', () => {
    const check = cuban.checks.find((c) => c.invert)!
    const hot = resolveEvent(cuban, rosterOf(dummy('hot', { ...flat(5), force: 10 })))
    const cool = resolveEvent(cuban, rosterOf(dummy('cool', { ...flat(5), force: 1 })))
    const valueOf = (r: typeof hot) => r.checks.find((c) => c.check === check)!.value
    expect(valueOf(cool)).toBeGreaterThan(valueOf(hot))
  })

  it('always resolves the hidden twist alongside the public checks', () => {
    const result = resolveEvent(cuban, rosterOf(dummy('x', flat(5))))
    expect(result.checks.filter((c) => c.isTwist)).toHaveLength(1)
    expect(result.checks).toHaveLength(cuban.checks.length + 1)
  })

  it('emits one share-grid square per role', () => {
    const result = resolveEvent(cuban, rosterOf(dummy('x', flat(5))))
    expect([...result.grid]).toHaveLength(ROLES.length)
  })

  it('applies a rivalry penalty when both rivals are drafted', () => {
    const politicians = loadPoliticians()
    const churchill = politicians.find((p) => p.id === 'churchill')!
    const chamberlain = politicians.find((p) => p.id === 'chamberlain')!
    const roster = { ...rosterOf(dummy('x', flat(5))), President: churchill, VicePresident: chamberlain }
    const result = resolveEvent(cuban, roster)
    expect(result.chemistry.effects.some((e) => e.id === 'rivalry')).toBe(true)
    expect(result.chemistry.total).toBeLessThan(0)
  })

  it('maps scores onto tiers at the documented boundaries', () => {
    expect(tierFor(0)).toBe('Catastrophe')
    expect(tierFor(45)).toBe('Muddled Through')
    expect(tierFor(80)).toBe('Legendary')
  })
})
