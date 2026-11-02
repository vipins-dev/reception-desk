# Reception Desk — instructions for AI coding agents

Frontend for the Spring PetClinic REST backend (never modify the backend; it is not in this repo).

- Stack: React 19, TypeScript (strict), Zustand, React Router, React Hook Form + Zod, Tailwind, Vitest + MSW.
- Layering: `api/` (only place that knows URLs/fetch) → `stores/` (Zustand) → `features/` (UI). `domain/` is pure.
- Selection (owner / pet) lives in the URL, never duplicated in a store.
- Pets and visits are read out of the owner aggregate; do not cache them separately.
- After any write, re-read the owner (`PUT`s return 204 with no body).
- Ids are branded types; responses are zod-parsed at the boundary; errors leave `api/` as `ApiError`.
- Tests: `npm test` (fake backend in `src/test/fakeBackend.ts`), `npm run test:contract` (real backend).
  Behaviour assumed about the real server must have a `contract/` test. Query pet links inside the Pets card in tests.
- Before finishing: `npm run typecheck && npm run lint && npm test && npm run build`.
- Don't add memoisation without a reason in a comment; don't commit secrets or send personal data to AI tools.
