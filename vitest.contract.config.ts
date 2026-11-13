import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Contract tests talk to a REAL Spring PetClinic REST instance:
//   PETCLINIC_URL=http://localhost:9966 npm run test:contract
// They create their own data (unique names), never depend on seed rows staying
// untouched, and delete what they created, so a run leaves the backend as it found it.
const backend = process.env.PETCLINIC_URL ?? 'http://localhost:9966'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    globals: true,
    include: ['contract/**/*.test.ts'],
    testTimeout: 15_000,
    env: { VITE_API_BASE_URL: `${backend}/petclinic/api` },
  },
})
