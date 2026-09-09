import { describe, expect, it } from 'vitest'
import { EventEmitter } from 'node:events'
import handler from '../../../api/narrate.js'

/**
 * The handler is invoked two different ways and has to answer both.
 *
 * Vercel's Node runtime calls it as (req, res) with streams; the local dev and
 * preview servers hand it a Web Request and use the returned Response. Getting
 * this wrong does not throw: the request simply hangs until the platform times
 * it out, the client falls back to templates, and the game looks like it is
 * working but bland. It shipped that way once, which is why it is tested.
 *
 * These use the 405 path so nothing reaches the API and the tests cost nothing.
 *
 * It lives here rather than beside the handler because Vercel turns every file
 * under api/ into a serverless function, and a test importing vitest is not a
 * function it can build.
 */
function fakeNodeRequest(method: string) {
  const req = new EventEmitter() as EventEmitter & { method: string; url: string }
  req.method = method
  req.url = '/api/narrate'
  // Nothing is written, so end fires on the next tick.
  queueMicrotask(() => req.emit('end'))
  return req
}

function fakeNodeResponse() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as string | undefined,
    setHeader(name: string, value: string) { this.headers[name] = value },
    end(body?: string) { this.body = body },
  }
}

describe('the narrator endpoint answers both calling conventions', () => {
  it('returns a Response when handed a Web Request', async () => {
    const result = await handler(new Request('https://local/api/narrate', { method: 'GET' }))

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(405)
  })

  it('writes to res when called as (req, res), rather than hanging', async () => {
    const res = fakeNodeResponse()
    await handler(fakeNodeRequest('GET'), res)

    // The failure this guards against is silence: no status, no body, no end.
    expect(res.statusCode).toBe(405)
    expect(res.body).toBeDefined()
    expect(JSON.parse(res.body!)).toEqual({ error: 'POST only' })
    expect(res.headers['content-type']).toBe('application/json')
  })

  it('reads a streamed body when called as (req, res)', async () => {
    const req = new EventEmitter() as EventEmitter & { method: string; url: string }
    req.method = 'POST'
    req.url = '/api/narrate'
    queueMicrotask(() => {
      req.emit('data', Buffer.from('{"not":"a valid request"}'))
      req.emit('end')
    })

    const res = fakeNodeResponse()
    await handler(req, res)

    // 400 means the body arrived and was rejected by the schema; a hang or a
    // 500 would mean it never got there.
    expect([400, 503]).toContain(res.statusCode)
    expect(res.body).toBeDefined()
  })
})
