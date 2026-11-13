import { FIRST_LOAD_TIMEOUT_MS, request } from './client'
import {
  OwnerPageSchema,
  OwnerSchema,
  CreatedPetSchema,
  CreatedVisitSchema,
  PetTypeListSchema,
  type Owner,
  type OwnerFields,
  type OwnerId,
  type OwnerPage,
  type CreatedPet,
  type CreatedVisit,
  type PetFields,
  type PetId,
  type PetType,
  type VisitFields,
} from './types'

/**
 * Typed functions for the PetClinic endpoints this app uses. This is the only
 * module that knows URLs and HTTP verbs; stores call these and never `fetch`.
 *
 * Decisions that come from reading the backend source (see README "API problems"):
 *  - Owner search uses `GET /v2/owners` (paginated, 200 + empty page when
 *    nothing matches). The v1 list answers 404 with an empty body instead.
 *  - Mutations that answer 204 (`PUT` owner / pet) return `void`; callers
 *    re-read the owner afterwards rather than guessing the new state.
 */

export interface SearchOwnersParams {
  lastName: string
  page: number
  size: number
}

export const searchOwners = (params: SearchOwnersParams, signal?: AbortSignal): Promise<OwnerPage> =>
  request('/v2/owners', {
    query: { lastName: params.lastName, page: params.page, size: params.size },
    schema: OwnerPageSchema,
    signal,
  })

/**
 * One page of *all* owners (an empty last name matches everyone). The desk
 * loads the whole list this way and searches it locally, because the API can
 * only search by last name.
 */
export const listOwners = (page: number, size: number, signal?: AbortSignal): Promise<OwnerPage> =>
  request('/v2/owners', {
    query: { lastName: '', page, size },
    schema: OwnerPageSchema,
    signal,
    timeoutMs: FIRST_LOAD_TIMEOUT_MS,
  })

export const getOwner = (id: OwnerId, signal?: AbortSignal): Promise<Owner> =>
  request(`/owners/${id}`, { schema: OwnerSchema, signal, timeoutMs: FIRST_LOAD_TIMEOUT_MS })

export const createOwner = (fields: OwnerFields): Promise<Owner> =>
  request('/owners', { method: 'POST', body: fields, schema: OwnerSchema })

export const updateOwner = (id: OwnerId, fields: OwnerFields): Promise<void> =>
  request(`/owners/${id}`, { method: 'PUT', body: fields })

export const addPet = (ownerId: OwnerId, fields: PetFields): Promise<CreatedPet> =>
  request(`/owners/${ownerId}/pets`, { method: 'POST', body: fields, schema: CreatedPetSchema })

export const updatePet = (ownerId: OwnerId, petId: PetId, fields: PetFields): Promise<void> =>
  request(`/owners/${ownerId}/pets/${petId}`, { method: 'PUT', body: fields })

export const addVisit = (ownerId: OwnerId, petId: PetId, fields: VisitFields): Promise<CreatedVisit> =>
  request(`/owners/${ownerId}/pets/${petId}/visits`, {
    method: 'POST',
    body: fields,
    schema: CreatedVisitSchema,
  })

export const listPetTypes = (signal?: AbortSignal): Promise<PetType[]> =>
  request('/pettypes', { schema: PetTypeListSchema, signal })
