import { defineConfig, loadEnv } from 'vite'
import type { Connect, Logger, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serve api/narrate.ts locally, for both `npm run dev` and `npm run preview`.
 *
 * In production Vercel runs that file itself; locally nothing would, so the
 * adjudicator would only ever be testable by deploying. This mounts the very
 * same handler - not a stub of it - so what you play against here is what
 * ships.
 *
 * Preview matters as much as dev. Without it `npm run preview` serves the
 * built site with no /api route, every judgement 404s, and the game silently
 * falls back to templates - which looks exactly like the adjudicator having
 * nothing to say rather than never having been asked.
 */
function narratorServer(env: Record<string, string>): Plugin {
  const mount = (server: { middlewares: Connect.Server; ssrLoadModule?: unknown; config: { logger: Logger } }) => {
      server.middlewares.use('/api/narrate', async (req, res) => {
        // Vercel gives the handler a Web Request; Connect gives us a Node one.
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)

        try {
          // The key comes from .env.local, which is git-ignored and never
          // reaches the bundle: this runs in the dev server's node process.
          //
          // Assign only what exists. process.env stringifies whatever it is
          // given, so setting a missing value writes the literal "undefined"
          // and the request goes out asking for a model of that name.
          for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'] as const) {
            if (!process.env[key] && env[key]) process.env[key] = env[key]
          }

          // The preview server cannot compile TypeScript, so it takes the
          // handler through tsx instead of Vite's module runner.
          const loaded = typeof (server as { ssrLoadModule?: unknown }).ssrLoadModule === 'function'
            ? await (server as unknown as { ssrLoadModule: (id: string) => Promise<unknown> }).ssrLoadModule('/api/narrate.ts')
            : await import('./api/narrate.js')
          const { default: handler } = loaded as { default: (request: Request) => Promise<Response> }
          // Forward the real headers rather than a minimal pair. The handler
          // reads Origin and Host to decide whether it will answer at all, so a
          // stripped-down Request is not the same request: it would be refused
          // here and accepted in production, which is the one way this mount can
          // lie about what ships.
          const headers = new Headers({ 'content-type': 'application/json' })
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue
            headers.set(key, Array.isArray(value) ? value.join(', ') : value)
          }
          const host = req.headers.host ?? 'localhost'
          const result = await handler(new Request(`http://${host}${req.url}`, {
            method: req.method ?? 'POST',
            headers,
            body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
          }))

          res.statusCode = result.status
          res.setHeader('content-type', 'application/json')
          res.end(await result.text())
        } catch (error) {
          server.config.logger.error(`[narrator] ${error instanceof Error ? error.message : error}`)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Narrator failed to load' }))
        }
      })
  }
  return {
    name: 'hells-cabinet-narrator',
    apply: 'serve',
    configureServer: mount,
    configurePreviewServer: mount,
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), narratorServer(loadEnv(mode, process.cwd(), ''))],
  // Content lives outside src/ and is imported as JSON by the app.
  resolve: { preserveSymlinks: true },
}))
