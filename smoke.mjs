// Throwaway visual smoke test: render every screen with a tiny DOM shim so a
// runtime error in the restyled UI shows up here instead of in the browser.
const listeners = {}
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker: undefined }, configurable: true })
globalThis.window = globalThis
globalThis.addEventListener = (t, f) => { (listeners[t] = listeners[t] || []).push(f) }
globalThis.removeEventListener = () => {}
globalThis.scrollTo = () => {}
globalThis.confirm = () => true
globalThis.alert = () => {}
globalThis.location = { reload: () => {} }
globalThis.matchMedia = () => ({ matches: false, addEventListener: () => {} })
globalThis.history = { pushState() {}, back() {} }

const fakeEl = (dataset = {}) => ({
  dataset,
  tagName: 'BUTTON',
  innerHTML: '',
  hidden: false,
  textContent: '',
  value: '',
  style: {},
  files: [],
  classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
  addEventListener() {},
  hasChildNodes: () => false,
  closest(sel) {
    const attr = String(sel).match(/\[data-([a-z-]+)\]/)
    if (attr) return this.dataset[attr[1]] !== undefined ? this : null
    return this
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  click() {}
})
const appEl = Object.assign(fakeEl(), { hasChildNodes: () => false })
globalThis.FormData = class {
  constructor(source) {
    this._m = new Map()
    if (source && source._fields) source._fields.forEach((v, k) => this._m.set(k, String(v)))
  }
  set(k, v) { this._m.set(String(k), String(v)) }
  get(k) { return this._m.has(String(k)) ? this._m.get(String(k)) : null }
  getAll(k) { return this._m.has(String(k)) ? [this._m.get(String(k))] : [] }
}
globalThis.document = {
  getElementById: (id) => (id === 'app' ? appEl : fakeEl()),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => fakeEl(),
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f) },
  body: fakeEl(),
  documentElement: fakeEl()
}

await import('./app.js')
const { store } = await import('./store.js')

const click = (dataset) => listeners.click.forEach((fn) => fn({ target: fakeEl(dataset), preventDefault() {} }))
const show = (label) => {
  const html = appEl.innerHTML
  const bad = /undefined|NaN|\[object/.test(html)
  console.log(`${bad ? '!!! ' : ''}${label}: ${html.length} chars`)
  return html
}

// Seed a little data so every section has something to draw.
store.setRate('$', 48.5)
store.addIncome({ name: 'Salary', amount: 5000, date: store.todayISO(), time: '00:01', walletId: store.getWallets()[0].id, sourceId: store.getSources()[0].id })
store.addExpense({ name: 'Groceries', amount: 320, date: store.todayISO(), time: '00:02', walletId: store.getWallets()[0].id, categoryId: store.getCategories()[0].id })
store.addGoal({ name: 'New Laptop', limit: 1500, walletId: '', categoryId: '', strict: true })
// Clicking the current tab forces a fresh render with the seeded data.
click({ screen: 'home' })

const home = show('home after re-render')
console.log('  tiles:', (home.match(/class="tile /g) || []).length, '| ring:', /class="ring"/.test(home))
console.log('  ring value:', /style="--p:([^"]+)"/.exec(home)?.[1])
console.log('  wallet row tile:', /class="avatar [^"]*" style="background:rgba/.test(home))
console.log('--- hero markup ---')
console.log(/<section class="hero">[\s\S]*?<\/section>/.exec(home)[0].slice(0, 1400))

click({ screen: 'wallets' })
const wallets = show('wallets')
console.log('  wallet cards:', (wallets.match(/class="wallet-card"/g) || []).length)
console.log('  wallet tiles:', (wallets.match(/class="wallet-tile"/g) || []).length)
console.log('  first card:', /<article class="wallet-card" style="([^"]+)"/.exec(wallets)?.[1])
console.log('--- wallet card markup ---')
console.log(/<article class="wallet-card"[\s\S]*?<\/article>/.exec(wallets)[0])
console.log('--- budget row markup ---')
const budgetHtml = show('budgets')
console.log('(checked above)')

click({ action: 'open-wallet', id: store.getWallets()[0].id })
show('wallet detail')
click({ action: 'wallet-back' })
click({ screen: 'wallets' })
click({ screen: 'wallets' })
show('wallets again')

click({ screen: 'activity' }); const activity = show('activity')
console.log('  tinted avatars:', (activity.match(/class="avatar (income|expense|transfer)"/g) || []).length)

click({ screen: 'budgets' }); const budgets = show('budgets')
console.log('  cat tiles:', (budgets.match(/class="cat-tile"/g) || []).length)
console.log('  budget pct:', (budgets.match(/class="pcc?/g) || []).length, (budgets.match(/class="pct[^"]*"/g) || []).length)

click({ screen: 'more' }); const settings = show('more/settings')
console.log('  settings rows:', (settings.match(/class="budget-row settings-row"/g) || []).length)
console.log('  settings icons:', (settings.match(/class="settings-ico"/g) || []).length)
console.log('  rate rows:', (settings.match(/data-rate="/g) || []).length)
console.log('  chevrons:', (settings.match(/stroke-width="2.2"/g) || []).length)
click({ action: 'open-add' }); const choose = show('choose sheet')
console.log('  choose avatars:', (choose.match(/class="avatar [a-z]+"/g) || []).join(' '))

click({ screen: 'home' })
const homeAgain = show('home')
const at = homeAgain.indexOf('<div class="budget-row">')
console.log('--- budget row markup ---')
console.log('found at', at)
console.log(at >= 0 ? homeAgain.slice(at, at + 620) : 'NOT FOUND')

click({ action: 'close-modal' })
click({ action: 'new-wallet' }); const form = show('wallet form')
console.log('  hint:', /id="wallet-foreign-hint"[^>]*>([^<]*)/.exec(form)?.[1])

// Both themes must render.
store.setTheme('light')
click({ screen: 'home' }); show('home (light)')
click({ screen: 'wallets' }); show('wallets (light)')
click({ screen: 'budgets' }); show('budgets (light)')
store.setTheme('dark')
console.log('all screens rendered')
