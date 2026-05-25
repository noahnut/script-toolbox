// Smoke tests: verify the app shell renders correctly on launch.

describe('App launch', () => {
  it('renders the sidebar', async () => {
    const sidebar = await $('[style*="width: 260px"], [style*="width:260px"]')
    await sidebar.waitForExist({ timeout: 10000 })
    expect(await sidebar.isDisplayed()).toBe(true)
  })

  it('shows the search input', async () => {
    const input = await $('input[placeholder="Search scripts..."]')
    await input.waitForExist({ timeout: 5000 })
    expect(await input.isDisplayed()).toBe(true)
  })

  it('shows the All Scripts entry', async () => {
    const allScripts = await $('*=All Scripts')
    await allScripts.waitForExist({ timeout: 5000 })
    expect(await allScripts.isDisplayed()).toBe(true)
  })

  it('shows the three action buttons', async () => {
    const buttons = await $$('button')
    const labels = await Promise.all(buttons.map((b) => b.getText()))
    expect(labels.some((l) => l.includes('Script'))).toBe(true)
    expect(labels.some((l) => l.includes('Folder'))).toBe(true)
    expect(labels.some((l) => l.includes('Group'))).toBe(true)
  })

  it('shows the empty state when no script is selected', async () => {
    const empty = await $('*=Select a script to get started')
    await empty.waitForExist({ timeout: 5000 })
    expect(await empty.isDisplayed()).toBe(true)
  })
})

describe('Search', () => {
  it('typing into search updates the input value', async () => {
    const input = await $('input[placeholder="Search scripts..."]')
    await input.setValue('hello')
    expect(await input.getValue()).toBe('hello')
    await input.clearValue()
  })
})
