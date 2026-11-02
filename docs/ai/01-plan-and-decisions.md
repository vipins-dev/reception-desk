# Working plan and decisions (written before coding, kept up to date)

Tool: Claude Code (agent) driven from a desktop session. Inputs given to it: the assignment text and the
instruction "Zustand for state, Railway to deploy, GitHub for the repo; find a good architecture". No
secrets, personal data or employer material were provided.

## Requirement → design

| Requirement | Design |
|---|---|
| find or create owner | always-visible search pane; "no match → Create owner “X”" prefilled |
| owner details + pets | owner pane, one request (`GET /owners/{id}` returns pets + visits) |
| open pet, see visits | pet pane next to the owner pane; selection is in the URL |
| register visit | form always visible on the pet pane, date defaults to today |
| add pet / edit owner / edit pet | inline forms in the same panes (no modal, no page change) |
| "no continuous navigation" | one shell, three panes; only the right-hand content changes |

## Decisions and the alternatives rejected

1. **URL as selection state** (not a `selectedOwnerId` in a store): deep links, back button, no drift.
2. **Owner aggregate as the cache unit**: the API already returns owner+pets+visits; a normalised
   pets/visits cache would create three copies of one fact to keep in sync.
3. **Pessimistic writes + re-read**: two PUTs return 204 with no body. Optimistic updates
   deferred (listed as an improvement).
4. **Zustand for server data too** (brief requirement) with a deliberately small hand-written cache;
   TanStack Query considered and rejected for this scope (documented in README).
5. **Latest-request-wins search** (abort + ignore stale) instead of debounce alone.
6. **`/v2/owners`** instead of v1 list (v1 answers 404 on no match).
7. **Tests**: integration tests drive the real UI + stores + HTTP client against an in-memory fake of the
   backend (MSW); a separate contract suite checks assumptions on the real backend.
8. **Deploy**: Railway runs both as two services: the backend from the public Docker image, and the frontend
   from a Dockerfile (nginx serving the Vite build and proxying `/petclinic/*` to the backend over the private
   network: same origin, no CORS). Vercel was considered and dropped: it cannot run the Java backend, so it
   would have meant two platforms.

## Follow-up requests during the work

- "Do we need TanStack Query / memoisation / Suspense / lazy?" → applied only what is measurable (route
  `lazy` + `Suspense`, `memo` on search rows); the rest is recorded as deliberately not used in the README.
