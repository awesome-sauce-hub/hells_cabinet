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
    const url = new URL(request.url)
    const { pathname } = url

    // One canonical host. Both names are attached to this worker, and a game
    // whose whole distribution is people sending each other links should not
    // have two spellings of every link in circulation.
    if (url.hostname === 'www.hellscabinet.com') {
      url.hostname = 'hellscabinet.com'
      return Response.redirect(url.toString(), 308)
    }

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
