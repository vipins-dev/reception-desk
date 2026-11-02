# API analysis (agent-produced from the backend source + OpenAPI)

Method: cloned `spring-petclinic/spring-petclinic-rest` (read-only), read `openapi.yml`, controllers,
`ExceptionControllerAdvice`, repositories, `PetAgeValidator`, `data.sql`. Written from source first; afterwards each claim was checked with a `contract/` test (Q-number) against a
running backend. Results are noted per item.

Evidence (file → what it shows):

- `SpringDataOwnerRepository` → search is `lastName LIKE :lastName%` (prefix; H2 LIKE is case-sensitive) — Q3/Q4
- `OwnerRestControllerV1.listOwners` → `404` when the result is empty — Q2
- `OwnerRestControllerV2.listOwnersPage` → page object, `Sort.by("id")`, empty page is a 200 — Q1
- `Owner`/`Pet` mappings are `FetchType.EAGER` → v2 rows carry pets + visits (N+1)
- `updateOwner` / `updateOwnersPet` return `204` — Q5
- `addVisitToOwner` builds a `Pet` stub from `petId` and never checks `ownerId` — Q6
- `ExceptionControllerAdvice` maps `DataIntegrityViolationException` to `404` — Q7
- `PetAgeValidator` (future / > 50 years) is an annotation, absent from the OpenAPI constraints — Q8
- `addPetToOwner` calls `pet.getType().setName(null)` before save — Q9 **(guessed the echo would lack the name; the running server echoes it fully — guess was wrong)**
- `Owner.telephone` entity constraint `^[0-9]{10}$` vs OpenAPI `^[0-9]*$` — Q10 **(missed when reading the OpenAPI + controllers; found by running the app against the real server)**
- `handleMethodArgumentNotValid` adds `field`, `defaultMessage`, `rejectedValue` to validation messages (undocumented)
- OpenAPI `telephone` pattern `^[0-9]*$` with `minLength: 1`; names `^\p{L}+([ '-]\p{L}+){0,2}$`
- `petclinic.security.enable=false`, H2 in-memory, `spring.sql.init.mode=always` → data resets on restart

How it changed the design: v2 search; capitalised prefix; re-read after writes; lenient create responses;
client-side mirror of validation; phone normalisation; no pet/visit cache.
