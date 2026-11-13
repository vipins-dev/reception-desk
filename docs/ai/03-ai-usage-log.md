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
| UI redesign: a helper named `useTemplate` (a click handler) tripped the rules-of-hooks lint | `npm run lint` | renamed `applyTemplate` |
| UI redesign: a test kept a reference to the lookup `<ul>`, which unmounts while nobody matches, so it asserted on a detached copy | one failing test ("found 4 links, expected 1") | tests re-query the list every time |
| UI redesign: typing a phone number showed "No owner matches “5”" for the first keystrokes | thinking through the failing test above, then a regression test | one or two digits no longer narrow the search |
| UI redesign: on a phone the header pushed "New Owner" off screen; on a tablet the 70-owner list pushed the owner pane far below the fold | looking at the app at 390 px and 820 px wide | compact header (icon-only button), list height capped when stacked |
| UI redesign: a screenshot showed the drawer half off screen | taking it from a background tab, where browsers freeze CSS animations | not a bug; checked again with the tab in front |

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
- UI redesign (13 Nov 2026): typecheck, lint, 144 unit/integration tests (three runs in a row), build, and the 14
  contract tests against the real local backend all pass. Looked at in a real browser at 1440, 820 and 390 px wide
  against the real backend (Front Desk, New Owner drawer, All Owners, Today's Visits). **Not yet re-checked on the
  live Render demo.** Drawer animation, `/` shortcut and responsive layout have no automated test.
- **Not verified:** `docker compose up`, the `Dockerfile` and the nginx config (there was no Docker on the
  development machine); they are not used by the Render deployment.
- Live demo, second pass (13 Nov 2026): create owner (formatted phone stored as 10 digits), add pet (landed on
  the new pet), edit owner, edit pet (type preselected) all worked in a real browser, and the stored values were
  confirmed with `curl`. The test owner was deleted afterwards.

## Checklist for the human before submitting

1. Start the real backend; `npm run dev`; click through every flow once.
2. Re-run `npm run test:contract` before submitting (it passed on 13 Nov 2026) and re-read the README "API problems" table.
3. Read `stores/` and `api/client.ts` until you can explain the owner cache, how the lists are derived from it,
   and error mapping. Read `domain/search.ts` for the client-side search.
4. Prepare for "make a small change": e.g. a new quick-fill note in `VisitForm.tsx`, a new filter chip in
   `domain/search.ts`, or a visit-description max length.
