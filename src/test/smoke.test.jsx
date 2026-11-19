import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { AppProvider } from '../context/AppProvider'
import { db } from '../db/db'
import { seedDemoData } from '../db/seed'
import { assessVitals } from '../lib/triage'
import { buildCarePlan } from '../lib/careplan'
import { addDays, todayISO } from '../lib/dates'

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  )
}

async function bootToRegister() {
  renderApp()
  await screen.findByRole('heading', { name: /triage & patient register/i }, { timeout: 20000 })
  await screen.findByText('Amina Mwende', {}, { timeout: 20000 })
}

async function goTab(user, label, heading) {
  const nav = screen.getAllByRole('button', { name: label })
  await user.click(nav[nav.length - 1])
  await screen.findByRole('heading', { name: heading }, { timeout: 15000 })
}

describe('AfyaPulse smoke', () => {
  beforeEach(async () => {
    await db.open()
    const seeded = await db.prefs.get('seeded')
    if (!seeded?.value) await seedDemoData({ reset: false })
  })

  it('boots, seeds the demo clinic and renders the triage register', async () => {
    await bootToRegister()
    expect(screen.getByText('Active register')).toBeInTheDocument()
    expect(screen.getByText('Urgent red flags')).toBeInTheDocument()
    expect(screen.getAllByText('Joseph Mutuma').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Urgent Referral/i).length).toBeGreaterThan(0)
  })

  it('registers a new patient offline and generates follow-ups', async () => {
    const user = userEvent.setup()
    await bootToRegister()
    const before = await db.patients.count()

    await user.click(screen.getAllByRole('button', { name: 'Register patient' })[0])
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/first name/i), 'Wanjiku')
    await user.type(within(dialog).getByLabelText(/surname/i), 'Njeri')
    await user.type(within(dialog).getByLabelText(/years/i), '2')
    await user.type(within(dialog).getByLabelText(/ward \/ site/i), 'Nkubu')
    await user.click(within(dialog).getByRole('button', { name: /under-5/i }))
    await user.click(within(dialog).getByRole('button', { name: /register & triage/i }))

    await waitFor(async () => {
      expect(await db.patients.count()).toBe(before + 1)
    })
    const created = await db.patients.orderBy('id').last()
    expect(created.firstName).toBe('Wanjiku')
    expect(created.code).toMatch(/^AFY-\d{4}-\d{4}$/)
    const plan = await db.schedules.where('patientId').equals(created.id).toArray()
    expect(plan.length).toBeGreaterThan(0)
  })

  it('switches to the CHP role and hides privileged actions', async () => {
    const user = userEvent.setup()
    await bootToRegister()
    await goTab(user, 'Settings', /clinic settings/i)

    const chpButton = screen.getByText('Community Health Promoter').closest('button')
    expect(chpButton).toBeTruthy()
    await user.click(chpButton)
    await waitFor(async () => {
      expect((await db.prefs.get('role'))?.value).toBe('chp')
    })

    await goTab(user, 'Triage', /triage & patient register/i)

    const epiButton = screen.getByRole('button', { name: /epi export/i })
    expect(epiButton).toHaveAttribute('aria-disabled', 'true')

    // Open a patient card: privileged management actions must be absent.
    await screen.findByText('Amina Mwende', {}, { timeout: 15000 })
    const cards = screen.getAllByRole('button', { expanded: false })
    expect(cards.length).toBeGreaterThan(0)
    await user.click(cards[0])
    await screen.findByText('Record vitals', {}, { timeout: 10000 })
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    expect(screen.queryByText('Edit record')).not.toBeInTheDocument()
  })

  it('renders all four workspaces without crashing', async () => {
    const user = userEvent.setup()
    await bootToRegister()
    for (const [tab, heading] of [
      ['Schedules', /follow-up & immunisation/i],
      ['Pharmacy', /pharmacy & cold chain/i],
      ['Settings', /clinic settings/i],
      ['Triage', /triage & patient register/i],
    ]) {
      await goTab(user, tab, heading)
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })
})

describe('clinical engines', () => {
  it('escalates a hypertensive crisis to urgent referral', () => {
    const result = assessVitals({ systolic: 186, diastolic: 112, pulse: 92, temperature: 36.9 }, { ageYears: 41 })
    expect(result.level).toBe('urgent')
    expect(result.flags.some((flag) => /hypertensive crisis/i.test(flag.label))).toBe(true)
  })

  it('stays normal for a healthy adult', () => {
    const result = assessVitals(
      { systolic: 118, diastolic: 76, pulse: 72, temperature: 36.6, spo2: 99, respRate: 16 },
      { ageYears: 30 },
    )
    expect(result.level).toBe('normal')
  })

  it('uses under-five MUAC thresholds and danger signs', () => {
    const sam = assessVitals({ muac: 11.2, temperature: 39.9 }, { ageYears: 3, ageMonths: 2 })
    expect(sam.level).toBe('urgent')
    expect(sam.flags.some((flag) => /malnutrition/i.test(flag.label))).toBe(true)

    const danger = assessVitals({ dangerSigns: ['convulsions'] }, { ageYears: 1 })
    expect(danger.level).toBe('urgent')
  })

  it('generates an EPI schedule for a newborn and ANC contacts for pregnancy', () => {
    const epi = buildCarePlan({ id: 1, category: 'child', ageYears: 0, ageMonths: 2, birthDate: addDays(todayISO(), -61) })
    expect(epi.length).toBeGreaterThan(0)
    expect(epi.some((row) => /6-week/i.test(row.title))).toBe(true)

    const anc = buildCarePlan({ id: 2, category: 'anc', edd: addDays(todayISO(), 90) })
    expect(anc.length).toBeGreaterThan(0)
    expect(anc[0].type).toBe('anc')
  })
})
