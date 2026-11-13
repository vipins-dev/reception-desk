import { asPetTypeId } from '@/api/types'
import { todayIso, yearsAgoIso } from './dates'
import {
  newOwnerFormSchema,
  normalizePhone,
  ownerFormSchema,
  petFormSchema,
  toOwnerFields,
  toPetFields,
  visitFormSchema,
} from './validation'

const validOwner = {
  firstName: 'Maria',
  lastName: "O'Neil-Smith",
  address: '1 Main St.',
  city: 'Madison',
  telephone: '(608) 555-1023',
}

const messagesFor = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, field: string) =>
  result.error?.issues.filter((i) => i.path[0] === field).map((i) => i.message) ?? []

describe('ownerFormSchema', () => {
  it('accepts a normal owner, including formatted phone numbers', () => {
    expect(ownerFormSchema.safeParse(validOwner).success).toBe(true)
  })

  it('accepts unicode letters and a trailing period only on the last name', () => {
    expect(ownerFormSchema.safeParse({ ...validOwner, firstName: 'Zoë', lastName: 'Müller Jr.' }).success).toBe(true)
    expect(ownerFormSchema.safeParse({ ...validOwner, firstName: 'Zoë.' }).success).toBe(false)
  })

  it('requires every field and explains what is wrong', () => {
    const r = ownerFormSchema.safeParse({ firstName: '', lastName: '', address: ' ', city: '', telephone: '' })
    expect(messagesFor(r, 'firstName')).toContain('First name is required')
    expect(messagesFor(r, 'address')).toContain('Address is required')
    expect(messagesFor(r, 'telephone')).toContain('Phone number is required')
  })

  it.each(['abc', '+1 608 555', '12345', '60855510234', '12345678901234567890123'])('rejects phone %s', (telephone) => {
    expect(ownerFormSchema.safeParse({ ...validOwner, telephone }).success).toBe(false)
  })

  it('requires exactly 10 digits after formatting is stripped (the real server rule)', () => {
    const r = ownerFormSchema.safeParse({ ...validOwner, telephone: '12345' })
    expect(messagesFor(r, 'telephone')).toEqual(['Enter exactly 10 digits (spaces, dashes and brackets are ignored)'])
    expect(ownerFormSchema.safeParse({ ...validOwner, telephone: '608.555.1023' }).success).toBe(true)
  })

  it('rejects names with digits or more than three words', () => {
    expect(ownerFormSchema.safeParse({ ...validOwner, firstName: 'R2D2' }).success).toBe(false)
    expect(ownerFormSchema.safeParse({ ...validOwner, lastName: 'A B C D' }).success).toBe(false)
  })
})

describe('toOwnerFields', () => {
  it('trims and strips phone formatting down to digits', () => {
    const fields = toOwnerFields({ ...validOwner, firstName: '  Maria ', telephone: ' (608) 555-1023 ' })
    expect(fields).toMatchObject({ firstName: 'Maria', telephone: '6085551023' })
  })
})

describe('normalizePhone', () => {
  it('removes spaces, dots, dashes and brackets but not other characters', () => {
    expect(normalizePhone('(608) 555.10-23')).toBe('6085551023')
    expect(normalizePhone('+1608')).toBe('+1608') // stays invalid; "+" is not accepted by the API
  })
})

describe('petFormSchema', () => {
  const base = { name: 'Leo', birthDate: '2020-05-05', typeId: '1' }

  it('accepts a valid pet', () => {
    expect(petFormSchema.safeParse(base).success).toBe(true)
  })

  it('rejects future birth dates', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const r = petFormSchema.safeParse({ ...base, birthDate: todayIso(tomorrow) })
    expect(messagesFor(r, 'birthDate')).toEqual(['Birth date cannot be in the future'])
  })

  it('accepts today and rejects dates older than 50 years', () => {
    expect(petFormSchema.safeParse({ ...base, birthDate: todayIso() }).success).toBe(true)
    const tooOld = petFormSchema.safeParse({ ...base, birthDate: '1900-01-01' })
    expect(messagesFor(tooOld, 'birthDate')).toEqual(['Birth date cannot be older than 50 years'])
    expect(petFormSchema.safeParse({ ...base, birthDate: yearsAgoIso(50) }).success).toBe(true)
  })

  it('requires a type and a real calendar date', () => {
    expect(messagesFor(petFormSchema.safeParse({ ...base, typeId: '' }), 'typeId')).toEqual(['Choose a species'])
    expect(messagesFor(petFormSchema.safeParse({ ...base, birthDate: '2020-02-31' }), 'birthDate')).toEqual([
      'Enter a valid date',
    ])
  })
})

describe('toPetFields', () => {
  const types = [{ id: asPetTypeId(1), name: 'cat' }]
  it('resolves the selected type id to the full PetType the API expects', () => {
    expect(toPetFields({ name: ' Leo ', birthDate: '2020-05-05', typeId: '1' }, types)).toEqual({
      name: 'Leo',
      birthDate: '2020-05-05',
      type: { id: 1, name: 'cat' },
    })
  })
  it('fails loudly on an unknown type rather than sending a bad request', () => {
    expect(() => toPetFields({ name: 'x', birthDate: '2020-05-05', typeId: '99' }, types)).toThrow(/Unknown pet type/)
  })
})

describe('visitFormSchema', () => {
  it('requires a description and a valid date', () => {
    const r = visitFormSchema.safeParse({ date: '', description: '   ' })
    expect(messagesFor(r, 'date')).toContain('Visit date is required')
    expect(messagesFor(r, 'description')).toContain('Describe the reason for the visit')
  })
  it('limits the description to the API maximum of 255', () => {
    expect(visitFormSchema.safeParse({ date: '2026-01-01', description: 'x'.repeat(256) }).success).toBe(false)
    expect(visitFormSchema.safeParse({ date: '2026-01-01', description: 'x'.repeat(255) }).success).toBe(true)
  })
})

describe('newOwnerFormSchema', () => {
  const base = { ...validOwner, withPet: false, petName: '', petBirthDate: '', petTypeId: '' }

  it('ignores the pet fields while "also register their pet" is off', () => {
    expect(newOwnerFormSchema.safeParse(base).success).toBe(true)
  })

  it('requires the pet fields when it is on, and names each missing one', () => {
    const r = newOwnerFormSchema.safeParse({ ...base, withPet: true })
    expect(messagesFor(r, 'petName')).toEqual(['Pet name is required'])
    expect(messagesFor(r, 'petBirthDate')).toContain('Birth date is required')
    expect(messagesFor(r, 'petTypeId')).toEqual(['Choose a species'])
  })

  it('applies the same pet rules as the stand-alone pet form', () => {
    const r = newOwnerFormSchema.safeParse({ ...base, withPet: true, petName: 'Milo', petTypeId: '1', petBirthDate: '2999-01-01' })
    expect(messagesFor(r, 'petBirthDate')).toEqual(['Birth date cannot be in the future'])
  })

  it('still validates the owner part', () => {
    const r = newOwnerFormSchema.safeParse({ ...base, telephone: '12345' })
    expect(messagesFor(r, 'telephone')).toHaveLength(1)
  })

  it('accepts a complete owner with a first pet', () => {
    expect(
      newOwnerFormSchema.safeParse({ ...base, withPet: true, petName: 'Milo', petTypeId: '1', petBirthDate: '2022-03-04' }).success,
    ).toBe(true)
  })
})
