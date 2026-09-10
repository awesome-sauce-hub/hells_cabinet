import { narrate } from '../api/narrate.js'
import type { BurstLimiter } from '../api/narrate.js'

/**
 * The Cloudflare entry point.
 *
 * There is almost nothing here on purpose. The narrator was already written
 * against the Fetch API - narrate() takes a Request and returns a Response -
 * so this routes to it rather than reimplementing it, and the same handler
 * body serves both hosts. The Node adapter in api/narrate.ts is the other
 * side of that arrangement and is not used on this path.
 */
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Optional so a deploy without the binding still serves the game. */
  NARRATE_BURST?: BurstLimiter
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/narrate') return narrate(request, env.NARRATE_BURST)

    // Anything else under /api is a route that does not exist. Without this it
    // would fall through to the SPA fallback and answer a fetch() with the
    // index page, which reads as a JSON parse error rather than a 404.
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'No such route' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    }

    return env.ASSETS.fetch(request)
  },
}
