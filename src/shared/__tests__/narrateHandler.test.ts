import { describe, expect, it } from 'vitest'
import { narrate } from '../../../api/narrate.js'

/**
 * The narrator endpoint's gate.
 *
 * This file used to test that the handler answered two calling conventions,
 * because Vercel's Node runtime invoked it as (req, res) while everything else
 * handed it a Web Request - and getting that wrong did not throw, it hung until
 * the platform gave up and the game quietly fell back to templates. That
 * shipped once. With Vercel retired there is one convention left and the
 * adapter is gone, so what is worth testing is the gate itself: who gets
 * turned away, and who gets as far as being read.
 *
 * These stop at the 403/405/400 paths, so nothing reaches the API and the
 * tests cost nothing.
 *
 * It lives here rather than beside the handler because a test importing vitest
 * is not something a serverless build wants to find in an api/ directory.
 */
const post = (headers: Record<string, string>, body = '{"not":"a valid request"}') =>
  narrate(new Request('https://hells.example/api/narrate', { method: 'POST', headers, body }))

describe('the narrator endpoint', () => {
  it('answers a Web Request with a Response', async () => {
    const result = await narrate(new Request('https://hells.example/api/narrate', { method: 'GET' }))

    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(405)
    expect(await result.json()).toEqual({ error: 'POST only' })
    expect(result.headers.get('content-type')).toBe('application/json')
  })

  it('reads the body of a request it accepts', async () => {
    const result = await post({ host: 'hells.example', origin: 'https://hells.example' })

    // 400 means the body arrived and the schema rejected it; 503 means there is
    // no key in this environment, which is equally proof it got past the gate.
    // A hang or a 500 would mean it never got there.
    expect([400, 503]).toContain(result.status)
  })

  it('turns away a request from another origin', async () => {
    const result = await post({ host: 'hells.example', origin: 'https://somewhere.else' })
    expect(result.status).toBe(403)
  })

  it('turns away a request with no origin at all', async () => {
    // No Origin is a request no browser made - curl, mostly, which is the thing
    // being kept out.
    const result = await post({ host: 'hells.example' })
    expect(result.status).toBe(403)
  })

  it('lets an explicitly allowed second origin through', async () => {
    // The embedding case: served from one domain, answering on another.
    process.env.ALLOWED_ORIGIN = 'https://embedded.example'
    try {
      const result = await post({ host: 'hells.example', origin: 'https://embedded.example' })
      expect(result.status).not.toBe(403)
    } finally {
      delete process.env.ALLOWED_ORIGIN
    }
  })
})
