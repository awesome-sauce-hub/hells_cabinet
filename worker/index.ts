import { narrate } from '../api/narrate.js'
import type { BurstLimiter } from '../api/narrate.js'

/**
 * The Cloudflare entry point.
 *
 * There is almost nothing here on purpose. The narrator was already written
 * against the Fetch API - narrate() takes a Request and returns a Response -
 * so this routes to it rather than reimplementing it. Vercel's Node adapter
 * used to sit alongside it for the other host; with Vercel retired there is
 * one convention left and this is it.
 */
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Optional so a deploy without the binding still serves the game. */
  NARRATE_BURST?: BurstLimiter
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    // A www -> apex redirect was tried here and silently did nothing. Assets are
    // served before the Worker runs unless run_worker_first is set, so for '/'
    // - the only path anybody types www on - this code was never reached. The
    // redirect belongs to the zone, not the Worker; see wrangler.jsonc.
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
