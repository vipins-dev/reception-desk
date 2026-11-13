# Working plan and decisions (written before coding, kept up to date)

Tool: Claude Code (agent) driven from a desktop session. Inputs given to it: the assignment text and the
instruction "Zustand for state, Railway to deploy, GitHub for the repo; find a good architecture". No
secrets, personal data or employer material were provided.

## Requirement → design

| Requirement | Design |
|---|---|
| find or create owner | lookup pane (name / phone / city / pet filter, species chips); "no match → Create “X”" opens the New Owner drawer, prefilled |
| owner details + pets | owner pane, one request (`GET /owners/{id}` returns pets + visits) |
| open pet, see visits | pet pane next to the owner pane; selection is in the URL |
| register visit | composer always visible on the pet pane, date defaults to today, quick-fill notes |
| add pet / edit owner / edit pet | inline forms in the same panes; the drawer registers an owner and their first pet together |
| "no continuous navigation" | one shell, three panes; Today's Visits and All Owners are views whose rows jump back to the Front Desk |

## Decisions and the alternatives rejected

1. **URL as selection state** (not a `selectedOwnerId` in a store): deep links, back button, no drift.
2. **Owner aggregate as the cache unit**: the API already returns owner+pets+visits; a normalised
   pets/visits cache would create three copies of one fact to keep in sync.
3. **Pessimistic writes + re-read**: two PUTs return 204 with no body. Optimistic updates
   deferred (listed as an improvement).
4. **Zustand for server data too**, with a deliberately small hand-written cache. Zustand was the owner's choice of
   state library (the instruction to the AI above); the assignment leaves the stack open. TanStack Query was
   considered and rejected for this scope: four endpoints and one aggregate (documented in README).
5. **Latest-request-wins loading** (abort + ignore stale). Originally for server-side search; since decision 9 it
   applies to the owner-directory load, and a slow list response also cannot overwrite an owner re-read after it
   was requested (`requestedAt` on each cached record).
6. **`/v2/owners`** instead of v1 list (v1 answers 404 on no match).
7. **Tests**: integration tests drive the real UI + stores + HTTP client against an in-memory fake of the
   backend (MSW); a separate contract suite checks assumptions on the real backend.
8. **Hosting is optional; local run is the primary path.** The assignment says to run the backend locally and
   asks for run instructions, not a public URL. Railway (two services) was planned first, but its trial had ended;
   Vercel was considered and dropped because it cannot run the Java backend. The demo is on Render's free tier
   instead (static site + the backend's public image as a web service, a rewrite rule keeps the browser
   same-origin). Cost: the backend sleeps and loses its data, which the README says plainly. A Dockerfile,
   nginx config and compose file written earlier for the two-service Railway plan were never run (no Docker on
   the development machine) and the Render deployment does not use them, so they were deleted.
9. **UI redesign from a provided design** (screenshot, reference prototype and written guidelines). It kept the
   stores and API layer and changed the screens. What the API could not do as specified was adapted, not faked:
   - *Search by name, phone, city or pet*: the API only searches last names, so the app loads every owner once and
     filters in the browser (`domain/search.ts`). Rejected: keep server-side search and add the other fields
     client-side (cannot find what the server filtered out); a server-side `q` (not available, backend is fixed).
   - *Today's Visits / All Owners*: derived from the owner cache (each owner carries pets and visits), because there
     is no "visits by date" endpoint. All lists are derived from the one cache, so a write shows up everywhere.
   - *New Owner drawer*: a `?new=owner` URL flag so it opens over any screen; "also register their pet" runs two
     requests (owner, then pet). If the pet fails after the owner was created, the owner is kept and opened.
   - *Add pet*: inline in the owner pane (component state) instead of a route.
   - Design rules followed: flat panels, no pills, no left accent stripes, one teal accent, tabular numbers in a
     monospaced face, 40 px controls, skeletons, empty states with an action, focus rings, `prefers-reduced-motion`.
10. **Short digit strings do not narrow the search.** One or two digits are not a phone number yet; treating them as
    text made "No owner found" flash on the first keystroke of a phone number.

## Follow-up requests during the work

- "Do we need TanStack Query / memoisation / Suspense / lazy?" → applied only what is measurable (route
  `lazy` + `Suspense`, `memo` on search rows); the rest is recorded as deliberately not used in the README.
- "I like this UI, can we do this" (pasted design guidelines, a screenshot and a reference prototype URL) → decision 9.
