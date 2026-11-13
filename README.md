# Reception Desk

A web app for a vet clinic's receptionist, built on the unmodified
[Spring PetClinic REST](https://github.com/spring-petclinic/spring-petclinic-rest) backend.

**Live demo:** https://reception-desk-w9jv.onrender.com
The demo runs on free hosting. If you see "The server took too long to respond", the backend was asleep: wait a
few seconds and press **Retry**. Its data resets whenever it sleeps.

## Features

One screen with three panes (search, owner, pet), so the receptionist never leaves it during a conversation.

- Find an owner by last name, or create a new one (the typed name is prefilled)
- See the owner's details and pets
- Open a pet to see its details and visit history
- Register a visit, add a pet, edit an owner or a pet, all inline on the same screen
- The URL always shows what is open (`/owners/6/pets/8`), so refresh, links and the back button work

## Tech stack

TypeScript (strict), React 19, Vite, Zustand, React Router, React Hook Form, Zod, Tailwind CSS, Vitest,
Testing Library, MSW.

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
| `npm test` | 89 unit and integration tests. No backend needed; the network is faked with MSW. |
| `npm run test:contract` | 14 tests that call a **real** running backend (`PETCLINIC_URL`, default `http://localhost:9966`). |
| `npm run typecheck` / `npm run lint` / `npm run build` | The other checks that CI runs. |

## Project structure

```
src/api/        HTTP client, zod schemas, error mapping (the only code that knows URLs)
src/domain/     pure logic: validation rules, dates, formatting
src/stores/     Zustand stores: search, owners, pet types, toasts
src/features/   screens and forms: search/, owner/, pet/
src/app/        router and layout
src/test/       in-memory fake of the backend for tests
contract/       tests against the real backend
docs/ai/        AI-development artifacts
```

## Architecture and decisions

Dependencies point one way: `features` → `stores` → `api`. `domain` is pure.

**Where state lives**

- **Which owner or pet is open:** in the URL, not in a store. Nothing can get out of sync with it.
- **Search text and results:** `searchStore`. Only the latest request counts; older ones are cancelled.
- **Owner, pets and visits:** `ownerStore`, keyed by owner id. `GET /owners/{id}` already returns all of it, so
  there is one copy of each fact and nothing to keep in sync.
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
- **Search uses `GET /v2/owners`**, because the older list endpoint returns 404 when nothing matches.
- **Light performance work:** lazy-loaded panes with Suspense, and `memo` only on search results, which re-render on
  every keystroke. No blanket `useMemo`/`useCallback`: the lists are short.
- **What is tested:** integration tests drive the real UI, stores and HTTP client against a fake backend; the
  contract tests check my assumptions about the real backend; no browser end-to-end tests.

**Deployment (optional).** The live demo is two free Render services: a static site (`npm ci && npm run build`,
publish `dist`) and the backend's public Docker image. The static site forwards `/petclinic/*` to the backend and
sends every other path to `index.html`. These settings live in the Render dashboard, not in this repo.

## Assumptions

- Backend security is off (the default), so there is no login.
- One receptionist works with a customer at a time; if two people edit, the last save wins.
- Search is by last-name prefix, which is all the API supports. An empty search lists the first page of owners.
- Phone numbers can be typed in any common format but are stored as exactly 10 digits, which the server requires.
  International numbers cannot be entered.
- A visit is a date and a description. The date defaults to today.
- Desktop first (1024 px and wider); below that the panes stack.

## API problems found

Problems I found in the API, my workaround for each, and the change I would propose in a real project.

| Problem | My workaround | Change I would propose |
|---|---|---|
| `GET /owners?lastName=x` returns **404 with an empty body** when nothing matches | Use `GET /v2/owners`, which returns 200 with an empty page | Return `200 []`; keep 404 for missing resources |
| Search is **last name only, prefix, case-sensitive**: no first name, phone or pet name | Capitalise the first letter of what is typed | One `q` parameter: case-insensitive match on name, phone and pet name |
| `PUT` owner and pet return **204 with no body** | Re-read the owner after every write | Return the updated resource and an `ETag` |
| A visit can be posted for **a pet that belongs to a different owner**; a missing pet gives a vague 404 | The UI only offers the open owner's pets | Validate the owner/pet relation; return a clear "pet not found" |
| Pet birth-date rules (not in the future, at most 50 years ago) are **not in the OpenAPI file** | Repeat the rules in the frontend | Put them in the schema |
| **Phone must be exactly 10 digits** but OpenAPI says 1 to 20; a short number gives a **500 error** | The frontend requires exactly 10 digits, so the 500 cannot be triggered | Make schema and entity agree; return 400 with field messages |
| Validation errors use **undocumented keys** (`field`, `defaultMessage`) | Read those keys, falling back to the `[Path '/x']` text | Document the error shape and add error codes |
| `/v2/owners` is paged but every row carries **all pets and visits** (N+1 queries) | None needed for this data size | A summary response, or `?expand=pets` |
| **No concurrency control**: reads have ETags, writes ignore `If-Match` | Last write wins | Version field or `If-Match` returning 412 |
| A visit has only a date and a description | Free text only | Add vet, time and status |

## Known limitations

- No warning when you leave a half-filled form: opening another owner discards it.
- Search cannot find by phone, first name or pet name (API limitation above).
- Visits cannot be edited or deleted in the UI, and neither can owners or pets.
- Writes are not optimistic, so a slow server is visible. Requests time out after 15 seconds with a Retry button.
- English only, dates shown as `en-GB`; no automated accessibility audit.
- Integration tests use a fake backend. The contract tests (last passed 2 Nov 2026) run by hand, not in CI. No browser
  end-to-end tests.
- Backend data is in memory, so ids break after a restart. On the live demo the free backend also sleeps, and waking
  it takes longer than the 15-second timeout, so the first visit after idle needs a Retry.

## What I would improve next

1. Run the contract tests in CI against the backend's Docker image, and add a few Playwright end-to-end tests.
2. Warn about unsaved changes; make registering a visit optimistic.
3. Backend side: the `q` search, summary response and `If-Match` proposals above remove most workarounds.
4. Edit and delete visits, show vets and appointments, add accessibility checks, add translations.
5. If the API grows, move server state to TanStack Query and keep Zustand for UI state.

## AI usage

See [`docs/ai/`](docs/ai): the plan and decisions, the API analysis, and a log of what the AI got wrong, how each
mistake was caught, and what was and was not verified.
