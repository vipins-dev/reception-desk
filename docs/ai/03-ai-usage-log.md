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
| Search rows list pet names (added late), but only owner edits refreshed them: after "Add pet" / renaming a pet the left list was stale | the browser click-through against the real backend (screenshot showed no pet on the row) | pet writes now refresh the search; two tests fail without the fix and pass with it |
| Proxy 502 (backend down) was shown as a generic "server had a problem" | user's screenshot | 502/503/504 now say the backend is unreachable |

## Verified vs not verified

- Verified here: `npm run typecheck`, `npm run lint`, `npm test` (89 tests), `npm run build`; the UI was
  exercised in a real browser against a throwaway local mock of the API (three-pane layout, register visit).
- Verified against the real Spring PetClinic (started by the user, H2 profile): `npm run test:contract`
  (14 tests, repeated runs), the Vite proxy returning 200 from the real API.
- Click-through in the browser against the real backend, every flow: lowercase search, "no match → create
  owner" (with the short-phone rejection first), add pet, edit owner, edit pet, register visit, and a deep link
  straight to a pet URL. Results were cross-checked with `curl` against the real API.
- Live demo on Render (free tier), driven through the owner's signed-in browser: search, owner, pet, register
  visit and a deep link worked; `GET`/`POST`/`PUT` through the rewrite were checked with `curl`. The first load
  after idle showed the 15 s timeout error (the free backend was asleep); Retry worked.
- **Not verified:** `docker compose up`, the `Dockerfile` and the nginx config (there was no Docker on the
  development machine); they are not used by the Render deployment.
- Live demo, second pass (13 Nov 2026): create owner (formatted phone stored as 10 digits), add pet (landed on
  the new pet), edit owner, edit pet (type preselected) all worked in a real browser, and the stored values were
  confirmed with `curl`. The test owner was deleted afterwards.

## Checklist for the human before submitting

1. Start the real backend; `npm run dev`; click through every flow once.
2. Re-run `npm run test:contract` before submitting (it passed on 2 Nov 2026) and re-read the README "API problems" table.
3. Read `stores/` and `api/client.ts` until you can explain latest-wins search, the owner cache and error mapping.
4. Prepare for "make a small change": e.g. search by first name client-side, or a visit-description max length.
