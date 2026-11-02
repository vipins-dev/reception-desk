# Reception Desk

A single-screen frontend for a veterinary clinic's receptionist, built on the existing
[Spring PetClinic REST](https://github.com/spring-petclinic/spring-petclinic-rest) backend
(unchanged). TypeScript · React 19 · Zustand · Vite · Tailwind · React Hook Form + Zod · Vitest + MSW.

## The workflow

One persistent screen, three panes, no page-to-page navigation:

```
┌ Search ───────┬ Owner ─────────────┬ Pet ─────────────────┐
│ last name ▢   │ details · Edit     │ details · Edit       │
│ [+ New owner] │ Pets (n) · + Add   │ Register visit ▢ ▢   │
│ results…      │  ▸ pet ▸ pet       │ Visit history        │
└───────────────┴────────────────────┴──────────────────────┘
```

- **Find or create**: type a last name (debounced); Enter opens the first match; no match offers
  "Create owner “Smith”" with the name prefilled. Search rows show pet names ("it's about Max").
- **Owner → pet → visit** are one click each; the *Register visit* form is always visible on a pet
  (date defaults to today, stays set for batches, focus returns to the notes field).
- Add pet, edit owner, edit pet are inline forms in the same panes. After "Add pet" you land on the new pet.
- The URL is the selection (`/owners/6/pets/8`), so refresh and deep links work and the browser back
  button behaves.

## Run it

Needs Node ≥ 20. The backend needs Java 17+ (or Docker).

```bash
# 1. backend (separate terminal) — http://localhost:9966/petclinic
git clone https://github.com/spring-petclinic/spring-petclinic-rest.git
cd spring-petclinic-rest && ./mvnw spring-boot:run      # or: docker run -p 9966:9966 springcommunity/spring-petclinic-rest

# 2. frontend — http://localhost:5173
npm install
npm run dev            # Vite proxies /petclinic/* to localhost:9966 (override: PETCLINIC_URL)
```

Optional, everything with Docker (untested): `docker compose up --build` → http://localhost:8080.

| Command | What |
|---|---|
| `npm test` | 88 unit + integration tests (no backend needed; network faked with MSW) |
| `npm run test:contract` | 14 tests: the same API client against a **real** running backend (`PETCLINIC_URL`) |
| `npm run typecheck` / `npm run lint` / `npm run build` | CI checks |

The backend uses in-memory H2 seeded on start, so **data resets whenever it restarts**.

### Deploy (Vercel)

Vercel serves the static frontend only. **It cannot run the Java backend** (static sites and short-lived
serverless functions, no long-running Spring Boot server), so the backend must run on a host that can run a
Docker image or a JVM — for example Render, Fly.io or Google Cloud Run, using the public image
`springcommunity/spring-petclinic-rest` (port 9966). It must be reachable over HTTPS.

1. Start the backend on that host and note its public URL (check `https://<host>/petclinic/actuator/health`).
2. In `vercel.json`, replace `REPLACE-WITH-YOUR-BACKEND-HOST` with that host and commit. The first rewrite
   proxies `/petclinic/*` to the backend, so the browser only talks to the Vercel origin (no CORS, no mixed
   content), exactly like the Vite proxy in development. The second rewrite is the single-page-app fallback.
3. On vercel.com: **Add New → Project**, import this GitHub repo. The framework (Vite), build command and
   output directory come from `vercel.json`; no environment variables are needed.

Until step 2 is done the app loads but shows "Cannot reach the PetClinic backend". Demo data lives in the
backend's memory, so it resets whenever that service restarts or sleeps (free tiers often sleep when idle).
Not yet deployed or tested on Vercel.

## Architecture

```
src/
  api/       typed HTTP boundary: client (errors, timeout, abort), endpoints, zod schemas
  domain/    pure logic: validation rules mirroring the OpenAPI constraints, dates, formatting
  stores/    Zustand: search, owners (server cache), petTypes (reference data), toasts
  features/  search/ owner/ pet/  — screens and forms
  app/       router, layout, URL helpers
  test/      fake in-memory PetClinic (MSW), store reset
contract/    tests against the real backend
```

**State model** (the part to be able to defend):

| State | Lives in | Why |
|---|---|---|
| Which owner / pet is open | **URL** | deep links, refresh, back button; no duplicated "selected id" to drift |
| Search query, page, results | `searchStore` | survives owner switching; one in-flight request, **latest wins** (abort + ignore stale) |
| Owner + pets + visits | `ownersStore` (normalised by owner id) | `GET /owners/{id}` already returns the whole aggregate, so there is *one* copy of each fact and nothing to sync; pets/visits are read out of it |
| Pet types | `petTypeStore` | loaded once, concurrent callers share the request |
| Form input / "editing" toggles | component state (React Hook Form) | transient, nobody else needs it |
| Toasts | `toastStore` | cross-cutting, fire-and-forget |

Main decisions:

- **Zustand also holds server data**, with a hand-written cache (dedupe, abort, stale-while-revalidate,
  re-read after write). With four endpoints and one aggregate that is a small, tested surface
  (`stores.test.ts`). TanStack Query would be my choice if the API surface grew (it gives retries, GC,
  devtools, mutation lifecycle for free); I did not add it here because the brief asked for Zustand and the
  extra layer would not remove any code that matters.
- **Writes are pessimistic**: send, then re-read the owner. Both `PUT`s answer 204 with no body and the
  the server is the only reliable source for what was stored (ids, ordering), so the re-read is the simplest
  way to show it. A failed re-read keeps the last data and shows a warning; it never fails the write.
- **Responses are validated at the boundary** (zod); ids are **branded** (`OwnerId` ≠ `PetId`);
  async state is a **discriminated union** (no "error message while loading"); errors leave the API layer
  as one `ApiError` type (`network | http | invalid-response`).
- **Client validation mirrors the API's constraints** (name patterns, digits-only phone, pet age rules) so
  feedback is instant; the server stays the authority and its field errors are placed on the offending input.
- **Performance, measured not guessed**: route-level `lazy` + `Suspense` (small win: forms share
  react-hook-form with the eager owner view, so only ~6 kB moves; main bundle 402 kB / 127 kB gzip is mostly
  React + router + zod); `memo` only on search rows, which re-render per keystroke while their data does not
  change; per-field Zustand selectors. Deliberately **not** used: blanket `useMemo/useCallback`
  (lists are ≤ 10 rows), React Compiler, virtualisation, `useTransition`, and `use()`+Suspense for data
  (explicit loading/error states are clearer here and easier to test).

## Assumptions

- Backend security is off (the default `petclinic.security.enable=false`); no login is needed.
- One receptionist per customer: no concurrent-edit handling beyond "last write wins" (the API offers nothing better).
- Search is by **last name prefix** — that is all the API supports; empty search lists the first page of owners.
- Phone numbers are typed in any common format and stored as exactly 10 digits — the real server's rule
  (see Q10), so international numbers cannot be entered.
- A visit is a date + description (the API has no vet, time or status); the date defaults to today and may be any date.
- Desktop-first (≥ 1024 px, best ≥ 1280 px); below that the panes stack.

## API problems found

Found by reading the backend source/OpenAPI, then **checked against a running backend** (Spring PetClinic REST,
H2 profile, 2 Nov 2026): `npm run test:contract` passes (14 tests). Each Q-numbered row is pinned by a test in
`contract/`, so you can see whether it still holds. Rows marked — are not covered by a contract test.
Running it also corrected the analysis: Q9 was a wrong guess from the source and Q10 was missed by reading alone.

| # | Problem | My workaround | Change I'd propose |
|---|---|---|---|
| Q1/Q2 | `GET /owners?lastName=x` returns **404 with an empty body** when nothing matches | use `GET /v2/owners` (200 + empty page) | return `200 []`; reserve 404 for missing resources |
| Q3/Q4 | Search is **last-name only, prefix, case-sensitive** (`LIKE :lastName%`); no first name / phone / pet-name search | capitalise the first letter; "McTavish" typed in lowercase still misses | one `q` parameter: case-insensitive contains over name, phone and pet name, with an index |
| Q5 | `PUT` owner / pet return **204, no body** | re-read the owner after every write | return the updated resource (and an `ETag`) |
| Q6 | Visit `POST` **does not check that the pet belongs to `{ownerId}`** in the path | UI only ever uses the open owner's own pets | validate the relation, 404/422 otherwise |
| Q7 | Visit for a non-existent pet → `DataIntegrityViolation` mapped to a vague **404** | none needed (UI can't produce it) | explicit "pet not found" error; a handler that maps *every* integrity error to 404 hides real bugs |
| Q8 | Pet birth-date rules (not future, ≤ 50 years) exist only as a code annotation, **not in the OpenAPI schema** | duplicated the rule client-side | express as schema constraints / `maximum` so clients can generate them; compute "today" in a stated timezone (near midnight client and server can disagree) |
| Q9 | *(checked, not a problem)* the create-pet response looked like it could lack `type.name` (`setName(null)` in the controller); the real server **echoes it fully** | still parse only `id`+`name` and re-read | — |
| Q10 | **Phone must be exactly 10 digits** (entity `@Pattern ^[0-9]{10}$`) but OpenAPI says digits, 1–20; a short number passes request validation and fails with **500 `ConstraintViolationException`**, not 400 | client rule is exactly 10 digits (after stripping spaces, dashes, brackets), so the 500 can't be triggered from the UI | align the schema with the entity; map constraint violations to 400 with field messages; accept real-world formats (E.164) |
| — | Validation errors carry undocumented `field` / `defaultMessage` keys inside `schemaValidationErrors`, with English sentences in `message` | map by `field`, else by `[Path '/x']`; show `defaultMessage` | document the fields; add machine-readable codes |
| — | `/v2/owners` is paginated but each row carries **every pet and every visit** (EAGER fetch ⇒ N+1) | none (small data); rows only use names | summary DTO, `?expand=pets` |
| — | No concurrency control on writes (reads have ETags, writes ignore `If-Match`) | last write wins | version field / `If-Match` → 412 |
| — | A visit has only `date` + `description` (`date` optional): no vet, time, status | descriptive free text only | add `vetId`, `time`, `status` for scheduling |

## Known limitations

- **No unsaved-changes guard**: clicking another owner while a form is half-filled discards it.
- Search cannot find by phone, first name or pet name (API limitation above); no keyboard list navigation beyond Enter.
- Visits can't be edited or deleted in the UI (the API supports it), nor can owners/pets be deleted.
- Writes are not optimistic, so a slow server is visible; requests time out after 15 s with a retry.
- English only; dates formatted `en-GB`; accessibility covered by role/label queries in tests, **no automated axe audit**.
- Integration tests run against a *fake* of the backend; only the contract suite touches the real one. It passed
  against a live backend once, by hand; it is not wired into CI. No browser E2E (Playwright) yet.
- Backend data is in-memory, so bookmarked IDs break after a backend restart.

## What I would improve next

1. Run the contract suite in CI against the Docker image (and fail on drift), then add a few Playwright E2E flows.
2. Unsaved-changes guard and optimistic updates for visit registration.
3. Backend-side: the `q` search, summary DTO and `If-Match` proposals above — they remove most of the workarounds.
4. Visit edit/delete, vet and appointment display, axe checks in CI, i18n.
5. If the API grows: move server state to TanStack Query and keep Zustand for UI state only.

## AI usage

See [`docs/ai/`](docs/ai): the working plan, the API analysis that drove the design, and a log of what was
generated, what failed and was corrected, and what still needs human verification.
