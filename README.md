# Reception Desk

A frontend for a veterinary clinic's receptionist, built on the unmodified
[Spring PetClinic REST](https://github.com/spring-petclinic/spring-petclinic-rest) backend.
TypeScript (strict) · React 19 · Zustand · React Router · React Hook Form + Zod · Tailwind · Vite · Vitest + MSW.

**Live demo:** https://reception-desk-w9jv.onrender.com (free hosting; if the page says "The server took too long
to respond", the backend was asleep: wait a few seconds and press **Retry**. Its data resets whenever it sleeps.)

## The workflow

One screen with three panes, so the receptionist never leaves it during a conversation:

```
┌ Search ───────┬ Owner ─────────────┬ Pet ─────────────────┐
│ last name ▢   │ details · Edit     │ details · Edit       │
│ [+ New owner] │ Pets (n) · + Add   │ Register visit ▢ ▢   │
│ results…      │  ▸ pet ▸ pet       │ Visit history        │
└───────────────┴────────────────────┴──────────────────────┘
```

- **Find or create:** type a last name (debounced); Enter opens the first match; no match offers
  "Create owner “Smith”" with the name prefilled. Search rows show pet names.
- **Owner → pet → visit:** one click each. The *Register visit* form is always visible on a pet; the date defaults
  to today and the focus returns to the notes field for the next visit.
- **Add pet, edit owner, edit pet** are inline forms in the same panes.
- **The URL is the selection** (`/owners/6/pets/8`), so refresh, deep links and the back button work.
- **States implemented:** loading, empty, no results, error with retry, field validation (client and server), success toasts.

## Run it

Needs Node 22.22+ (`node -v`) and Java 17+ (or Docker) for the backend.

```bash
# 1. backend (separate terminal) — http://localhost:9966/petclinic
git clone https://github.com/spring-petclinic/spring-petclinic-rest.git
cd spring-petclinic-rest && ./mvnw spring-boot:run     # or: docker run -p 9966:9966 springcommunity/spring-petclinic-rest

# 2. frontend — http://localhost:5173
npm install
npm run dev            # Vite proxies /petclinic/* to localhost:9966 (override with PETCLINIC_URL)
```

| Command | What |
|---|---|
| `npm test` | 89 unit and integration tests; no backend needed (the network is faked with MSW) |
| `npm run test:contract` | 14 tests that run the same API client against a **real** backend (`PETCLINIC_URL`) |
| `npm run typecheck`, `npm run lint`, `npm run build` | the checks CI runs |

The backend keeps its data in memory (H2, reseeded on start), so everything resets when it restarts.

**Hosted demo:** two Render free-tier services: a static site (build `npm ci && npm run build`, publish `dist`,
`NODE_VERSION=24.11.1`) and the backend's public Docker image (`SERVER_PORT=10000`,
`JAVA_TOOL_OPTIONS=-Xmx300m -XX:+UseSerialGC -XX:TieredStopAtLevel=1` to fit 512 MB). The static site has two
rewrite rules: `/petclinic/*` → the backend URL (so the browser stays same-origin, as with the Vite proxy) and
`/*` → `/index.html` (deep links). These settings live in the Render dashboard, not in the repo.

## Architecture

```
src/api/       the only code that knows URLs and fetch: typed client, zod schemas, error mapping
src/domain/    pure logic: validation rules, dates, formatting
src/stores/    Zustand: search, owners (server cache), pet types, toasts
src/features/  search/, owner/, pet/: screens and forms
src/app/       router and layout
contract/      tests against a real backend
```

Dependencies point one way: `features` → `stores` → `api`; `domain` is pure.

| State | Lives in | Why |
|---|---|---|
| Which owner / pet is open | **the URL** | deep links, refresh, back button; no second "selected id" to drift |
| Search query, page, results | `searchStore` | survives switching owners; one request in flight, **latest wins** (abort + ignore stale) |
| Owner with pets and visits | `ownerStore`, keyed by owner id | `GET /owners/{id}` returns the whole aggregate, so there is one copy of each fact and nothing to sync |
| Pet types | `petTypeStore` | reference data, loaded once; concurrent callers share the request |
| Form input, "editing" toggles | component state (React Hook Form) | transient; nobody else needs it |
| Toasts | `toastStore` | cross-cutting, fire and forget |

Main decisions:

- **Zustand holds server data too**, with a small hand-written cache (dedupe, abort, keep stale data on a failed
  refresh). With four endpoints and one aggregate this is a small, tested surface. TanStack Query would be my
  choice if the API grew; the brief asked for Zustand and the extra layer would not remove code that matters here.
- **Writes are pessimistic: send, then re-read the owner.** Both `PUT`s answer 204 with no body, so the server is
  the only reliable source for what was stored. A failed re-read keeps the old data and warns; it never fails the write.
- **The API boundary is strict.** Responses are zod-parsed, ids are branded (`OwnerId` ≠ `PetId`), async state is a
  discriminated union, and every failure leaves `api/` as one `ApiError` (`network | http | invalid-response`).
- **Client validation mirrors the server's rules** for instant feedback; the server stays the authority and its field
  errors are shown on the offending input.
- **Search uses `GET /v2/owners`** (paged; the v1 list answers 404 when nothing matches).
- **Performance:** route-level `lazy` + `Suspense` for the rarely used panes (new owner, new pet, pet) and `memo` on
  search rows only, which re-render on every keystroke while their data does not. I did not add blanket
  `useMemo`/`useCallback`, virtualisation or the React Compiler: lists are short and I had no measurement asking for them.
- **Tests:** integration tests drive the real UI, stores and HTTP client against an in-memory fake of the backend
  (MSW); unit tests cover the pure domain code and the API client; the contract suite checks what I assumed about
  the real server. Not done: browser E2E.

## Assumptions

- Backend security is off (the default); no login.
- One receptionist per customer; no concurrent-edit handling beyond "last write wins" (the API offers nothing better).
- Search is by **last-name prefix**, all the API supports; an empty search lists the first page of owners.
- Phones can be typed in any common format but are stored as exactly 10 digits, which is what the server enforces
  (Q10), so international numbers cannot be entered.
- A visit is a date and a description (the API has no vet, time or status). The date defaults to today and may be any date.
- Desktop first (≥ 1024 px); below that the panes stack.

## API problems found

Found by reading the backend source and OpenAPI, then **checked against a running backend** (Spring PetClinic REST,
H2 profile, 2 Nov 2026). Each Q-numbered row is pinned by a test in `contract/`. Q9 (create-pet response) was checked
and is fine, so it is not listed.

| # | Problem | My workaround | Change I would propose |
|---|---|---|---|
| Q1/Q2 | `GET /owners?lastName=x` returns **404 with an empty body** when nothing matches | use `GET /v2/owners` (200 + empty page) | return `200 []`; keep 404 for missing resources |
| Q3/Q4 | Search is **last name only, prefix, case-sensitive**; no first name, phone or pet name | capitalise the first letter ("mctavish" still misses "McTavish") | one `q` parameter: case-insensitive contains over name, phone and pet name |
| Q5 | `PUT` owner / pet return **204 with no body** | re-read the owner after every write | return the updated resource and an `ETag` |
| Q6 | Visit `POST` **does not check the pet belongs to `{ownerId}`** in the path | the UI only uses the open owner's own pets | validate the relation; 404/422 otherwise |
| Q7 | Visit for a non-existent pet gives a vague **404** (every integrity error is mapped to 404) | none needed; the UI cannot produce it | explicit "pet not found"; do not hide real bugs behind one handler |
| Q8 | Pet birth-date rules (not future, ≤ 50 years) exist only in code, **not in the OpenAPI schema** | duplicated the rule in the client | express them in the schema; fix a timezone for "today" |
| Q10 | **Phone must be exactly 10 digits** (entity rule) but OpenAPI says 1–20; a short number passes request validation and fails with **500** | client requires exactly 10 digits, so the 500 cannot be triggered | align schema and entity; map constraint violations to 400 with field messages; accept E.164 |
| — | Validation errors use undocumented `field` / `defaultMessage` keys, plus English sentences in `message` | map by `field`, else by `[Path '/x']` | document the shape; add machine-readable codes |
| — | `/v2/owners` is paged but every row carries **all pets and visits** (EAGER fetch, N+1) | none (data is small); rows only show names | summary DTO or `?expand=pets` |
| — | No concurrency control: reads have ETags, writes ignore `If-Match` | last write wins | version field / `If-Match` → 412 |
| — | A visit has only `date` + `description` (`date` is optional) | free text only | add `vetId`, `time`, `status` |

## Known limitations

- **No unsaved-changes guard:** opening another owner while a form is half-filled discards it.
- Search cannot find by phone, first name or pet name (API limitation above).
- Visits cannot be edited or deleted in the UI, and owners and pets cannot be deleted (the API supports it).
- Writes are not optimistic, so a slow server is visible; requests time out after 15 s with a Retry button.
- English only, dates in `en-GB`; accessibility is covered by role/label queries in tests, with no automated axe audit.
- Integration tests run against a *fake* of the backend. The contract suite touches the real one but is run by hand
  (it passed on 2 Nov 2026), not in CI. No browser E2E.
- Backend data is in memory, so bookmarked ids break after a restart. On the live demo the free backend also sleeps,
  and waking it (about a minute) takes longer than the 15 s timeout, so the first visit after idle shows an error
  until Retry is pressed.

## What I would improve next

1. Run the contract suite in CI against the backend's Docker image, then add a few Playwright flows.
2. An unsaved-changes guard, and optimistic updates for registering a visit.
3. Backend side: the `q` search, summary DTO and `If-Match` proposals above remove most of the workarounds.
4. Visit edit/delete, vet and appointment display, axe checks in CI, i18n.
5. If the API grows: move server state to TanStack Query and keep Zustand for UI state only.

## AI usage

See [`docs/ai/`](docs/ai): the plan and decisions, the API analysis that drove the design, and a log of what the AI
got wrong, how each error was caught, and what was and was not verified.
