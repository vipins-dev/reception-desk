# Reception Desk — instructions for AI coding agents

Frontend for the Spring PetClinic REST backend (never modify the backend; it is not in this repo).

- Stack: React 19, TypeScript (strict), Zustand, React Router, React Hook Form + Zod, Tailwind, Vitest + MSW.
- Layering: `api/` (only place that knows URLs/fetch) → `stores/` (Zustand) → `features/` (UI). `domain/` is pure.
- Selection (owner / pet) lives in the URL, never duplicated in a store. So does the New Owner drawer (`?new=owner`).
- Pets and visits are read out of the owner aggregate; do not cache them separately. The owner list, search results,
  All Owners and Today's Visits are *derived* from that cache (`directoryStore` only tracks loading); never keep a copy.
- Search is client-side over the loaded directory (`domain/search.ts`): the API can only search by last name.
- After any write, re-read the owner (`PUT`s return 204 with no body).
- Ids are branded types; responses are zod-parsed at the boundary; errors leave `api/` as `ApiError`.
- Tests: `npm test` (fake backend in `src/test/fakeBackend.ts`), `npm run test:contract` (real backend).
  Behaviour assumed about the real server must have a `contract/` test. In tests scope queries with
  `findByRole('region', { name: 'Owner' | 'Pet' })`, and re-query the lookup list (it unmounts while nobody matches).
- Before finishing: `npm run typecheck && npm run lint && npm test && npm run build`.
- UI: one flat level of elevation (no bordered cards inside cards), no pill badges, no `border-l-4` stripes, one teal
  accent, `num` class (mono + tabular) for dates, phones, ids and counts, 40 px minimum control height.
- Don't add memoisation without a reason in a comment; don't commit secrets or send personal data to AI tools.
