# Reception Desk

A web app for a vet clinic's receptionist, built on the unmodified
[Spring PetClinic REST](https://github.com/spring-petclinic/spring-petclinic-rest) backend.

**Live demo:** https://reception-desk-w9jv.onrender.com
The demo runs on free hosting. After a break the backend needs up to a minute to wake: the first load waits for it
and says so ("Waking up the server…"). Its data resets whenever it sleeps.

## Features

The **Front Desk** is one screen with three panes (lookup, owner, pet), so the receptionist never leaves it
during a conversation. Two more views and a drawer cover the rest.

- Find an owner by name, phone, city or pet name, with a Dogs / Cats / Other filter (press `/` to jump to the search)
- No match? One click creates the owner, prefilled from what was typed
- See the owner's details and pets; open a pet to see its details and visit history
- Register a visit with one click (quick-fill notes such as "Vaccination booster")
- Add a pet, edit an owner or a pet, all inline, with no pop-ups
- **New Owner drawer:** register a walk-in and, optionally, their first pet in one pass
- **Today's Visits:** the day's visits (or all history), each row jumps to that owner and pet
- **All Owners:** the whole directory as a table, each row jumps to that owner
- The URL always shows what is open (`/owners/6/pets/8`), so refresh, links and the back button work

## Tech stack

TypeScript (strict), React 19, Vite, Zustand, React Router, React Hook Form, Zod, Tailwind CSS, Vitest,
Testing Library, MSW. Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono) are bundled, so nothing loads from a CDN.

## Getting started

**Prerequisites:** Node.js 22.22 or newer, and Java 17+ (or Docker) for the backend.

1. Start the backend (separate terminal). It runs at http://localhost:9966/petclinic.

   ```bash
   git clone https://github.com/spring-petclinic/spring-petclinic-rest.git
   cd spring-petclinic-rest
   ./mvnw spring-boot:run
   ```

   With Docker instead: `docker run -p 9966:9966 springcommunity/spring-petclinic-rest`

2. Start the frontend (in this repo). It runs at http://localhost:5173 and forwards `/petclinic/*` to the backend.

   ```bash
   npm install
   npm run dev
   ```

The backend keeps its data in memory, so everything resets when you restart it.

## Tests

| Command | What it does |
|---|---|
| `npm test` | 147 unit and integration tests. No backend needed; the network is faked with MSW. |
| `npm run test:contract` | 15 tests that call a **real** running backend (`PETCLINIC_URL`, default `http://localhost:9966`). They delete the data they create. |
| `npm run typecheck` / `npm run lint` / `npm run build` | The other checks that CI runs. |

## Project structure

```
src/api/        HTTP client, zod schemas, error mapping (the only code that knows URLs)
src/domain/     pure logic: validation rules, dates, formatting
src/stores/     Zustand stores: owners (the cache), directory (load status), search (query + filter), pet types, toasts
src/features/   screens and forms: lookup/, owner/, pet/, directory/ (All Owners, Today's Visits)
src/app/        router and layout
src/test/       in-memory fake of the backend for tests
contract/       tests against the real backend
docs/ai/        AI-development artifacts
```

## Architecture and decisions

Dependencies point one way: `features` → `stores` → `api`. `domain` is pure.

**Where state lives**

- **Which owner or pet is open:** in the URL, not in a store. Nothing can get out of sync with it.
- **Owner, pets and visits:** `ownerStore`, keyed by owner id. `GET /owners/{id}` already returns all of it, so
  there is one copy of each fact and nothing to keep in sync.
- **The owner list, search results, All Owners and Today's Visits:** *derived* from `ownerStore`, never stored
  twice. `directoryStore` only remembers whether the list has loaded; `searchStore` holds the typed text and the
  species filter. A write updates the owner once and every list shows it.
- **Pet types:** `petTypeStore`, loaded once.
- **Form input and "editing" toggles:** component state (React Hook Form).

**Main decisions**

- **Zustand also holds server data**, with a small hand-written cache. With four endpoints this is simple and
  tested. If the API grew I would switch server state to TanStack Query.
- **Writes are pessimistic: save, then re-read the owner.** Both `PUT`s return 204 with no body, so the server is the
  only reliable source of what was stored.
- **A strict API boundary.** Responses are validated with zod, ids have distinct types (`OwnerId` is not `PetId`),
  and every failure becomes one `ApiError`.
- **Validation runs in the browser and on the server.** The browser mirrors the server's rules for instant feedback;
  the server stays the authority and its field errors appear on the matching input.
- **Search runs in the browser.** The API can only search by last name, but the desk needs name, phone, city and pet
  name. So the app loads every owner once (`GET /v2/owners`, pages of 100, which also avoids the 404 the older list
  endpoint returns when nothing matches) and filters locally. That is fine for hundreds of owners; thousands would
  need the server-side search I propose below. The list reloads when the tab becomes visible again.
- **Today's Visits is derived.** The API cannot list visits by date, but every owner already carries their pets and
  visits, so the day's visits are read out of the cache.
- **The New Owner drawer is a `?new=owner` flag** on whatever page is open, so it slides over the current screen
  without changing what is selected behind it.
- **Light performance work:** lazy-loaded panes with Suspense, `memo` on the lookup rows, and one `useMemo` for the
  filtered list, which re-sorts and re-scans every owner on each keystroke. No blanket `useMemo`/`useCallback`
  elsewhere.
- **UI rules from the provided design:** one flat level of elevation (no cards inside cards), metadata as plain text
  with `·` separators instead of pills, one teal accent, monospaced tabular numbers for dates, phones and counts.
- **What is tested:** integration tests drive the real UI, stores and HTTP client against a fake backend; the
  contract tests check my assumptions about the real backend; no browser end-to-end tests.

**Deployment (optional).** The live demo is two free Render services: a static site (`npm ci && npm run build`,
publish `dist`) and the backend's public Docker image. The static site forwards `/petclinic/*` to the backend and
sends every other path to `index.html`. These settings live in the Render dashboard, not in this repo.

## Assumptions

- Backend security is off (the default), so there is no login.
- One receptionist works with a customer at a time; if two people edit, the last save wins.
- The clinic has hundreds of owners, not millions: the whole list is loaded into the browser (capped at 2,000).
- Phone numbers can be typed in any common format but are stored as exactly 10 digits, which the server requires.
  International numbers cannot be entered.
- A visit is a date and a description. The date defaults to today.
- Desktop first (1024 px and wider); below that the panes stack.

## API problems found

Problems I found in the API, my workaround for each, and the change I would propose in a real project.

| Problem | My workaround | Change I would propose |
|---|---|---|
| `GET /owners?lastName=x` returns **404 with an empty body** when nothing matches | Use `GET /v2/owners`, which returns 200 with an empty page | Return `200 []`; keep 404 for missing resources |
| Search is **last name only, prefix, case-sensitive**: no first name, phone, city or pet name | Load every owner once and search in the browser, ignoring case and accents | One `q` parameter: case-insensitive match on name, phone, city and pet name, with paging |
| `PUT` owner and pet return **204 with no body** | Re-read the owner after every write | Return the updated resource and an `ETag` |
| A visit can be posted for **a pet that belongs to a different owner**; a missing pet gives a vague 404 | The UI only offers the open owner's pets | Validate the owner/pet relation; return a clear "pet not found" |
| Pet birth-date rules (not in the future, at most 50 years ago) are **not in the OpenAPI file** | Repeat the rules in the frontend | Put them in the schema |
| **Phone must be exactly 10 digits** but OpenAPI says 1 to 20; a short number gives a **500 error** | The frontend requires exactly 10 digits, so the 500 cannot be triggered | Make schema and entity agree; return 400 with field messages |
| Validation errors use **undocumented keys** (`field`, `defaultMessage`) | Read those keys, falling back to the `[Path '/x']` text | Document the error shape and add error codes |
| `/v2/owners` is paged but every row carries **all pets and visits** (N+1 queries) | The app relies on it (loading all owners is how the lists work), which is the part that will not scale | A summary response, or `?expand=pets` |
| **No way to list visits by date**: only per pet, or all visits unfiltered | Today's Visits is derived from the owners already loaded | `GET /visits?date=…` with the pet and owner included |
| **No concurrency control**: reads have ETags, writes ignore `If-Match` | Last write wins | Version field or `If-Match` returning 412 |
| **Deleting an owner also deletes the pet type of each of their pets, and the database then deletes every pet of that type** (`cascade = ALL` on `Pet.type`, `ON DELETE CASCADE` on `pets.type_id`): one delete can erase every cat in the clinic | The app never deletes anything. The contract tests only delete data they created, using a pet type of their own | Remove the cascade from `Pet.type`: a pet's type is shared reference data and must never be deleted with the pet |
| A visit has only a date and a description | Free text only | Add vet, time and status |

The cascade delete was found while cleaning up test data, and it wiped the cats and dogs from my local backend (a restart brings them back). It is in the backend built from source; one delete on the published Docker image behind the live demo did not remove the type, so that image may be older.

## Known limitations

- No warning when you leave a half-filled form: opening another owner discards it.
- The whole owner list is loaded into the browser, so it will not scale to thousands of owners (capped at 2,000,
  and the screen says so). Another receptionist's new owner appears when this tab is focused again, not instantly.
- Today's Visits only knows the owners that were loaded; "all history" can be long and is not paged.
- Visits cannot be edited or deleted in the UI, and neither can owners or pets.
- Writes are not optimistic, so a slow server is visible. Requests time out after 15 seconds (90 seconds for the first loads, so a sleeping backend can wake) with a Retry button.
- English only, dates shown as `en-GB`; no automated accessibility audit.
- Integration tests use a fake backend. The contract tests (last passed 13 Nov 2026) run by hand, not in CI. No browser
  end-to-end tests.
- Backend data is in memory, so ids break after a restart. On the live demo the free backend also sleeps; the first load
  after idle waits for it to wake (up to a minute) and shows a "waking up" message.

## What I would improve next

1. Run the contract tests in CI against the backend's Docker image, and add a few Playwright end-to-end tests
   (the drawer animation, keyboard shortcuts and responsive layout are only checked by hand today).
2. Warn about unsaved changes; make registering a visit optimistic.
3. Backend side: the `q` search, summary response and `If-Match` proposals above remove most workarounds.
4. Edit and delete visits, show vets and appointments, add accessibility checks, add translations.
5. If the API grows, move server state to TanStack Query and keep Zustand for UI state.

## AI usage

See [`docs/ai/`](docs/ai): the plan and decisions, the API analysis, and a log of what the AI got wrong, how each
mistake was caught, and what was and was not verified.
