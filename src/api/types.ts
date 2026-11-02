import { z } from 'zod'

/**
 * Wire types for Spring PetClinic REST (see openapi.yml in the backend repo).
 *
 * Responses are validated at the boundary with zod so that the rest of the app
 * can rely on the inferred TypeScript types instead of trusting `any`.
 * Schemas are deliberately lenient where the API is lenient (e.g. `visit.date`
 * is optional in the spec) and strict where the UI cannot work without a value.
 *
 * Identifiers are branded: an `OwnerId` is not assignable to a `PetId`, which
 * removes a whole class of "passed the wrong id" bugs in a domain where every
 * entity id is just a number.
 */

export const OwnerIdSchema = z.number().int().nonnegative().brand<'OwnerId'>()
export const PetIdSchema = z.number().int().nonnegative().brand<'PetId'>()
export const VisitIdSchema = z.number().int().nonnegative().brand<'VisitId'>()
export const PetTypeIdSchema = z.number().int().nonnegative().brand<'PetTypeId'>()

export type OwnerId = z.infer<typeof OwnerIdSchema>
export type PetId = z.infer<typeof PetIdSchema>
export type VisitId = z.infer<typeof VisitIdSchema>
export type PetTypeId = z.infer<typeof PetTypeIdSchema>

/** Parse an untrusted number (route param, test fixture) into a branded id. */
export const asOwnerId = (n: number): OwnerId => OwnerIdSchema.parse(n)
export const asPetId = (n: number): PetId => PetIdSchema.parse(n)
export const asVisitId = (n: number): VisitId => VisitIdSchema.parse(n)
export const asPetTypeId = (n: number): PetTypeId => PetTypeIdSchema.parse(n)

/** Calendar date as `YYYY-MM-DD` (no time, no timezone). */
export type IsoDate = string

export const PetTypeSchema = z.object({
  id: PetTypeIdSchema,
  name: z.string(),
})
export type PetType = z.infer<typeof PetTypeSchema>

export const VisitSchema = z.object({
  id: VisitIdSchema,
  petId: PetIdSchema,
  // Optional in the OpenAPI spec; the server fills in "today" when omitted.
  date: z.string().nullish(),
  description: z.string(),
})
export type Visit = z.infer<typeof VisitSchema>

export const PetSchema = z.object({
  id: PetIdSchema,
  name: z.string(),
  birthDate: z.string().nullish(),
  type: PetTypeSchema,
  ownerId: OwnerIdSchema.nullish(),
  visits: z.array(VisitSchema).default([]),
})
export type Pet = z.infer<typeof PetSchema>

/**
 * What the UI needs back from `POST .../pets` and `POST .../visits`: the new
 * id (to navigate / confirm) and the name. Everything else is re-read from
 * `GET /owners/{id}` right after, so we deliberately do not depend on the rest
 * of these responses. (Observed against the real server: the echo is complete,
 * but parsing only what we use keeps us independent of that.)
 */
export const CreatedPetSchema = z.object({ id: PetIdSchema, name: z.string() })
export type CreatedPet = z.infer<typeof CreatedPetSchema>
export const CreatedVisitSchema = z.object({ id: VisitIdSchema })
export type CreatedVisit = z.infer<typeof CreatedVisitSchema>

export const OwnerSchema = z.object({
  id: OwnerIdSchema,
  firstName: z.string(),
  lastName: z.string(),
  address: z.string(),
  city: z.string(),
  telephone: z.string(),
  pets: z.array(PetSchema).default([]),
})
export type Owner = z.infer<typeof OwnerSchema>

export const OwnerPageSchema = z.object({
  content: z.array(OwnerSchema),
  page: z.number().int(),
  size: z.number().int(),
  totalElements: z.number().int(),
  totalPages: z.number().int(),
})
export type OwnerPage = z.infer<typeof OwnerPageSchema>

export const PetTypeListSchema = z.array(PetTypeSchema)

// ---- Request payloads (the "*Fields" schemas of the OpenAPI document) ----

export interface OwnerFields {
  firstName: string
  lastName: string
  address: string
  city: string
  telephone: string
}

export interface PetFields {
  name: string
  birthDate: IsoDate
  type: PetType
}

export interface VisitFields {
  date: IsoDate
  description: string
}

// ---- Error envelope ----

/**
 * RFC 7807-style body. Everything is optional because errors can also come
 * from the proxy or the servlet container, where the shape is not guaranteed.
 * The API adds undocumented `field` / `defaultMessage` keys to validation
 * messages (the spec allows `additionalProperties`), which we use when present.
 */
export const ProblemDetailSchema = z.object({
  title: z.string().optional(),
  status: z.number().optional(),
  detail: z.string().optional(),
  schemaValidationErrors: z
    .array(
      z.object({
        message: z.string().optional(),
        field: z.string().optional(),
        defaultMessage: z.string().optional(),
      }),
    )
    .optional(),
})
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>
