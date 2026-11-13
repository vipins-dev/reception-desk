import { z } from 'zod'
import { asPetTypeId } from '@/api/types'
import type { OwnerFields, PetFields, PetType, VisitFields } from '@/api/types'
import { isValidIsoDate, todayIso, yearsAgoIso } from './dates'

/**
 * Client-side validation that mirrors the constraints published in the
 * backend's OpenAPI document, so the receptionist gets feedback while the
 * customer is still on the line instead of after a 400. The server stays the
 * authority: anything we miss comes back as a ProblemDetail and is shown on
 * the offending field (see `ApiError.fieldErrors`).
 *
 * Form schemas keep input and output types identical (strings in, strings
 * out); conversion to API payloads happens in the `to*Fields` mappers below.
 */

// openapi.yml: Owner.firstName / lastName patterns, \p{L} = any unicode letter
const FIRST_NAME = /^\p{L}+([ '-]\p{L}+){0,2}$/u
const LAST_NAME = /^\p{L}+([ '-]\p{L}+){0,2}\.?$/u
const NAME_HINT = "Letters only; spaces, hyphens and apostrophes allowed between words"

/**
 * People type "(608) 555-1023"; the API wants bare digits. Note the two layers disagree:
 * OpenAPI says `^[0-9]*$` (max 20) but the entity enforces exactly 10 digits and
 * answers a 500 (not a 400) otherwise. We validate the stricter, real rule.
 */
export const normalizePhone = (raw: string): string => raw.replace(/[\s().-]/g, '')

const PHONE_DIGITS = /^[0-9]{10}$/

export const ownerFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(30, 'At most 30 characters')
    .regex(FIRST_NAME, NAME_HINT),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required')
    .max(30, 'At most 30 characters')
    .regex(LAST_NAME, NAME_HINT),
  address: z.string().trim().min(1, 'Address is required').max(255, 'At most 255 characters'),
  city: z.string().trim().min(1, 'City is required').max(80, 'At most 80 characters'),
  telephone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .refine(
      (v) => PHONE_DIGITS.test(normalizePhone(v)),
      'Enter exactly 10 digits (spaces, dashes and brackets are ignored)',
    ),
})
export type OwnerFormValues = z.infer<typeof ownerFormSchema>

export const petFormSchema = z.object({
  name: z.string().trim().min(1, 'Pet name is required').max(30, 'At most 30 characters'),
  birthDate: z
    .string()
    .min(1, 'Birth date is required')
    .refine(isValidIsoDate, 'Enter a valid date')
    // Backend rule (PetAgeValidator): not in the future, not older than 50 years.
    .refine((v) => !isValidIsoDate(v) || v <= todayIso(), 'Birth date cannot be in the future')
    .refine((v) => !isValidIsoDate(v) || v >= yearsAgoIso(50), 'Birth date cannot be older than 50 years'),
  typeId: z.string().min(1, 'Choose a species'),
})
export type PetFormValues = z.infer<typeof petFormSchema>

/**
 * New Owner drawer: the owner fields plus an optional first pet, validated in
 * one pass. The pet fields only count when "Also register their pet now" is on;
 * they reuse `petFormSchema` so the rules cannot drift apart.
 */
export const newOwnerFormSchema = ownerFormSchema
  .extend({
    withPet: z.boolean(),
    petName: z.string(),
    petBirthDate: z.string(),
    petTypeId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.withPet) return
    const pet = petFormSchema.safeParse({ name: v.petName, birthDate: v.petBirthDate, typeId: v.petTypeId })
    if (pet.success) return
    const target = { name: 'petName', birthDate: 'petBirthDate', typeId: 'petTypeId' } as const
    for (const issue of pet.error.issues) {
      const key = issue.path[0]
      if (key === 'name' || key === 'birthDate' || key === 'typeId') {
        ctx.addIssue({ code: 'custom', path: [target[key]], message: issue.message })
      }
    }
  })
export type NewOwnerFormValues = z.infer<typeof newOwnerFormSchema>

export const visitFormSchema = z.object({
  date: z.string().min(1, 'Visit date is required').refine(isValidIsoDate, 'Enter a valid date'),
  description: z.string().trim().min(1, 'Describe the reason for the visit').max(255, 'At most 255 characters'),
})
export type VisitFormValues = z.infer<typeof visitFormSchema>

// ---- form values -> API payloads ----

export const toOwnerFields = (v: OwnerFormValues): OwnerFields => ({
  firstName: v.firstName.trim(),
  lastName: v.lastName.trim(),
  address: v.address.trim(),
  city: v.city.trim(),
  telephone: normalizePhone(v.telephone.trim()),
})

export function toPetFields(v: PetFormValues, types: readonly PetType[]): PetFields {
  const type = types.find((t) => t.id === asPetTypeId(Number(v.typeId)))
  if (!type) throw new Error(`Unknown pet type id ${v.typeId}`)
  return { name: v.name.trim(), birthDate: v.birthDate, type }
}

export const toVisitFields = (v: VisitFormValues): VisitFields => ({
  date: v.date,
  description: v.description.trim(),
})
