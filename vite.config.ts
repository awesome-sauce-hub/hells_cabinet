import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serve api/narrate.ts during `npm run dev`.
 *
 * In production Vercel runs that file itself; locally nothing would, so the
 * narrator would only ever be testable by deploying. This mounts the very same
 * handler on the dev server - not a stub of it - so what you play against here
 * is what ships.
 */
function narratorDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'hells-cabinet-narrator',
    apply: 'serve',
    configureServer(server) {
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

          const { default: handler } = await server.ssrLoadModule('/api/narrate.ts') as {
            default: (request: Request) => Promise<Response>
          }
          const result = await handler(new Request(`http://localhost${req.url}`, {
            method: req.method ?? 'POST',
            headers: { 'content-type': 'application/json' },
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
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), narratorDevServer(loadEnv(mode, process.cwd(), ''))],
  // Content lives outside src/ and is imported as JSON by the app.
  resolve: { preserveSymlinks: true },
}))
