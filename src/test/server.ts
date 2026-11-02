import { setupServer } from 'msw/node'
import { handlers } from './fakeBackend'

/** Shared MSW server. Tests add per-test overrides with `server.use(...)`. */
export const server = setupServer(...handlers)
