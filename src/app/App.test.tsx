import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { todayIso } from '@/domain/dates'
import { useDirectoryStore } from '@/stores/directoryStore'
import { BASE, db } from '@/test/fakeBackend'
import { server } from '@/test/server'
import { App } from './App'

/**
 * Whole-application tests: real components, real routing, real stores, real
 * HTTP client; only the network edge is faked (MSW). Each test is a receptionist
 * task from the assignment.
 *
 * Seed data (see fakeBackend): George Franklin (Leo, cat), Betty Davis (Basil,
 * hamster), Harold Davis (Iggy, lizard), Jean Coleman (Samantha and Max, cats).
 */

type User = ReturnType<typeof userEvent.setup>

function setup(path = '/') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  return user
}

const searchBox = () => screen.getByRole('searchbox', { name: /search owners/i })
/** The lookup list; resolves once the directory has loaded. */
const lookupList = () => screen.findByRole('list', { name: 'Owners' })
const ownerPanel = async () => within(await screen.findByRole('region', { name: 'Owner' }))
const petPanel = async () => within(await screen.findByRole('region', { name: 'Pet' }))
// The drawer is lazy-loaded, so it appears a moment after the click.
const drawer = async () => within(await screen.findByRole('dialog', { name: /register new owner/i }))
// Always re-query: the list is unmounted while nobody matches, so an old reference goes stale.
const rows = async () => within(await lookupList()).getAllByRole('link')

async function openOwner(user: User, query: string, name: RegExp) {
  await lookupList()
  await user.type(searchBox(), query)
  await user.click(await within(await lookupList()).findByRole('link', { name }))
}

async function fillOwner(user: User, scope: ReturnType<typeof within>, owner: { first?: string; last?: string; address: string; city: string; phone: string }) {
  if (owner.first !== undefined) await user.type(scope.getByLabelText('First name'), owner.first)
  if (owner.last !== undefined) await user.type(scope.getByLabelText('Last name'), owner.last)
  await user.type(scope.getByLabelText('Street address'), owner.address)
  await user.type(scope.getByLabelText('City'), owner.city)
  await user.type(scope.getByLabelText('Telephone (10 digits)'), owner.phone)
}

describe('the frame', () => {
  it('has three views and one primary action, with Front Desk current', async () => {
    setup()
    const nav = screen.getByRole('navigation', { name: 'Views' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Front Desk', "Today's Visits", 'All Owners'])
    expect(within(nav).getByRole('link', { name: 'Front Desk' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'New Owner' })).toBeInTheDocument()
    await lookupList()
  })
})

describe('finding an owner and reading their records', () => {
  it('lists every owner alphabetically with phone, city and pets, and counts them', async () => {
    setup()
    const list = await lookupList()
    expect(within(list).getAllByRole('link')).toHaveLength(4)
    const [first, , , last] = within(list).getAllByRole('link')
    expect(first).toHaveTextContent('Jean Coleman')
    expect(first).toHaveTextContent('(608) 555-2654 · Monona')
    expect(first).toHaveTextContent('Samantha (Cat), Max (Cat)')
    expect(first).toHaveTextContent('2 pets')
    expect(last).toHaveTextContent('George Franklin')
    expect(screen.getByText('4 owners')).toBeInTheDocument()
  })

  it('filters as you type by name, phone, city or pet name, ignoring case', async () => {
    const user = setup()
    await lookupList()
    await user.type(searchBox(), 'COLE')
    expect(await rows()).toHaveLength(1)
    expect(screen.getByText('1 of 4 owners')).toBeInTheDocument()

    await user.clear(searchBox())
    await user.type(searchBox(), '555-1749') // Betty's phone, any format
    expect(await rows()).toHaveLength(1)
    expect((await rows())[0]).toHaveTextContent('Betty Davis')

    await user.clear(searchBox())
    await user.type(searchBox(), 'windsor')
    expect((await rows())[0]).toHaveTextContent('Harold Davis')

    await user.clear(searchBox())
    await user.type(searchBox(), 'basil') // a pet's name
    expect(await rows()).toHaveLength(1)
    expect((await rows())[0]).toHaveTextContent('Betty Davis')
  })

  it('does not flash "no owner found" while a phone number is still being typed', async () => {
    const user = setup()
    await lookupList()
    await user.type(searchBox(), '60')
    expect(await rows()).toHaveLength(4)
    expect(screen.queryByText(/No owner matches/)).not.toBeInTheDocument()
  })

  it('filters by species chip, alone or together with the search text', async () => {
    const user = setup()
    await lookupList()
    await user.click(screen.getByRole('button', { name: 'Cats' }))
    expect(await rows()).toHaveLength(2) // Coleman and Franklin keep cats
    await user.type(searchBox(), 'frank')
    expect(await rows()).toHaveLength(1)
    expect((await rows())[0]).toHaveTextContent('George Franklin')

    await user.click(screen.getByRole('button', { name: 'Dogs' }))
    expect(screen.getByText('No owner matches “frank”.')).toBeInTheDocument()
    await user.clear(searchBox())
    expect(screen.getByText('No owners with dogs.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Other' }))
    expect(await rows()).toHaveLength(2) // hamster and lizard
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the first result with Enter', async () => {
    const user = setup()
    await lookupList()
    await user.type(searchBox(), 'Davis')
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Betty Davis' })).toBeInTheDocument()
  })

  it('focuses the search with "/" and clears it with Escape or the clear button', async () => {
    const user = setup()
    await lookupList()
    await user.click(document.body)
    await user.keyboard('/')
    expect(searchBox()).toHaveFocus()
    expect(searchBox()).toHaveValue('') // the slash itself is not typed

    await user.type(searchBox(), 'davis')
    await user.keyboard('{Escape}')
    expect(searchBox()).toHaveValue('')

    await user.type(searchBox(), 'x')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(searchBox()).toHaveValue('')
    expect(searchBox()).toHaveFocus()
  })

  it("opens an owner with their details and pets, and the lookup stays put", async () => {
    const user = setup()
    await openOwner(user, 'cole', /Jean Coleman/)

    const owner = await ownerPanel()
    expect(await owner.findByRole('heading', { name: 'Jean Coleman' })).toBeInTheDocument()
    expect(owner.getByText('#6')).toBeInTheDocument()
    expect(owner.getByText('105 N. Lake St. · Monona')).toBeInTheDocument()
    expect(owner.getByRole('link', { name: '(608) 555-2654' })).toHaveAttribute('href', 'tel:6085552654')
    expect(owner.getByText(/2 registered pets/)).toBeInTheDocument()
    expect(owner.getByRole('heading', { name: /^Pets/ })).toHaveTextContent('2')
    const pets = within(owner.getByRole('list', { name: 'Pets' }))
    expect(pets.getByRole('link', { name: /Samantha/ })).toBeInTheDocument()
    expect(pets.getByRole('link', { name: /Max/ })).toHaveTextContent('2 visits')
    expect(pets.getByRole('link', { name: /Max/ })).toHaveTextContent('Last visit 3 Jan 2013')
    expect(searchBox()).toHaveValue('cole')
  })

  it('opens a pet and shows its details and previous visits, newest first', async () => {
    const user = setup('/owners/6')
    await user.click(await within((await ownerPanel()).getByRole('list', { name: 'Pets' })).findByRole('link', { name: /Max/ }))

    const pet = await petPanel()
    expect(await pet.findByRole('heading', { name: 'Max' })).toBeInTheDocument()
    expect(pet.getByText(/Owner: Jean Coleman/)).toBeInTheDocument()
    expect(pet.getByText('2 records')).toBeInTheDocument()
    const rows = within(pet.getByRole('list', { name: 'Previous visits' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('3 Jan 2013')
    expect(rows[0]).toHaveTextContent('neutered')
    expect(rows[1]).toHaveTextContent('rabies shot')
  })

  it('says so when a pet has no visits yet', async () => {
    setup('/owners/1/pets/1')
    expect(await screen.findByText('No visits recorded for Leo')).toBeInTheDocument()
    expect(screen.getByText(/log Leo’s first clinic visit/)).toBeInTheDocument()
  })

  it('deep links work: a pet URL loads owner and pet directly', async () => {
    setup('/owners/6/pets/8')
    expect(await screen.findByRole('heading', { name: 'Max' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jean Coleman' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Front Desk' })).toHaveAttribute('aria-current', 'page')
  })

  it('highlights the open owner in the lookup list', async () => {
    setup('/owners/2')
    const list = await lookupList()
    expect(within(list).getByRole('link', { name: /Betty Davis/ })).toHaveAttribute('aria-current', 'page')
  })

  it('explains an owner that does not exist', async () => {
    setup('/owners/999')
    expect(await screen.findByText('Owner #999 does not exist.')).toBeInTheDocument()
  })

  it('rejects a malformed owner id', async () => {
    setup('/owners/abc')
    expect(await screen.findByText('That is not a valid owner link.')).toBeInTheDocument()
  })

  it("won't show another owner's pet under this owner", async () => {
    setup('/owners/1/pets/8') // pet 8 is Jean Coleman's
    expect(await screen.findByText(/does not belong to George Franklin/)).toBeInTheDocument()
  })

  it('copies the telephone number with one click', async () => {
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('button', { name: 'Copy telephone number' }))
    expect(await navigator.clipboard.readText()).toBe('(608) 555-1023')
    expect(await screen.findByText('Telephone number copied')).toBeInTheDocument()
  })
})

describe('creating an owner when the customer does not exist yet', () => {
  it('offers to create from a failed search, prefilled, and opens the new owner with their pet', async () => {
    const user = setup()
    await lookupList()
    await user.type(searchBox(), 'sam smith')
    await user.click(await screen.findByRole('button', { name: 'Create “sam smith”' }))

    const form = await drawer()
    expect(form.getByLabelText('First name')).toHaveValue('Sam')
    expect(form.getByLabelText('Last name')).toHaveValue('Smith')
    expect(form.getByLabelText('Street address')).toHaveFocus() // the first thing still missing

    await fillOwner(user, form, { address: '5 Elm St', city: 'Madison', phone: '(608) 555-0101' })
    expect(form.getByRole('checkbox', { name: /also register their pet now/i })).toBeChecked()
    await user.type(await form.findByLabelText('Pet name'), 'Pixel')
    await user.selectOptions(form.getByLabelText('Species'), 'Dog')
    await user.type(form.getByLabelText('Birth date'), '2022-03-04')
    await user.click(form.getByRole('button', { name: 'Create & Open Record' }))

    expect(await screen.findByRole('heading', { name: 'Pixel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sam Smith' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(db.owners.at(-1)).toMatchObject({ firstName: 'Sam', lastName: 'Smith', telephone: '6085550101' })
    expect(db.pets.at(-1)).toMatchObject({ name: 'Pixel', ownerId: db.owners.at(-1)?.id, typeId: 2, birthDate: '2022-03-04' })
    expect(screen.getByText('Sam Smith and Pixel registered')).toBeInTheDocument()
    // the new owner is in the lookup list straight away
    expect(within(await lookupList()).getByRole('link', { name: /Sam Smith/ })).toHaveTextContent('Pixel (Dog)')
  })

  it('prefills the telephone number when the search was a phone number', async () => {
    const user = setup()
    await lookupList()
    await user.type(searchBox(), '608 555 0101')
    await user.click(await screen.findByRole('button', { name: 'Create “608 555 0101”' }))
    expect((await drawer()).getByLabelText('Telephone (10 digits)')).toHaveValue('608 555 0101')
    expect((await drawer()).getByLabelText('First name')).toHaveFocus()
  })

  it('can register just the owner by unticking "also register their pet"', async () => {
    const user = setup()
    await user.click(await screen.findByRole('button', { name: 'New Owner' }))
    const form = await drawer()
    await user.click(form.getByRole('checkbox', { name: /also register their pet now/i }))
    expect(form.queryByLabelText('Pet name')).not.toBeInTheDocument()
    await fillOwner(user, form, { first: 'Una', last: 'Solo', address: '1 Pine', city: 'Monona', phone: '6085550177' })
    await user.click(form.getByRole('button', { name: 'Create & Open Record' }))

    expect(await screen.findByRole('heading', { name: 'Una Solo' })).toBeInTheDocument()
    expect(screen.getByText('No pets registered yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Register First Pet' })).toBeInTheDocument()
    expect(db.pets).toHaveLength(5)
    expect(screen.getByText('Owner Una Solo registered')).toBeInTheDocument()
  })

  it('validates on the client before calling the API, pet fields included', async () => {
    const user = setup('/?new=owner')
    const before = db.owners.length
    await user.click(await screen.findByRole('button', { name: 'Create & Open Record' }))
    const form = await drawer()
    expect(await form.findByText('First name is required')).toBeInTheDocument()
    expect(form.getByText('Phone number is required')).toBeInTheDocument()
    expect(await form.findByText('Pet name is required')).toBeInTheDocument()
    expect(form.getByText('Choose a species')).toBeInTheDocument()
    expect(db.owners).toHaveLength(before)

    // errors clear as the user types
    await user.type(form.getByLabelText('First name'), 'Sam')
    expect(form.queryByText('First name is required')).not.toBeInTheDocument()
  })

  it('blocks a phone number that is not exactly 10 digits (the server would answer 500)', async () => {
    const user = setup('/?new=owner')
    const form = await drawer()
    await user.click(await form.findByRole('checkbox', { name: /also register their pet now/i }))
    await fillOwner(user, form, { first: 'Sam', last: 'Smith', address: '5 Elm St', city: 'Madison', phone: '12345' })
    const before = db.owners.length
    await user.click(form.getByRole('button', { name: 'Create & Open Record' }))
    expect(await form.findByText(/exactly 10 digits/)).toBeInTheDocument()
    expect(db.owners).toHaveLength(before)
  })

  it('shows server-side validation on the offending field when the client let it through', async () => {
    server.use(
      http.post(`${BASE}/owners`, () =>
        HttpResponse.json(
          {
            status: 400,
            detail: 'The request contains invalid or missing parameters',
            schemaValidationErrors: [{ field: 'telephone', defaultMessage: 'already in use' }],
          },
          { status: 400 },
        ),
      ),
    )
    const user = setup('/?new=owner')
    const form = await drawer()
    await user.click(await form.findByRole('checkbox', { name: /also register their pet now/i }))
    await fillOwner(user, form, { first: 'Sam', last: 'Smith', address: '5 Elm St', city: 'Madison', phone: '6085550101' })
    await user.click(form.getByRole('button', { name: 'Create & Open Record' }))
    expect(await form.findByText('already in use')).toBeInTheDocument()
    expect(form.getByLabelText('Telephone (10 digits)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('dialog')).toBeInTheDocument() // stays open so nothing is lost
  })

  it('keeps the owner and opens them when only the pet could not be added', async () => {
    server.use(http.post(`${BASE}/owners/:id/pets`, () => new HttpResponse(null, { status: 500 })))
    const user = setup('/?new=owner')
    const form = await drawer()
    await fillOwner(user, form, { first: 'Sam', last: 'Smith', address: '5 Elm St', city: 'Madison', phone: '6085550101' })
    await user.type(await form.findByLabelText('Pet name'), 'Pixel')
    await user.selectOptions(form.getByLabelText('Species'), 'Cat')
    await user.type(form.getByLabelText('Birth date'), '2022-03-04')
    await user.click(form.getByRole('button', { name: 'Create & Open Record' }))

    expect(await screen.findByRole('heading', { name: 'Sam Smith' })).toBeInTheDocument()
    expect(screen.getByText(/Owner registered, but Pixel could not be added/)).toBeInTheDocument()
    expect(db.owners.at(-1)?.lastName).toBe('Smith')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes with Escape, the close button or Cancel, saving nothing', async () => {
    const user = setup()
    const open = await screen.findByRole('button', { name: 'New Owner' })
    for (const close of [
      () => user.keyboard('{Escape}'),
      () => user.click(screen.getByRole('button', { name: 'Close' })),
      async () => user.click((await drawer()).getByRole('button', { name: 'Cancel' })),
    ]) {
      await user.click(open)
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      await close()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }
    expect(db.owners).toHaveLength(4)
  })

  it('slides over the current screen without changing what is open behind it', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    await user.click(screen.getByRole('button', { name: 'New Owner' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Max' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('heading', { name: 'Max' })).toBeInTheDocument()
  })

  it('offers to register the first client when there are no owners at all', async () => {
    db.owners = []
    db.pets = []
    db.visits = []
    setup()
    expect(await screen.findByText('No owners yet.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Register New Client' }).length).toBeGreaterThan(0)
  })
})

describe('registering a visit', () => {
  it('adds the visit to the history and leaves the form ready for the next one', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    const form = within(screen.getByRole('form', { name: 'Register visit' }))
    expect(form.getByLabelText('Visit date')).toHaveValue(todayIso())

    await user.type(form.getByLabelText('Reason / clinical note'), 'annual vaccination')
    await user.click(form.getByRole('button', { name: 'Register Visit' }))

    expect(await screen.findByText('3 records')).toBeInTheDocument()
    const history = within(screen.getByRole('list', { name: 'Previous visits' }))
    expect(history.getAllByRole('listitem')[0]).toHaveTextContent('annual vaccination')
    expect(history.getAllByRole('listitem')[0]).toHaveTextContent('Today')
    expect(db.visits.at(-1)).toMatchObject({ petId: 8, description: 'annual vaccination', date: todayIso() })
    expect(form.getByLabelText('Reason / clinical note')).toHaveValue('')
    expect(form.getByLabelText('Reason / clinical note')).toHaveFocus()
    expect(form.getByText('Visit registered')).toBeInTheDocument() // inline confirmation
  })

  it('fills the note from the quick templates, appending a second one', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    const note = screen.getByLabelText('Reason / clinical note')
    await user.click(screen.getByRole('button', { name: '+ Vaccination booster' }))
    expect(note).toHaveValue('Vaccination booster')
    await user.click(screen.getByRole('button', { name: '+ Dental check & cleaning' }))
    expect(note).toHaveValue('Vaccination booster; Dental check & cleaning')
    await user.click(screen.getByRole('button', { name: 'Register Visit' }))
    expect(await screen.findByText('3 records')).toBeInTheDocument()
    expect(db.visits.at(-1)?.description).toBe('Vaccination booster; Dental check & cleaning')
  })

  it('requires a description', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    await user.click(screen.getByRole('button', { name: 'Register Visit' }))
    expect(await screen.findByText('Describe the reason for the visit')).toBeInTheDocument()
    expect(db.visits).toHaveLength(4)
  })

  it('keeps what was typed and shows the error when the server fails', async () => {
    server.use(http.post(`${BASE}/owners/6/pets/8/visits`, () => new HttpResponse(null, { status: 500 })))
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    await user.type(screen.getByLabelText('Reason / clinical note'), 'checkup')
    await user.click(screen.getByRole('button', { name: 'Register Visit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The clinic server had a problem')
    expect(screen.getByLabelText('Reason / clinical note')).toHaveValue('checkup')
    expect(screen.queryByText('Visit registered')).not.toBeInTheDocument()
  })
})

describe('adding a pet to an existing owner', () => {
  it('opens the form inline above the pet list, creates the pet and opens it', async () => {
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('button', { name: 'Add Pet' }))

    const form = within(await screen.findByRole('form', { name: 'New pet' }))
    await user.type(form.getByLabelText('Pet name'), 'Pixel')
    await user.type(form.getByLabelText('Birth date'), '2022-03-04')
    await user.selectOptions(await form.findByLabelText('Species'), 'Dog')
    await user.click(form.getByRole('button', { name: 'Save Pet' }))

    expect(await screen.findByRole('heading', { name: 'Pixel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Pets/ })).toHaveTextContent('2')
    expect(screen.queryByRole('form', { name: 'New pet' })).not.toBeInTheDocument()
    expect(db.pets.at(-1)).toMatchObject({ name: 'Pixel', ownerId: 1, typeId: 2, birthDate: '2022-03-04' })
    // the owner's lookup row now lists the new pet too
    expect(await within(await lookupList()).findByText('Leo (Cat), Pixel (Dog)')).toBeInTheDocument()
  })

  it('blocks a birth date in the future without calling the API', async () => {
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('button', { name: 'Add Pet' }))
    const form = within(await screen.findByRole('form', { name: 'New pet' }))
    await user.type(form.getByLabelText('Pet name'), 'Future')
    await user.type(form.getByLabelText('Birth date'), '2999-01-01')
    await user.selectOptions(await form.findByLabelText('Species'), 'Cat')
    await user.click(form.getByRole('button', { name: 'Save Pet' }))
    expect(await form.findByText('Birth date cannot be in the future')).toBeInTheDocument()
    expect(db.pets).toHaveLength(5)
  })

  it('can be cancelled without saving', async () => {
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('button', { name: 'Add Pet' }))
    await user.click(within(await screen.findByRole('form', { name: 'New pet' })).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'New pet' })).not.toBeInTheDocument()
    expect(db.pets).toHaveLength(5)
  })

  it('tells the user when species cannot be loaded, and lets them retry', async () => {
    server.use(http.get(`${BASE}/pettypes`, () => new HttpResponse(null, { status: 500 }), { once: true }))
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('button', { name: 'Add Pet' }))
    expect(await screen.findByText('Could not load the list of pet types.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('option', { name: 'Dog' })).toBeInTheDocument()
  })

  it('offers "Register First Pet" for an owner without pets', async () => {
    db.owners.push({ id: 9, firstName: 'Una', lastName: 'Solo', address: '1 Pine', city: 'Monona', telephone: '6085550177' })
    const user = setup('/owners/9')
    await user.click(await screen.findByRole('button', { name: 'Register First Pet' }))
    expect(await screen.findByRole('form', { name: 'New pet' })).toBeInTheDocument()
  })
})

describe('editing', () => {
  it('edits the owner in place and updates both the panel and the lookup list', async () => {
    const user = setup()
    await openOwner(user, 'Frank', /George Franklin/)
    await user.click(await screen.findByRole('button', { name: 'Edit Owner' }))

    const form = within(screen.getByRole('form', { name: 'Edit owner' }))
    const phone = form.getByLabelText('Telephone (10 digits)')
    await user.clear(phone)
    await user.type(phone, '608-555-9999')
    await user.click(form.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByRole('link', { name: '(608) 555-9999' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Edit owner' })).not.toBeInTheDocument()
    expect(db.owners[0]?.telephone).toBe('6085559999')
    expect(await within(await lookupList()).findByText(/\(608\) 555-9999/)).toBeInTheDocument()
  })

  it('can cancel an edit without saving', async () => {
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('button', { name: 'Edit Owner' }))
    await user.type(screen.getByLabelText('City'), 'XYZ')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('110 W. Liberty St. · Madison')).toBeInTheDocument()
    expect(db.owners[0]?.city).toBe('Madison')
  })

  it('edits a pet and keeps the lookup rows (which list pet names) in sync', async () => {
    const user = setup('/owners/1/pets/1')
    const rows = await lookupList()
    expect(await within(rows).findByText('Leo (Cat)')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Edit Pet' }))
    const form = within(screen.getByRole('form', { name: 'Edit pet' }))
    const name = form.getByLabelText('Pet name')
    await user.clear(name)
    await user.type(name, 'Leonidas')
    await user.click(form.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByRole('heading', { name: 'Leonidas' })).toBeInTheDocument()
    expect(db.pets[0]?.name).toBe('Leonidas')
    expect(await within(rows).findByText('Leonidas (Cat)')).toBeInTheDocument()
    expect((await ownerPanel()).getByRole('link', { name: /Leonidas/ })).toBeInTheDocument()
  })

  it('pre-selects the current species when editing a pet', async () => {
    const user = setup('/owners/6/pets/8')
    await user.click(await screen.findByRole('button', { name: 'Edit Pet' }))
    expect(await screen.findByLabelText('Species')).toHaveValue('1')
  })
})

describe('All Owners', () => {
  it('lists the whole directory with phone, address, pets and visit counts', async () => {
    const user = setup()
    await user.click(screen.getByRole('link', { name: 'All Owners' }))
    expect(await screen.findByRole('heading', { name: 'All Clinic Owners' })).toBeInTheDocument()
    expect(screen.getByText(/4 registered owners/)).toBeInTheDocument()

    const jean = (await screen.findByRole('link', { name: 'Jean Coleman' })).closest('tr')!
    expect(within(jean).getByText('(608) 555-2654')).toBeInTheDocument()
    expect(within(jean).getByText('105 N. Lake St.')).toBeInTheDocument()
    expect(within(jean).getByText('Samantha (Cat), Max (Cat)')).toBeInTheDocument()
    expect(within(jean).getByText('4')).toBeInTheDocument() // visits across both pets
    expect(screen.getByRole('link', { name: 'All Owners' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens any row in the Front Desk with that owner selected', async () => {
    const user = setup('/owners')
    const row = (await screen.findByRole('link', { name: 'Betty Davis' })).closest('tr')!
    await user.click(within(row).getByText('638 Cardinal Ave.')) // anywhere on the row
    expect(await screen.findByRole('heading', { name: 'Betty Davis', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Front Desk' })).toHaveAttribute('aria-current', 'page')
    expect(await lookupList()).toBeInTheDocument()
  })

  it('searches the directory, and offers to create someone who is not in it', async () => {
    const user = setup('/owners')
    await screen.findByRole('link', { name: 'Jean Coleman' })
    await user.type(screen.getByRole('searchbox', { name: 'Search directory' }), 'davis')
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + two Davises
    await user.clear(screen.getByRole('searchbox', { name: 'Search directory' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search directory' }), 'nobody')
    await user.click(await screen.findByRole('button', { name: 'Create “nobody”' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect((await drawer()).getByLabelText('Last name')).toHaveValue('Nobody')
  })
})

describe("Today's Visits", () => {
  const visitToday = (description: string, petId = 8) =>
    db.visits.push({ id: 90 + db.visits.length, petId, date: todayIso(), description })

  it('says so when nothing was registered today, and offers the Front Desk', async () => {
    setup('/visits')
    expect(await screen.findByText('No visits registered today.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today (0)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Go to Front Desk' })).toBeInTheDocument()
  })

  it("lists today's visits with pet, owner, phone and note, and opens the pet in the Front Desk", async () => {
    visitToday('limping evaluation')
    const user = setup('/visits')
    const row = (await screen.findByText('limping evaluation')).closest('tr')!
    expect(within(row).getByText('Max')).toBeInTheDocument()
    expect(within(row).getByText('Jean Coleman')).toBeInTheDocument()
    expect(within(row).getByText('(608) 555-2654')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today (1)' })).toBeInTheDocument()

    await user.click(row)
    expect(await screen.findByRole('heading', { name: 'Max' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jean Coleman' })).toBeInTheDocument()
  })

  it('switches to all history and filters by pet, owner, note or phone', async () => {
    visitToday('limping evaluation')
    const user = setup('/visits')
    await screen.findByText('limping evaluation')
    await user.click(screen.getByRole('button', { name: 'All History (5)' }))
    expect(screen.getAllByRole('row')).toHaveLength(6)

    await user.type(screen.getByRole('searchbox', { name: 'Filter visits' }), 'neutered')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    await user.clear(screen.getByRole('searchbox', { name: 'Filter visits' }))
    await user.type(screen.getByRole('searchbox', { name: 'Filter visits' }), 'nothing like this')
    expect(await screen.findByText('No visits match that filter.')).toBeInTheDocument()
  })

  it('shows a visit registered at the Front Desk straight away, without a reload', async () => {
    const user = setup('/owners/1/pets/1')
    await user.type(await screen.findByLabelText('Reason / clinical note'), 'first visit ever')
    await user.click(screen.getByRole('button', { name: 'Register Visit' }))
    await screen.findByText('Visit registered')

    await user.click(screen.getByRole('link', { name: "Today's Visits" }))
    const row = (await screen.findByText('first visit ever')).closest('tr')!
    expect(within(row).getByText('Leo')).toBeInTheDocument()
    expect(within(row).getByText('George Franklin')).toBeInTheDocument()
  })
})

describe('failure handling', () => {
  it('shows a retryable error when the owner list cannot be loaded', async () => {
    server.use(http.get(`${BASE}/v2/owners`, () => HttpResponse.error(), { once: true }))
    const user = setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the clinic server/i)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await lookupList()).toBeInTheDocument()
  })

  it('keeps the last-known owner on screen with a warning when a refresh fails', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    server.use(http.get(`${BASE}/owners/6`, () => HttpResponse.error()))
    await user.type(screen.getByLabelText('Reason / clinical note'), 'x')
    await user.click(screen.getByRole('button', { name: 'Register Visit' }))
    expect(await screen.findByText(/Could not refresh this owner/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jean Coleman' })).toBeInTheDocument()
    expect(db.visits.some((v) => v.description === 'x')).toBe(true) // the write itself succeeded
  })

  it('picks up owners added elsewhere when the tab becomes visible again', async () => {
    setup()
    await lookupList()
    db.owners.push({ id: 50, firstName: 'Elsewhere', lastName: 'Added', address: 'a', city: 'c', telephone: '6085550150' })
    useDirectoryStore.setState({ loadedAt: 0 }) // pretend the list is old
    document.dispatchEvent(new Event('visibilitychange'))
    expect(await within(await lookupList()).findByRole('link', { name: /Elsewhere Added/ })).toBeInTheDocument()
  })
})
