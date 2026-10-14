import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolves the '@/*' path alias from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      // Next.js resolves `server-only` itself; outside Next, point it at the
      // empty module Next ships so server files can be imported in tests.
      'server-only': fileURLToPath(
        new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url),
      ),
      // next/font loaders only work inside the Next.js compiler.
      'next/font/google': fileURLToPath(new URL('./tests/support/nextFontGoogle.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/support/setup.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
