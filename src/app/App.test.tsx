import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'
import { todayIso } from '@/domain/dates'
import { BASE, db } from '@/test/fakeBackend'
import { server } from '@/test/server'
import { App } from './App'

/**
 * Whole-application tests: real components, real routing, real stores, real
 * HTTP client; only the network edge is faked (MSW). Each test is a receptionist
 * task from the assignment.
 */

function setup(path = '/') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  return user
}

const searchBox = () => screen.getByRole('searchbox', { name: /find owner/i })

// Search rows also list pet names, so pet links must be looked up inside the Pets card.
const petsCard = async () => (await screen.findByRole('heading', { name: /^Pets \(\d+\)$/ })).closest('section')!
const petLink = async (name: RegExp) => within(await petsCard()).findByRole('link', { name })

async function openOwner(user: ReturnType<typeof userEvent.setup>, lastName: string, link: RegExp) {
  await user.type(searchBox(), lastName)
  await user.click(await screen.findByRole('link', { name: link }))
}

describe('finding an owner and reading their records', () => {
  it('lists owners on load, filters as you type, and opens an owner with their pets', async () => {
    const user = setup()
    const list = await screen.findByRole('list', { name: 'Owners' })
    expect(within(list).getAllByRole('link')).toHaveLength(4)

    await user.type(searchBox(), 'cole')
    await screen.findByText(/1 owner starting with “cole”/)
    await user.click(await screen.findByRole('link', { name: /Coleman, Jean/ }))

    expect(await screen.findByRole('heading', { name: 'Jean Coleman' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '6085552654' })).toBeInTheDocument()
    expect(screen.getByText('105 N. Lake St.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pets (2)' })).toBeInTheDocument()
    expect(await petLink(/Samantha/)).toBeInTheDocument()
    expect(await petLink(/Max/)).toBeInTheDocument()
    // the search pane is still there: no navigation away from the working context
    expect(searchBox()).toHaveValue('cole')
  })

  it('opens the first result with Enter', async () => {
    const user = setup()
    await screen.findByRole('list', { name: 'Owners' })
    await user.type(searchBox(), 'Davis')
    await screen.findByText(/2 owners starting with “Davis”/)
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Betty Davis' })).toBeInTheDocument()
  })

  it('opens a pet and shows its details and previous visits, newest first', async () => {
    const user = setup('/owners/6')
    await user.click(await petLink(/Max/))

    expect(await screen.findByRole('heading', { name: 'Max' })).toBeInTheDocument()
    const history = screen.getByRole('heading', { name: 'Visit history (2)' }).closest('section')!
    const rows = within(history).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('3 Jan 2013')
    expect(rows[0]).toHaveTextContent('neutered')
    expect(rows[1]).toHaveTextContent('rabies shot')
  })

  it('says so when a pet has no visits', async () => {
    const user = setup('/owners/1')
    await user.click(await petLink(/Leo/))
    expect(await screen.findByText('No previous visits.')).toBeInTheDocument()
  })

  it('deep links work: a pet URL loads owner and pet directly', async () => {
    setup('/owners/6/pets/8')
    expect(await screen.findByRole('heading', { name: 'Max' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jean Coleman' })).toBeInTheDocument()
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
})

describe('creating an owner when the customer does not exist yet', () => {
  it('offers to create from a failed search, prefilled, and lands on the new owner', async () => {
    const user = setup()
    await screen.findByRole('list', { name: 'Owners' })
    await user.type(searchBox(), 'smith')
    await user.click(await screen.findByRole('button', { name: /create owner “Smith”/i }))

    const form = await screen.findByRole('form', { name: 'New owner' })
    expect(within(form).getByLabelText('Last name')).toHaveValue('Smith')

    await user.type(within(form).getByLabelText('First name'), 'Sam')
    await user.type(within(form).getByLabelText('Address'), '5 Elm St')
    await user.type(within(form).getByLabelText('City'), 'Madison')
    await user.type(within(form).getByLabelText('Phone'), '(608) 555-0101')
    await user.click(within(form).getByRole('button', { name: 'Create owner' }))

    expect(await screen.findByRole('heading', { name: 'Sam Smith' })).toBeInTheDocument()
    expect(screen.getByText('No pets registered yet.')).toBeInTheDocument()
    expect(db.owners.at(-1)).toMatchObject({ firstName: 'Sam', lastName: 'Smith', telephone: '6085550101' })
    expect(screen.getByText('Owner Sam Smith created')).toBeInTheDocument()
  })

  it('validates on the client before calling the API', async () => {
    const user = setup('/owners/new')
    const before = db.owners.length
    await user.click(await screen.findByRole('button', { name: 'Create owner' }))
    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Phone number is required')).toBeInTheDocument()
    expect(db.owners).toHaveLength(before)
  })

  it('blocks a phone number that is not exactly 10 digits (the server would answer 500)', async () => {
    const user = setup('/owners/new')
    await user.type(await screen.findByLabelText('First name'), 'Sam')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Address'), '5 Elm St')
    await user.type(screen.getByLabelText('City'), 'Madison')
    await user.type(screen.getByLabelText('Phone'), '12345')
    const before = db.owners.length
    await user.click(screen.getByRole('button', { name: 'Create owner' }))
    expect(await screen.findByText(/exactly 10 digits/)).toBeInTheDocument()
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
    const user = setup('/owners/new')
    await user.type(await screen.findByLabelText('First name'), 'Sam')
    await user.type(screen.getByLabelText('Last name'), 'Smith')
    await user.type(screen.getByLabelText('Address'), '5 Elm St')
    await user.type(screen.getByLabelText('City'), 'Madison')
    await user.type(screen.getByLabelText('Phone'), '6085550101')
    await user.click(screen.getByRole('button', { name: 'Create owner' }))
    expect(await screen.findByText('already in use')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('registering a visit', () => {
  it('adds the visit to the history and leaves the form ready for the next one', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    const form = screen.getByRole('form', { name: 'Register visit' })
    expect(within(form).getByLabelText('Visit date')).toHaveValue(todayIso())

    await user.type(within(form).getByLabelText('Reason / notes'), 'annual vaccination')
    await user.click(within(form).getByRole('button', { name: 'Register visit' }))

    const history = (await screen.findByRole('heading', { name: 'Visit history (3)' })).closest('section')!
    expect(within(history).getAllByRole('listitem')[0]).toHaveTextContent('annual vaccination')
    expect(db.visits.at(-1)).toMatchObject({ petId: 8, description: 'annual vaccination', date: todayIso() })
    expect(within(form).getByLabelText('Reason / notes')).toHaveValue('')
    expect(within(form).getByLabelText('Reason / notes')).toHaveFocus()
    expect(screen.getByText('Visit registered for Max')).toBeInTheDocument()
  })

  it('requires a description', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    await user.click(screen.getByRole('button', { name: 'Register visit' }))
    expect(await screen.findByText('Describe the reason for the visit')).toBeInTheDocument()
    expect(db.visits).toHaveLength(4)
  })

  it('keeps what was typed and shows the error when the server fails', async () => {
    server.use(http.post(`${BASE}/owners/6/pets/8/visits`, () => new HttpResponse(null, { status: 500 })))
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    await user.type(screen.getByLabelText('Reason / notes'), 'checkup')
    await user.click(screen.getByRole('button', { name: 'Register visit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The clinic server had a problem')
    expect(screen.getByLabelText('Reason / notes')).toHaveValue('checkup')
  })
})

describe('adding a pet to an existing owner', () => {
  it('creates the pet and opens it', async () => {
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('link', { name: '+ Add pet' }))

    const form = await screen.findByRole('form', { name: 'New pet' })
    await user.type(within(form).getByLabelText('Pet name'), 'Pixel')
    await user.type(within(form).getByLabelText('Birth date'), '2022-03-04')
    await user.selectOptions(await within(form).findByLabelText('Type'), 'dog')
    await user.click(within(form).getByRole('button', { name: 'Add pet' }))

    expect(await screen.findByRole('heading', { name: 'Pixel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pets (2)' })).toBeInTheDocument()
    expect(db.pets.at(-1)).toMatchObject({ name: 'Pixel', ownerId: 1, typeId: 2, birthDate: '2022-03-04' })
    // the owner's search row now lists the new pet too
    expect(await within(screen.getByRole('list', { name: 'Owners' })).findByText('Pets: Leo, Pixel')).toBeInTheDocument()
  })

  it('blocks a birth date in the future without calling the API', async () => {
    const user = setup('/owners/1/pets/new')
    const form = await screen.findByRole('form', { name: 'New pet' })
    await user.type(within(form).getByLabelText('Pet name'), 'Future')
    await user.type(within(form).getByLabelText('Birth date'), '2999-01-01')
    await user.selectOptions(await within(form).findByLabelText('Type'), 'cat')
    await user.click(within(form).getByRole('button', { name: 'Add pet' }))
    expect(await within(form).findByText('Birth date cannot be in the future')).toBeInTheDocument()
    expect(db.pets).toHaveLength(5)
  })

  it('tells the user when pet types cannot be loaded, and lets them retry', async () => {
    server.use(http.get(`${BASE}/pettypes`, () => new HttpResponse(null, { status: 500 }), { once: true }))
    const user = setup('/owners/1/pets/new')
    expect(await screen.findByText('Could not load the list of pet types.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('option', { name: 'dog' })).toBeInTheDocument()
  })
})

describe('editing', () => {
  it('edits the owner in place and updates both the panel and the search results', async () => {
    const user = setup()
    await openOwner(user, 'Frank', /Franklin, George/)
    await user.click(await screen.findByRole('button', { name: 'Edit owner' }))

    const form = screen.getByRole('form', { name: 'Edit owner' })
    const phone = within(form).getByLabelText('Phone')
    await user.clear(phone)
    await user.type(phone, '608-555-9999')
    await user.click(within(form).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('link', { name: '6085559999' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Edit owner' })).not.toBeInTheDocument()
    expect(db.owners[0]?.telephone).toBe('6085559999')
    // the left-hand search list reflects it too
    expect(await within(screen.getByRole('list', { name: 'Owners' })).findByText(/6085559999/)).toBeInTheDocument()
  })

  it('can cancel an edit without saving', async () => {
    const user = setup('/owners/1')
    await user.click(await screen.findByRole('button', { name: 'Edit owner' }))
    await user.type(screen.getByLabelText('City'), 'XYZ')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Madison')).toBeInTheDocument()
    expect(db.owners[0]?.city).toBe('Madison')
  })

  it('edits a pet', async () => {
    const user = setup('/owners/1/pets/1')
    await user.click(await screen.findByRole('button', { name: 'Edit pet' }))
    const form = screen.getByRole('form', { name: 'Edit pet' })
    const name = within(form).getByLabelText('Pet name')
    await user.clear(name)
    await user.type(name, 'Leonidas')
    await user.click(within(form).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('heading', { name: 'Leonidas' })).toBeInTheDocument()
    expect(db.pets[0]?.name).toBe('Leonidas')
    // the pet list on the left of the pet pane updates as well
    expect(await petLink(/Leonidas/)).toBeInTheDocument()
  })

  it('keeps the search rows (which list pet names) in sync when a pet is renamed', async () => {
    const user = setup('/owners/1/pets/1')
    const rows = await screen.findByRole('list', { name: 'Owners' })
    expect(await within(rows).findByText('Pets: Leo')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Edit pet' }))
    const name = screen.getByLabelText('Pet name')
    await user.clear(name)
    await user.type(name, 'Leonidas')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await within(rows).findByText('Pets: Leonidas')).toBeInTheDocument()
  })

  it('pre-selects the current type when editing a pet', async () => {
    setup('/owners/6/pets/8')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit pet' }))
    expect(await screen.findByLabelText('Type')).toHaveValue('1')
  })
})

describe('failure handling', () => {
  it('shows a retryable error when search fails', async () => {
    server.use(http.get(`${BASE}/v2/owners`, () => HttpResponse.error(), { once: true }))
    const user = setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the clinic server/i)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('list', { name: 'Owners' })).toBeInTheDocument()
  })

  it('keeps the last-known owner on screen with a warning when a refresh fails', async () => {
    const user = setup('/owners/6/pets/8')
    await screen.findByRole('heading', { name: 'Max' })
    server.use(http.get(`${BASE}/owners/6`, () => HttpResponse.error()))
    await user.type(screen.getByLabelText('Reason / notes'), 'x')
    await user.click(screen.getByRole('button', { name: 'Register visit' }))
    expect(await screen.findByText(/Could not refresh this owner/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jean Coleman' })).toBeInTheDocument()
    expect(db.visits.some((v) => v.description === 'x')).toBe(true) // the write itself succeeded
  })
})
