import '@testing-library/jest-dom/vitest'
import { resetBackend } from './fakeBackend'
import { resetStores } from './resetStores'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  server.resetHandlers()
  resetBackend()
  resetStores()
})

afterAll(() => server.close())
