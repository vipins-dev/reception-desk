# How AI was used, what went wrong, what still needs a human

**Division of work.** The agent produced the analysis, architecture proposal, code, tests, deploy config and
README. The human owner is responsible for understanding and being able to explain all of it, and for the
verification steps at the bottom.

## Things the agent got wrong and the checks that caught them

| What | Caught by | Fix |
|---|---|---|
| Used `@hookform/resolvers/zod`; v7 of the package no longer ships that entry | reading `node_modules` after install | switched to `standardSchemaResolver` |
| Used MSW option `onUnhandledRequest`; v3 renamed it `onUnhandledFrame` | typecheck | renamed |
| `isAbortError` used `instanceof DOMException` (breaks across realms, e.g. jsdom vs Node) | failing test | duck-typed on `name` |
| "Register visit" lost focus: RHF `reset()` unregisters fields, so the following `setFocus` found nothing | failing test | `resetField('description')` |
| **Editing a pet showed an empty Type**: the uncontrolled `<select>` took its default before its `<option>`s loaded | failing test | pet form renders only once pet types are loaded |
| Test asserted capitalised text while the UI echoes what the user typed | failing test | corrected the test (code was right) |
| Adding pet names to search rows made `link /Max/` ambiguous; one test passed only by a race | repeated runs / re-reading | pet links are queried inside the Pets card; suite run 3× stable |
| Guessed from source that the create-pet echo would lack `type.name` (Q9) and made the parse lenient because of it | contract test against the running backend | guess was wrong; the lenient parse stays as a harmless defence, docs corrected |
| **Client allowed 1–20 phone digits (from OpenAPI); the real entity needs exactly 10 and answers 500 otherwise (Q10)** | a manual `curl` against the running backend returned an unexpected 500 | rule changed to exactly 10 digits; fake backend now reproduces the 500; tests added |
| Contract test searched a short name prefix, which matches leftovers from earlier runs (passed once on an empty DB) | second run failed | search by the full unique name; run 3× on a dirty DB |
| Contract config lacked `globals: true`, so the suite could not even start | first real run | fixed |
| Proxy 502 (backend down) was shown as a generic "server had a problem" | user's screenshot | 502/503/504 now say the backend is unreachable |

## Verified vs not verified

- Verified here: `npm run typecheck`, `npm run lint`, `npm test` (88 tests), `npm run build`; the UI was
  exercised in a real browser against a throwaway local mock of the API (three-pane layout, register visit).
- Verified against the real Spring PetClinic (started by the user, H2 profile): `npm run test:contract`
  (14 tests, repeated runs), the Vite proxy returning 200 from the real API.
- Click-through in the browser against the real backend: lowercase search, open owner, open pet, register
  a visit (history, "last visit", toast and focus all behaved).
- **Not verified:** create owner / add pet / edit flows in the browser against the real backend (covered by the
  contract tests at the API level and by integration tests against the fake); `docker compose up`;
  the Vercel deployment (and the backend host it proxies to).

## Checklist for the human before submitting

1. Start the real backend; `npm run dev`; click through every flow once.
2. Re-run `npm run test:contract` before submitting (it passed on 2 Nov 2026) and re-read the README "API problems" table.
3. Read `stores/` and `api/client.ts` until you can explain latest-wins search, the owner cache and error mapping.
4. Deploy the backend on a Docker host, put its URL in `vercel.json`, deploy on Vercel (README) and open the URL.
5. Prepare for "make a small change": e.g. search by first name client-side, or a visit-description max length.
