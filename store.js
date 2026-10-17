// Personal Cash Flow — data layer.
// Everything lives in localStorage, so the app works fully offline.

const STORAGE_KEY = 'personal-cash-flow-v1'

export const WALLET_TYPES = ['In Hand', 'Digital Wallet', 'Safe']
export const WALLET_STATUS = ['Available', 'Freezed']
export const WALLET_CURRENCY = ['', '$', 'E£', 'EGP', '€', 'SAR', 'AED']
// Glyphs a wallet's tile can show. The names map to SVGs in app.js.
export const WALLET_ICONS = ['wallet', 'cash', 'card', 'bank', 'safe', 'phone', 'piggy', 'gem']
// Glyphs a category's tile can show. The names map to SVGs in app.js. A
// category with no icon falls back to the first letter of its name.
export const CATEGORY_ICONS = [
  'tag', 'cart', 'food', 'coffee', 'car', 'bus', 'home', 'bolt', 'tv',
  'music', 'dumbbell', 'health', 'pill', 'book', 'shirt', 'gift', 'plane',
  'piggy', 'coins', 'pet', 'baby', 'wifi', 'phone', 'game', 'repeat',
  'more', 'handcoin'
]
// Colours offered when picking a wallet's tile colour. Muted to match the UI
// gallery palette so tiles sit naturally on the near-black green surfaces.
export const WALLET_COLORS = [
  '#43cf94', '#88aeda', '#a697cc', '#d6b779', '#df817b', '#68b5a1',
  '#c7a669', '#86aaca', '#56c497', '#cf807a', '#a798c9', '#d98fb8'
]

// Currencies a wallet's second balance can be kept in. `$`/`E£`/`€`/`£` are
// shown as symbols because that is how they appear in the exports, but every
// rate is stored under the ISO code (see currencyCode) so a symbol and its code
// always match.
export const CURRENCY_CHOICES = [
  '$', 'E£', 'EGP', '€', '£', 'SAR', 'AED', 'USD', 'EUR', 'GBP',
  'KWD', 'QAR', 'OMR', 'BHD', 'JOD', 'TRY', 'MAD', 'TND', 'DZD',
  'LYD', 'SDG', 'IQD', 'LBP', 'ILS', 'CNY', 'JPY', 'INR', 'PKR',
  'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'RUB', 'BRL', 'ZAR',
  'NGN', 'KES', 'GHS', 'SGD', 'MYR', 'IDR', 'THB', 'PHP', 'KRW', 'MXN'
]

// Fallback colours for categories without a saved one, in the same muted range
// as the gallery so charts and tiles stay on-palette.
const PALETTE = [
  '#43cf94', '#88aeda', '#a697cc', '#d6b779', '#df817b', '#68b5a1',
  '#c7a669', '#86aaca', '#57c99a', '#cf807a', '#a798c9', '#d98fb8',
  '#88aeda'
]

// Seed data mirrors the Notion export this app was built from: the wallet
// list, expense categories and their monthly budgets, and income sources.
// `start` is the wallet's opening balance in the main currency, `foreign` is a
// balance held in another currency (converted with the saved rate).
const DEFAULT_WALLETS = [
  { name: 'Mini Pocket', type: 'In Hand', status: 'Available', start: 200 },
  { name: 'Cashed', type: 'In Hand', status: 'Available', start: 3110 },
  { name: 'Saved Cash', type: 'Safe', status: 'Available', start: 21000 },
  { name: 'RedToPay Virtual Card', type: 'Digital Wallet', status: 'Available', start: 0, foreign: 1.6, currency: '$' },
  { name: 'SproutGigs Wallet', type: 'Digital Wallet', status: 'Freezed', start: 0, foreign: 2.97, currency: '$' },
  { name: 'EasyPay Visa Card', type: 'Digital Wallet', status: 'Available', start: 42 },
  { name: '5amsat Wallet', type: 'Digital Wallet', status: 'Freezed', start: 0, foreign: 20, currency: '$' },
  { name: 'PayPal Wallet', type: 'Digital Wallet', status: 'Available', start: 0 },
  { name: 'Etisalat Cash', type: 'Digital Wallet', status: 'Available', start: 41.7 },
  { name: 'Vodafone Cash', type: 'Digital Wallet', status: 'Available', start: 783 },
  { name: 'AAIB Visa Card', type: 'Digital Wallet', status: 'Available', start: 1662 }
]

const DEFAULT_CATEGORIES = [
  { name: 'Other', budget: 1000, icon: 'more' },
  { name: 'Debt', budget: 500, icon: 'handcoin' },
  { name: 'Entertainment', budget: 4000, icon: 'game' },
  { name: 'Transportation', budget: 600, icon: 'bus' },
  { name: 'Bills', budget: 3000, icon: 'bolt' },
  { name: 'Subscription', budget: 1000, icon: 'repeat' },
  { name: 'Rent', budget: 1000, icon: 'home' },
  { name: 'Work Transportation', budget: 800, icon: 'car' },
  { name: 'Sport', budget: 1000, icon: 'dumbbell' },
  { name: 'Health Care', budget: 500, icon: 'health' },
  { name: 'Food & Drink', budget: 3000, icon: 'food' },
  { name: 'Gym', budget: 200, icon: 'dumbbell' },
  { name: 'Investment', budget: 5000, icon: 'piggy' }
]

const DEFAULT_SOURCES = [
  'Earned/Active Income',
  'Passive Income',
  'Business Income',
  'Side/Extra Income',
  'Government/Transfer Income',
  'Assets Selling'
]

// Names in the export carry little typos; map them onto the clean seed names
// so a re-import never creates duplicate categories.
const CATEGORY_ALIASES = {
  entertianment: 'Entertainment',
  entertainment: 'Entertainment',
  subscribtion: 'Subscription',
  subscription: 'Subscription',
  dept: 'Debt',
  debt: 'Debt',
  'work transport': 'Work Transportation',
  'work transportation': 'Work Transportation',
  health: 'Health Care',
  'health care': 'Health Care',
  food: 'Food & Drink',
  'food & drink': 'Food & Drink',
  'food and drink': 'Food & Drink'
}

// ---------- small helpers ----------

let _seq = 0
function uid(prefix) {
  _seq += 1
  return `${prefix || 'id'}_${Date.now().toString(36)}${_seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

function str(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max || 200)
}

export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function nowTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// A pending transfer only moves money when the user opts to count them.
function transferCounts(transfer) {
  return !transfer.pending || state.settings.pendingAffectsBalance === true
}

// A skipped occurrence of a recurring series is kept for the calendar but does
// not count towards balances, totals or activity.
function isActive(record) {
  return record.skipped !== true
}

// A released pending transfer counts from the day it was released — that is
// when the money actually moved — not from its original scheduled date.
function effectiveDate(record) {
  return record.releasedDate || record.date
}

function isDue(record, now = new Date()) {
  const date = effectiveDate(record)
  const today = todayISO(now)
  if (date < today) return true
  if (date > today) return false
  return String(record.time || '00:00') <= nowTime(now)
}

export function monthKey(dateISO) {
  return String(dateISO || todayISO()).slice(0, 7)
}

export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let raw = String(value == null ? '' : value).trim()
  if (!raw) return 0
  let negative = false
  if (/^\(.*\)$/.test(raw)) {
    negative = true
    raw = raw.slice(1, -1)
  }
  const cleaned = raw.replace(/[^0-9.\-]/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  return negative ? -Math.abs(n) : n
}

function isValidISO(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function two(n) {
  return String(n).padStart(2, '0')
}

export function parseDate(value) {
  const raw = str(value, 40)
  if (!raw) return ''
  if (isValidISO(raw)) return raw
  // dd/mm/yyyy (the export's short form) or d/m/yyyy.
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${two(dmy[2])}-${two(dmy[1])}`
  }
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return todayISO(parsed)
  return ''
}

// "AAIB Visa Card (AAIB%20Visa%20Card%20...md)" -> "AAIB Visa Card"
export function refName(value) {
  return str(value, 200).replace(/\s*\([^()]*\)\s*$/, '').replace(/%20/g, ' ').trim()
}

function normName(value) {
  return str(value, 120).toLowerCase()
}

// A "#rgb"-style colour, or '' when nothing usable was given.
function hexColor(color) {
  const c = str(color, 20)
  return /^#[0-9a-f]{3,8}$/i.test(c) ? c : ''
}

function clampColor(color, index) {
  return hexColor(color) || PALETTE[index % PALETTE.length]
}

// The ISO code a currency symbol or code maps to, so "$" and "USD" land on the
// same key. Returns '' when nothing usable is left (an unmappable symbol).
const CODE_BY_SYMBOL = {
  '$': 'USD',
  'US$': 'USD',
  USD: 'USD',
  'E£': 'EGP',
  EGP: 'EGP',
  '£': 'GBP',
  GBP: 'GBP',
  '€': 'EUR',
  EUR: 'EUR',
  '﷼': 'SAR',
  SAR: 'SAR',
  AED: 'AED',
  KWD: 'KWD',
  QAR: 'QAR',
  OMR: 'OMR',
  BHD: 'BHD',
  JOD: 'JOD',
  '¥': 'JPY',
  JPY: 'JPY',
  CNY: 'CNY'
}

function currencyCode(value) {
  const raw = str(value, 12)
  if (!raw) return ''
  if (CODE_BY_SYMBOL[raw]) return CODE_BY_SYMBOL[raw]
  if (CODE_BY_SYMBOL[raw.toUpperCase()]) return CODE_BY_SYMBOL[raw.toUpperCase()]
  const letters = raw.replace(/[^A-Za-z]/g, '').toUpperCase()
  return letters ? letters.slice(0, 6) : ''
}

// A wallet's second-balance currency must look like a currency. Older exports
// stuffed a dollar *amount* into this field ("?1.60"), which is not a currency
// — those strings are dropped so the amount can be entered as the second
// balance instead.
function sanitizeCurrency(value) {
  const c = str(value, 12)
  if (!c) return ''
  if (/[\d.,]/.test(c)) return ''
  return c
}

function normalizeWallet(wallet) {
  return {
    id: wallet.id || uid('w'),
    name: str(wallet.name, 60) || 'Wallet',
    type: WALLET_TYPES.includes(wallet.type) ? wallet.type : 'In Hand',
    status: WALLET_STATUS.includes(wallet.status) ? wallet.status : 'Available',
    // What the wallet began with, in the MAIN currency (`opening` is the legacy
    // name it was imported/backed up under).
    start: parseMoney(wallet.start != null ? wallet.start : wallet.opening),
    // Extra amount the owner allows themselves to use from this wallet.
    allowable: Math.max(0, parseMoney(wallet.allowable)),
    // A second balance kept in another currency, converted with the saved rate.
    foreign: parseMoney(wallet.foreign),
    currency: sanitizeCurrency(wallet.currency),
    // The wallet's own tile look. Empty means "derive it": the colour from the
    // wallet's name, the glyph from its type.
    color: hexColor(wallet.color),
    icon: WALLET_ICONS.includes(str(wallet.icon, 20)) ? str(wallet.icon, 20) : '',
    note: str(wallet.note, 200)
  }
}

function normalizeCategory(category, index) {
  return {
    id: category.id || uid('c'),
    name: str(category.name, 40) || 'Category',
    budget: Math.max(0, parseMoney(category.budget)),
    color: clampColor(category.color, index || 0),
    icon: CATEGORY_ICONS.includes(str(category.icon, 20)) ? str(category.icon, 20) : ''
  }
}

function normalizeSource(source) {
  return { id: source.id || uid('s'), name: str(source.name, 60) || 'Source' }
}

function baseRecord(rec) {
  return {
    id: rec.id || uid('t'),
    name: str(rec.name, 120) || 'Entry',
    amount: Math.abs(parseMoney(rec.amount)),
    date: isValidISO(rec.date) ? rec.date : todayISO(),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(rec.time || '')) ? rec.time : nowTime(),
    walletId: str(rec.walletId, 60),
    note: str(rec.note, 400),
    createdAt: rec.createdAt || new Date().toISOString()
  }
}

function recurringDates(fields) {
  const start = isValidISO(fields.date) ? String(fields.date) : todayISO()
  const repeat = String(fields.repeat || 'none')
  if (repeat === 'none') return [start]
  const out = []
  const begin = new Date(`${start}T00:00:00`)
  const limit = new Date(begin)
  limit.setFullYear(limit.getFullYear() + 1)
  if (repeat === 'weekly') {
    let days = Array.isArray(fields.weekDays) ? fields.weekDays.map(Number).filter((d) => d >= 0 && d <= 6) : []
    if (!days.length) days = [begin.getDay()]
    for (let d = new Date(begin); d <= limit && out.length < 104; d.setDate(d.getDate() + 1)) {
      if (days.includes(d.getDay())) out.push(todayISO(d))
    }
    return out.length ? out : [start]
  }
  if (repeat === 'monthly') {
    const dayOfMonth = Math.min(31, Math.max(1, Number(fields.monthDay) || begin.getDate()))
    for (let i = 0; i < 12; i++) {
      const months = begin.getMonth() + i
      // Clamp to the last day of shorter months (e.g. day 31 -> Feb 28/29)
      // instead of skipping those months entirely.
      const lastDay = new Date(begin.getFullYear(), months + 1, 0).getDate()
      const d = new Date(begin.getFullYear(), months, Math.min(dayOfMonth, lastDay))
      if (d < begin) continue
      out.push(todayISO(d))
    }
    return out.length ? out : [start]
  }
  if (repeat === 'custom') {
    const step = Math.max(1, Math.min(365, Math.round(Number(fields.customDays) || 0)) || 7)
    for (let d = new Date(begin); d <= limit && out.length < 52; d.setDate(d.getDate() + step)) {
      out.push(todayISO(d))
    }
    return out.length ? out : [start]
  }
  return [start]
}

function normalizeIncome(rec) {
  return { ...baseRecord(rec), ...normalizeRecurrence(rec), sourceId: str(rec.sourceId, 60) }
}

function normalizeExpense(rec) {
  return { ...baseRecord(rec), ...normalizeRecurrence(rec), categoryId: str(rec.categoryId, 60) }
}

function normalizeRecurrence(rec) {
  const repeat = ['weekly', 'monthly', 'custom'].includes(rec.repeat) ? rec.repeat : 'none'
  return {
    repeat,
    repeatGroupId: str(rec.repeatGroupId, 60),
    weekDays: Array.isArray(rec.weekDays) ? rec.weekDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [],
    monthDay: Math.min(31, Math.max(0, Number(rec.monthDay) || 0)),
    customDays: Math.min(365, Math.max(0, Number(rec.customDays) || 0)),
    excepted: rec.excepted === true,
    skipped: rec.skipped === true
  }
}

function normalizeTransfer(rec) {
  return {
    id: rec.id || uid('tr'),
    amount: Math.abs(parseMoney(rec.amount)),
    fee: Math.abs(parseMoney(rec.fee)),
    fromId: str(rec.fromId, 60),
    toId: str(rec.toId, 60),
    date: isValidISO(rec.date) ? rec.date : todayISO(),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(rec.time || '')) ? rec.time : nowTime(),
    note: str(rec.note, 400),
    pending: rec.pending === true,
    releasedDate: isValidISO(rec.releasedDate) ? rec.releasedDate : '',
    createdAt: rec.createdAt || new Date().toISOString()
  }
}

function normalizeAsset(asset) {
  const selling = parseMoney(asset.sellingPrice)
  return {
    id: asset.id || uid('a'),
    name: str(asset.name, 120) || 'Asset',
    buyingPrice: Math.abs(parseMoney(asset.buyingPrice)),
    sellingPrice: Math.abs(selling),
    // Only the "sold" tick marks an asset sold — a filled-in selling price on
    // its own no longer flips it, so unticking the box actually keeps it unsold.
    sold: asset.sold === true,
    walletId: str(asset.walletId, 60),
    date: isValidISO(asset.date) ? asset.date : '',
    sort: str(asset.sort, 40),
    note: str(asset.note, 400)
  }
}

// The four ways money moves for a debt:
//   Lent    — you hand money from a wallet to a person (to be collected back).
//   Collect — that person pays you back into the wallet.
//   Borrow  — you take money from a person into a wallet (to be returned).
//   Return  — you pay that person back from the wallet.
// Lent/Return take money OUT of the wallet; Collect/Borrow bring money IN.
const DEBT_DIRECTIONS = ['Lent', 'Collect', 'Borrow', 'Return']
const DEBT_WALLET_SIGN = { Lent: -1, Collect: 1, Borrow: 1, Return: -1 }

// Map a free-text Type / Status column onto one of the four debt directions.
function debtDirectionFrom(value) {
  const raw = String(value == null ? '' : value).toLowerCase()
  if (raw.includes('borrow')) return 'Borrow'
  if (raw.includes('return')) return 'Return'
  if (raw.includes('collect')) return 'Collect'
  return 'Lent'
}

function normalizeDebt(debt) {
  const direction = DEBT_DIRECTIONS.includes(debt.direction) ? debt.direction : 'Lent'
  return {
    id: debt.id || uid('d'),
    // A short description of what the debt was for, plus a phone / reference
    // number kept with the person.
    name: str(debt.name != null ? debt.name : debt.description, 120),
    person: str(debt.person, 80) || 'Someone',
    number: str(debt.number, 40),
    amount: Math.abs(parseMoney(debt.amount)),
    direction,
    walletId: str(debt.walletId, 60),
    date: isValidISO(debt.date) ? debt.date : '',
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(debt.time || '')) ? debt.time : '',
    expectedDate: isValidISO(debt.expectedDate) ? debt.expectedDate : '',
    property: Boolean(debt.property),
    note: str(debt.note, 300),
    settled: debt.settled === true
  }
}

// A goal with no month applies to every month; otherwise it is pinned to a
// single YYYY-MM key and only counts expenses inside that month.
function normalizeGoalMonth(value) {
  const raw = str(value, 7)
  if (!/^\d{4}-\d{2}$/.test(raw)) return ''
  return Number(raw.slice(5)) >= 1 && Number(raw.slice(5)) <= 12 ? raw : ''
}

// A goal is an optional monthly spending limit. It can watch every expense,
// or only those hitting one wallet / one category. `strict` goals refuse the
// expense entirely; soft goals just ask for confirmation. `month` pins the goal
// to one month — empty means "every month".
function normalizeGoal(goal) {
  return {
    id: goal.id || uid('g'),
    name: str(goal.name, 60) || 'Monthly goal',
    limit: Math.max(0, parseMoney(goal.limit)),
    walletId: str(goal.walletId, 60),
    categoryId: str(goal.categoryId, 60),
    month: normalizeGoalMonth(goal.month),
    strict: goal.strict !== false,
    createdAt: goal.createdAt || new Date().toISOString()
  }
}

function defaultState() {
  return {
    version: 1,
    // `rates` maps an ISO currency code to what one unit costs in the main
    // currency. `exchangeRate`/`rateUpdatedAt` stay as the mirrored entry for
    // the secondary currency, so older backups keep working.
    settings: {
      currency: '$',
      theme: 'dark',
      mainCurrency: 'EGP',
      secondaryCurrency: '$',
      rates: {},
      exchangeRate: null,
      rateUpdatedAt: '',
      ratesUpdatedAt: '',
      pendingAffectsBalance: false
    },
    wallets: DEFAULT_WALLETS.map(normalizeWallet),
    categories: DEFAULT_CATEGORIES.map(normalizeCategory),
    sources: DEFAULT_SOURCES.map((name) => normalizeSource({ name })),
    goals: [],
    incomes: [],
    expenses: [],
    transfers: [],
    assets: [],
    debts: []
  }
}

// Only positive numbers survive, and they are stored under the currency's ISO
// code so a symbol ("$") and its code ("USD") share one entry.
function normalizeRates(raw) {
  const out = {}
  if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach((key) => {
      const code = currencyCode(key)
      const value = Number(raw[key])
      if (code && Number.isFinite(value) && value > 0) out[code] = roundRate(value)
    })
  }
  return out
}

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultState()
  const out = defaultState()
  out.settings = {
    currency: str(raw.settings && raw.settings.currency, 6) || '$',
    theme: raw.settings && raw.settings.theme === 'light' ? 'light' : 'dark',
    mainCurrency: str(raw.settings && raw.settings.mainCurrency, 12) || 'EGP',
    secondaryCurrency: str(raw.settings && raw.settings.secondaryCurrency, 12) || '$',
    rates: normalizeRates(raw.settings && raw.settings.rates),
    exchangeRate: Number(raw.settings && raw.settings.exchangeRate) > 0 ? Number(raw.settings.exchangeRate) : null,
    rateUpdatedAt: str(raw.settings && raw.settings.rateUpdatedAt, 40),
    ratesUpdatedAt: str(raw.settings && raw.settings.ratesUpdatedAt, 40),
    pendingAffectsBalance: raw.settings && raw.settings.pendingAffectsBalance === true
  }
  // A saved single rate for the secondary currency becomes an entry in the map.
  const legacyCode = currencyCode(out.settings.secondaryCurrency)
  if (legacyCode && Number(out.settings.exchangeRate) > 0) {
    out.settings.rates[legacyCode] = roundRate(out.settings.exchangeRate)
  }
  if (Array.isArray(raw.wallets) && raw.wallets.length) out.wallets = raw.wallets.map(normalizeWallet)
  if (Array.isArray(raw.categories) && raw.categories.length) {
    const oldDefaultIcons = {
      other: ['tag', 'more'],
      debt: ['coins', 'handcoin'],
      dept: ['coins', 'handcoin'],
      subscription: ['tv', 'repeat']
    }
    out.categories = raw.categories.map((category) => {
      const normalized = normalizeCategory(category)
      const oldDefault = oldDefaultIcons[normalized.name.toLowerCase()]
      if (oldDefault && normalized.icon === oldDefault[0]) normalized.icon = oldDefault[1]
      return normalized
    })
  }
  if (Array.isArray(raw.sources) && raw.sources.length) out.sources = raw.sources.map(normalizeSource)
  out.goals = Array.isArray(raw.goals) ? raw.goals.map(normalizeGoal) : []
  out.incomes = Array.isArray(raw.incomes) ? raw.incomes.map(normalizeIncome) : []
  out.expenses = Array.isArray(raw.expenses) ? raw.expenses.map(normalizeExpense) : []
  out.transfers = Array.isArray(raw.transfers) ? raw.transfers.map(normalizeTransfer) : []
  out.assets = Array.isArray(raw.assets) ? raw.assets.map(normalizeAsset) : []
  out.debts = Array.isArray(raw.debts) ? raw.debts.map(normalizeDebt) : []
  return out
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return migrate(JSON.parse(raw))
  } catch {
    return defaultState()
  }
}

let state = load()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage may be unavailable; keep working in memory
  }
}

// Recurring income/expense series only pre-generate a limited window of dates
// when they are created (~12 months). Without this, a monthly salary would
// silently stop appearing after a year. Top up any series that is running low
// (or has run out) so it keeps repeating indefinitely. Series that were ended
// explicitly have repeat === 'none' on every record, so they are never topped
// back up.
function extendRecurringSeries() {
  const soon = todayISO(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000))
  let changed = false
  const extend = (list, kind) => {
    const groups = new Map()
    list.forEach((rec) => {
      if (!rec.repeatGroupId || rec.repeat === 'none') return
      if (!groups.has(rec.repeatGroupId)) groups.set(rec.repeatGroupId, [])
      groups.get(rec.repeatGroupId).push(rec)
    })
    groups.forEach((recs) => {
      recs.sort((a, b) => (a.date < b.date ? -1 : 1))
      const last = recs[recs.length - 1]
      const futureCount = recs.filter((r) => !isDue(r)).length
      // Still has plenty of upcoming dates — nothing to do.
      if (futureCount > 0 && last.date >= soon) return
      const existing = new Set(recs.map((r) => r.date))
      const more = recurringDates({
        date: last.date,
        repeat: last.repeat,
        weekDays: last.weekDays,
        monthDay: last.monthDay,
        customDays: last.customDays
      }).filter((d) => d > last.date && !existing.has(d))
      more.forEach((date) => {
        const fresh = { ...last, id: '', date, createdAt: new Date().toISOString(), excepted: false, skipped: false }
        list.push(kind === 'income' ? normalizeIncome(fresh) : normalizeExpense(fresh))
        changed = true
      })
    })
  }
  extend(state.incomes, 'income')
  extend(state.expenses, 'expense')
  if (changed) save()
}

extendRecurringSeries()

// ---------- lookups ----------

function walletName(id) {
  const w = state.wallets.find((item) => item.id === id)
  return w ? w.name : ''
}
function categoryName(id) {
  const c = state.categories.find((item) => item.id === id)
  return c ? c.name : ''
}
function sourceName(id) {
  const s = state.sources.find((item) => item.id === id)
  return s ? s.name : ''
}

function findByName(list, name) {
  const key = normName(name)
  return list.find((item) => normName(item.name) === key) || null
}

function ensureWallet(name) {
  const clean = str(name, 60)
  if (!clean) return ''
  const found = findByName(state.wallets, clean)
  if (found) return found.id
  const created = normalizeWallet({ name: clean })
  state.wallets.push(created)
  return created.id
}

function ensureCategory(name) {
  let clean = str(name, 40)
  if (!clean) return ''
  const alias = CATEGORY_ALIASES[normName(clean)]
  if (alias) clean = alias
  const found = findByName(state.categories, clean)
  if (found) return found.id
  const created = normalizeCategory({ name: clean }, state.categories.length)
  state.categories.push(created)
  return created.id
}

function ensureSource(name) {
  const clean = str(name, 60)
  if (!clean) return ''
  const found = findByName(state.sources, clean)
  if (found) return found.id
  const created = normalizeSource({ name: clean })
  state.sources.push(created)
  return created.id
}

// ---------- computed ----------

// Rates can be small (1 EGP is a fraction of a cent), so they keep more
// decimals than money does.
function roundRate(n) {
  return Math.round((Number(n) || 0) * 1000000) / 1000000
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

// What one unit of `currency` costs in the main currency, or 0 when the rate
// has not been saved yet.
function currencyRate(currency) {
  const code = currencyCode(currency)
  if (!code) return 0
  const main = currencyCode(state.settings.mainCurrency)
  if (main && code === main) return 1
  const saved = Number(state.settings.rates && state.settings.rates[code])
  // The single secondary-currency rate is honoured for older saved data.
  if (saved > 0) return saved
  if (code === currencyCode(state.settings.secondaryCurrency) && Number(state.settings.exchangeRate) > 0) {
    return Number(state.settings.exchangeRate)
  }
  return 0
}

// Currencies worth fetching a rate for: the secondary currency, every currency
// a wallet keeps a second balance in, and anything already saved.
function rateCurrencies() {
  const main = currencyCode(state.settings.mainCurrency)
  const codes = new Set()
  const add = (code) => {
    if (code && (!main || code !== main)) codes.add(code)
  }
  add(currencyCode(state.settings.secondaryCurrency))
  state.wallets.forEach((w) => {
    if (parseMoney(w.foreign) !== 0) add(currencyCode(w.currency))
  })
  Object.keys(state.settings.rates || {}).forEach(add)
  return [...codes]
}

// Convert an amount in `currency` into the app's main currency using the rate
// saved in Settings. Returns null when no rate is known for that currency, so
// callers can say so instead of silently adding a wrong number. An amount with
// no currency at all is already in the main currency.
function toMainCurrency(amount, currency) {
  const value = parseMoney(amount)
  const from = str(currency, 12)
  if (!from) return value
  const main = str(state.settings.mainCurrency, 12)
  if (from === main || currencyCode(from) === currencyCode(main)) return value
  const rate = currencyRate(from)
  if (rate <= 0) return null
  return round2(value * rate)
}

function walletBalance(id) {
  const wallet = state.wallets.find((w) => w.id === id)
  if (!wallet) return 0
  let total = parseMoney(wallet.start)
  state.incomes.forEach((r) => {
    if (r.walletId === id && isDue(r) && isActive(r)) total += r.amount
  })
  state.expenses.forEach((r) => {
    if (r.walletId === id && isDue(r) && isActive(r)) total -= r.amount
  })
  state.transfers.forEach((t) => {
    if (!transferCounts(t) || !isDue(t)) return
    if (t.fromId === id) total -= t.amount + t.fee
    if (t.toId === id) total += t.amount
  })
  state.assets.forEach((a) => {
    if (a.walletId !== id) return
    total -= a.buyingPrice
    if (a.sold) total += a.sellingPrice
  })
  state.debts.forEach((d) => {
    if (d.walletId !== id) return
    total += (DEBT_WALLET_SIGN[d.direction] || -1) * d.amount
  })
  return round2(total)
}

// What the wallet is worth in the MAIN currency: the running balance, the amount
// the owner allows themselves to use, and any second-currency balance at the
// saved rate. A currency with no known rate is left out of the sum.
function walletTotal(id) {
  const wallet = state.wallets.find((w) => w.id === id)
  if (!wallet) return 0
  let total = walletBalance(id) + Math.max(0, parseMoney(wallet.allowable))
  const converted = toMainCurrency(wallet.foreign, wallet.currency)
  if (converted !== null) total += converted
  return round2(total)
}

// How much a wallet can cover: its running balance, the amount the owner allows
// themselves to use, and any second-currency balance converted at the saved
// rate. Transactions are checked against this, so the allowance is what lets an
// expense through even when the balance alone would not.
function walletSpendable(id) {
  return walletTotal(id)
}

// The same, minus an amount that is already counted in the wallet's balance —
// used when editing an existing expense.
function walletSpendableExcluding(id, amount) {
  return round2(walletSpendable(id) - Math.abs(parseMoney(amount)))
}

// Per-wallet parts of the total, so screens can show what it is made of and
// warn when a second-currency balance cannot be converted.
function walletTotals() {
  const acc = { main: 0, allowable: 0, foreign: 0, unrated: 0, currencies: [] }
  const seen = {}
  state.wallets.forEach((w) => {
    acc.main += walletBalance(w.id)
    acc.allowable += Math.max(0, parseMoney(w.allowable))
    const code = currencyCode(w.currency)
    if (code && parseMoney(w.foreign) !== 0) {
      if (!seen[code]) {
        seen[code] = { code, amount: 0, main: 0, rated: true }
        acc.currencies.push(seen[code])
      }
      seen[code].amount += parseMoney(w.foreign)
      const converted = toMainCurrency(w.foreign, w.currency)
      if (converted === null) { seen[code].rated = false; acc.unrated += 1 }
      else seen[code].main += converted
    }
  })
  acc.currencies.forEach((c) => {
    c.amount = round2(c.amount)
    c.main = round2(c.main)
    if (c.rated) acc.foreign += c.main
  })
  return {
    main: round2(acc.main),
    allowable: round2(acc.allowable),
    foreign: round2(acc.foreign),
    unrated: acc.unrated,
    currencies: acc.currencies
  }
}

function monthItems(month) {
  const inMonth = (date) => monthKey(date) === month
  return {
    incomes: state.incomes.filter((r) => inMonth(r.date) && isDue(r) && isActive(r)),
    expenses: state.expenses.filter((r) => inMonth(r.date) && isDue(r) && isActive(r)),
    transfers: state.transfers.filter((r) => inMonth(effectiveDate(r)) && isDue(r) && transferCounts(r))
  }
}

function monthSummary(month) {
  const { incomes, expenses } = monthItems(month)
  const income = incomes.reduce((sum, r) => sum + r.amount, 0)
  const expense = expenses.reduce((sum, r) => sum + r.amount, 0)
  const net = income - expense
  const rate = income > 0 ? Math.round((net / income) * 100) : (expense > 0 ? -100 : 0)
  return { month, income, expense, net, rate }
}

function categoryTotals(month) {
  const totals = {}
  state.expenses.forEach((r) => {
    if (monthKey(r.date) !== month || !isDue(r) || !isActive(r)) return
    totals[r.categoryId] = (totals[r.categoryId] || 0) + r.amount
  })
  return totals
}

function sourceTotals(month) {
  const totals = {}
  state.incomes.forEach((r) => {
    if (monthKey(r.date) !== month || !isDue(r) || !isActive(r)) return
    totals[r.sourceId] = (totals[r.sourceId] || 0) + r.amount
  })
  return totals
}

// ---------- goals ----------

// Expenses that fall inside a goal's scope during `month`.
function goalExpenses(goal, month) {
  return state.expenses.filter((r) => {
    if (monthKey(r.date) !== month || !isDue(r) || !isActive(r)) return false
    if (goal.walletId && r.walletId !== goal.walletId) return false
    if (goal.categoryId && r.categoryId !== goal.categoryId) return false
    return true
  })
}

function goalProgress(goal, month) {
  const spent = goalExpenses(goal, month).reduce((sum, r) => sum + r.amount, 0)
  const limit = Math.max(0, Number(goal.limit) || 0)
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0
  return {
    spent,
    limit,
    pct,
    remaining: Math.max(0, limit - spent),
    over: Math.max(0, spent - limit),
    hit: limit > 0 && spent >= limit
  }
}

function goalScopeText(goal) {
  const bits = []
  bits.push(goal.walletId ? walletName(goal.walletId) : 'All wallets')
  if (goal.categoryId) bits.push(categoryName(goal.categoryId))
  return bits.join(' · ')
}

// Would saving this expense push any goal to (or past) its monthly limit?
// Returns one entry per affected goal so the UI can explain each one.
function goalsHitByExpense(fields, excludeTxId) {
  const amount = Math.abs(parseMoney(fields && fields.amount))
  if (!amount) return []
  const start = isValidISO(fields && fields.date) ? fields.date : todayISO()
  // Editing an existing record only re-checks its own date; a brand new
  // recurring series is checked for every generated occurrence.
  const dates = excludeTxId
    ? [start]
    : recurringDates({ ...fields, date: start })
  const months = [...new Set(dates.map(monthKey))]
  const hits = []
  state.goals.forEach((goal) => {
    if (!goal.limit) return
    if (goal.walletId && goal.walletId !== str(fields && fields.walletId, 60)) return
    if (goal.categoryId && goal.categoryId !== str(fields && fields.categoryId, 60)) return
    let worst = null
    months.forEach((m) => {
      const spent = goalExpenses(goal, m)
        .filter((r) => r.id !== excludeTxId)
        .reduce((sum, r) => sum + r.amount, 0)
      const next = spent + amount
      if (next < goal.limit) return
      if (!worst || next - goal.limit > worst.over) {
        worst = { goal, month: m, spent, next, over: next - goal.limit, remaining: Math.max(0, goal.limit - spent) }
      }
    })
    if (worst) hits.push(worst)
  })
  return hits
}

function allTransactions() {
  const list = [
    ...state.incomes.filter((r) => isDue(r) && isActive(r)).map((r) => ({ ...r, kind: 'income' })),
    ...state.expenses.filter((r) => isDue(r) && isActive(r)).map((r) => ({ ...r, kind: 'expense' })),
    ...state.transfers.filter((r) => isDue(r) && transferCounts(r)).map((t) => ({ ...t, kind: 'transfer', effDate: effectiveDate(t) })),
    ...state.debts.filter(isActive).map((d) => ({ ...d, kind: 'debt' }))
  ]
  return list.sort((a, b) => {
    const da = a.effDate || a.date
    const db = b.effDate || b.date
    return da === db
      ? String(b.time || '').localeCompare(String(a.time || ''))
      : (da < db ? 1 : -1)
  })
}

function byDateTimeAsc(a, b) {
  return a.date === b.date
    ? String(a.time || '').localeCompare(String(b.time || ''))
    : (a.date < b.date ? -1 : 1)
}

function allScheduleGroups(kind) {
  const records = kind === 'income' ? state.incomes : state.expenses
  const groups = new Map()

  records.forEach((record) => {
    if (!record.repeatGroupId || record.repeat === 'none') return
    if (!groups.has(record.repeatGroupId)) {
      groups.set(record.repeatGroupId, { id: record.repeatGroupId, kind, repeat: record.repeat, records: [] })
    }
    groups.get(record.repeatGroupId).records.push(record)
  })

  const legacyGroups = new Map()
  records.forEach((record) => {
    if (record.repeatGroupId) return
    const createdAt = String(record.createdAt || '').slice(0, 19)
    const signature = JSON.stringify([
      createdAt,
      record.name,
      record.amount,
      record.walletId,
      kind === 'income' ? record.sourceId : record.categoryId
    ])
    if (!legacyGroups.has(signature)) legacyGroups.set(signature, [])
    legacyGroups.get(signature).push(record)
  })
  legacyGroups.forEach((items, signature) => {
    if (items.length < 2 || new Set(items.map((item) => item.date)).size < 2) return
    if (!items.some((item) => !isDue(item))) return
    groups.set(`legacy-${kind}-${signature}`, { id: `legacy-${kind}-${signature}`, kind, repeat: 'scheduled', records: items })
  })

  return [...groups.values()].map((group) => {
    const future = group.records.filter((record) => !isDue(record)).sort(byDateTimeAsc)
    const upcoming = future.filter(isActive)
    return { ...group, future, upcoming, skipped: future.length - upcoming.length, next: upcoming[0] || future[0] }
  })
}

function repeatingSchedules(kind) {
  // Keep a schedule visible while any future occurrence remains (even if all of
  // them are currently skipped) so it can still be managed from the calendar.
  return allScheduleGroups(kind).filter((group) => group.future.length > 0)
}

function nextScheduledAt() {
  const now = new Date()
  const pending = [...state.incomes, ...state.expenses, ...state.transfers]
    .filter((record) => transferCounts(record) && isActive(record) && !isDue(record))
    .map((record) => new Date(`${effectiveDate(record)}T${record.time || '00:00'}:00`))
    .filter((date) => Number.isFinite(date.getTime()) && date > now)
  const earliest = pending.reduce((timestamp, date) => Math.min(timestamp, date.getTime()), Infinity)
  return Number.isFinite(earliest) ? earliest : null
}

// Roll-up of every debt transaction: what is still owed to you (Lent not yet
// collected) and what you still owe (Borrow not yet returned).
function debtSummary() {
  const totals = { Lent: 0, Collect: 0, Borrow: 0, Return: 0 }
  state.debts.forEach((d) => { totals[d.direction] = (totals[d.direction] || 0) + d.amount })
  return {
    lent: round2(totals.Lent),
    collected: round2(totals.Collect),
    borrowed: round2(totals.Borrow),
    returned: round2(totals.Return),
    outstanding: round2(Math.max(0, totals.Lent - totals.Collect)),
    payable: round2(Math.max(0, totals.Borrow - totals.Return))
  }
}

// Per-person roll-up so a Lent can be collected, or a Borrow returned, in as
// many pieces as needed — each Collect / Return simply reduces the balance for
// that person.
function debtPeople() {
  const rows = new Map()
  state.debts.forEach((d) => {
    const person = d.person || 'Someone'
    if (!rows.has(person)) {
      rows.set(person, { person, lent: 0, collected: 0, borrowed: 0, returned: 0, count: 0, last: '' })
    }
    const row = rows.get(person)
    row.count += 1
    if (d.direction === 'Lent') row.lent += d.amount
    else if (d.direction === 'Collect') row.collected += d.amount
    else if (d.direction === 'Borrow') row.borrowed += d.amount
    else if (d.direction === 'Return') row.returned += d.amount
    if ((d.date || '') > row.last) row.last = d.date || ''
  })
  return [...rows.values()].map((row) => ({
    ...row,
    lent: round2(row.lent),
    collected: round2(row.collected),
    borrowed: round2(row.borrowed),
    returned: round2(row.returned),
    receivable: round2(Math.max(0, row.lent - row.collected)),
    payable: round2(Math.max(0, row.borrowed - row.returned))
  }))
}

function netWorth() {
  const totals = walletTotals()
  const cash = round2(totals.main + totals.allowable + totals.foreign)
  const assets = state.assets.filter((a) => !a.sold).reduce((sum, a) => sum + a.buyingPrice, 0)
  const debt = debtSummary()
  return {
    cash,
    ...totals,
    assets,
    receivable: debt.outstanding,
    payable: debt.payable,
    total: round2(cash + assets + debt.outstanding - debt.payable)
  }
}

// ---------- formatting ----------

function formatMoney(value, withSign) {
  const n = Number(value) || 0
  const sign = n < 0 ? '-' : (withSign && n > 0 ? '+' : '')
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${sign}${state.settings.currency || '$'}${formatted}`
}

function formatDate(dateISO) {
  if (!isValidISO(dateISO)) return 'No date'
  const d = new Date(`${dateISO}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateISO
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function monthLabel(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return 'This month'
  const d = new Date(`${month}-01T00:00:00`)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// ---------- CSV ----------

function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''))
}

function objectRows(rows) {
  if (!rows.length) return []
  const header = rows[0].map((h) => String(h).trim().toLowerCase())
  return rows.slice(1).map((cells) => {
    const obj = {}
    header.forEach((key, i) => {
      obj[key] = cells[i] == null ? '' : cells[i]
    })
    return obj
  })
}

function pick(obj, ...keys) {
  for (const key of keys) {
    const found = Object.keys(obj).find((k) => k.replace(/\s+/g, ' ').toLowerCase() === key.toLowerCase())
    if (found !== undefined && obj[found] !== '') return obj[found]
  }
  return ''
}

function importWallets(text) {
  let created = 0
  objectRows(parseCSV(text)).forEach((row) => {
    const name = refName(pick(row, 'Name'))
    if (!name) return
    const opening = parseMoney(pick(row, 'Startup Balance'))
    const balance = parseMoney(pick(row, 'Balance'))
    const type = pick(row, 'Tybe', 'Type')
    const status = pick(row, 'Transaction Status')
    // The export's "Dollar Currency" column held a dollar *amount*, not a
    // currency — it lands in the wallet's second balance, in dollars.
    const dollarAmount = parseMoney(pick(row, 'Dollar Currency', 'Foreign Balance'))
    const existing = findByName(state.wallets, name)
    const payload = {
      name,
      type: WALLET_TYPES.includes(type) ? type : (existing ? existing.type : 'In Hand'),
      status: WALLET_STATUS.includes(status) ? status : (existing ? existing.status : 'Available'),
      start: opening || balance || (existing ? existing.start : 0),
      foreign: dollarAmount || (existing ? existing.foreign : 0),
      currency: dollarAmount ? '$' : (existing ? existing.currency : '')
    }
    if (existing) Object.assign(existing, normalizeWallet({ ...existing, ...payload }))
    else {
      state.wallets.push(normalizeWallet(payload))
      created += 1
    }
  })
  save()
  return created
}

function importIncome(text) {
  let created = 0
  objectRows(parseCSV(text)).forEach((row) => {
    const name = str(pick(row, 'Name'), 120)
    const amount = parseMoney(pick(row, 'Amount'))
    if (!name || !amount) return
    const walletId = ensureWallet(refName(pick(row, 'Wallet_I', 'Wallet')))
    const sourceId = ensureSource(refName(pick(row, 'Source')))
    state.incomes.push(normalizeIncome({
      name,
      amount,
      walletId,
      sourceId,
      date: parseDate(pick(row, 'Date', 'Income Recorded time')),
      note: str(pick(row, 'Details_I'), 400)
    }))
    created += 1
  })
  save()
  return created
}

function importExpense(text) {
  let created = 0
  objectRows(parseCSV(text)).forEach((row) => {
    const name = str(pick(row, 'Name'), 120)
    const amount = parseMoney(pick(row, 'Amount'))
    if (!name || !amount) return
    const walletId = ensureWallet(refName(pick(row, 'Wallet_E', 'Wallet')))
    const categoryId = ensureCategory(refName(pick(row, 'Catagories', 'Categories', 'Category')))
    state.expenses.push(normalizeExpense({
      name,
      amount,
      walletId,
      categoryId,
      date: parseDate(pick(row, 'Date', 'Expense Recorded time')),
      note: str(pick(row, 'Details_E', 'Details'), 400)
    }))
    created += 1
  })
  save()
  return created
}

function importTransfers(text) {
  let created = 0
  objectRows(parseCSV(text)).forEach((row) => {
    const amount = parseMoney(pick(row, 'Amount'))
    if (!amount) return
    const fromId = ensureWallet(refName(pick(row, 'From', 'Wallets from')))
    const toId = ensureWallet(refName(pick(row, 'To', 'Wallets to')))
    if (!fromId || !toId) return
    state.transfers.push(normalizeTransfer({
      amount,
      fromId,
      toId,
      date: parseDate(pick(row, 'Date', 'Realtime')),
      fee: parseMoney(pick(row, 'Fee Amount')),
      note: str(pick(row, 'Transfrer Transcation', 'Transfer Transaction'), 400)
    }))
    created += 1
  })
  save()
  return created
}

function importBudget(text) {
  let touched = 0
  objectRows(parseCSV(text)).forEach((row) => {
    const name = refName(pick(row, 'Categories', 'Category', 'Name'))
    if (!name) return
    const budget = parseMoney(pick(row, 'Budget'))
    const id = ensureCategory(name)
    const category = state.categories.find((c) => c.id === id)
    if (category) {
      category.budget = Math.max(0, budget)
      touched += 1
    }
  })
  save()
  return touched
}

function importDebts(text) {
  let created = 0
  objectRows(parseCSV(text)).forEach((row) => {
    const person = str(pick(row, 'Person'), 80)
    const amount = Math.abs(parseMoney(pick(row, 'Amount')))
    if (!person || !amount) return
    state.debts.push(normalizeDebt({
      person,
      name: str(pick(row, 'Description', 'Name'), 120),
      number: str(pick(row, 'Number', 'Phone'), 40),
      amount,
      direction: debtDirectionFrom(pick(row, 'Type', 'Status', 'Collect/Return')),
      walletId: ensureWallet(refName(pick(row, 'Wallets', 'Wallet'))),
      date: parseDate(pick(row, 'Date')),
      expectedDate: parseDate(pick(row, 'Expecting Date')),
      property: /yes/i.test(pick(row, 'Property')),
      settled: false
    }))
    created += 1
  })
  save()
  return created
}

// Auto-detect which exporter produced a CSV by its header row.
function detectKind(text) {
  const first = String(text || '').split('\n')[0].toLowerCase()
  if (first.includes('startup balance') || (first.includes('tybe') && first.includes('balance'))) return 'wallets'
  if (first.includes('wallet_i') || (first.includes('source') && first.includes('amount'))) return 'income'
  if (first.includes('wallet_e') || first.includes('catagories') || first.includes('category budget')) return 'expense'
  if (first.includes('wallets from') || (first.includes('from') && first.includes('to') && first.includes('amount'))) return 'transfer'
  if (first.includes('budget') && first.includes('categories')) return 'budget'
  if (first.includes('person') && first.includes('amount')) return 'debts'
  return ''
}

export function importCSVText(text) {
  const kind = detectKind(text)
  if (!kind) return { ok: false, reason: 'Could not recognise this CSV. Expected a Wallets, Income, Expense, Transfer or Budget export.' }
  let count = 0
  if (kind === 'wallets') count = importWallets(text)
  else if (kind === 'income') count = importIncome(text)
  else if (kind === 'expense') count = importExpense(text)
  else if (kind === 'transfer') count = importTransfers(text)
  else if (kind === 'budget') count = importBudget(text)
  else if (kind === 'debts') count = importDebts(text)
  return { ok: true, kind, count }
}

// ---------- public API ----------

export const store = {
  todayISO,
  nowTime,
  isDue,
  monthKey,
  monthLabel,
  parseMoney,

  getState() {
    return state
  },
  getSettings() {
    return state.settings
  },
  setCurrency(value) {
    state.settings.currency = str(value, 6) || '$'
    save()
  },
  setMainCurrency(value) {
    state.settings.mainCurrency = str(value, 12) || 'EGP'
    // Every saved rate means "cost in the main currency", so they all stop
    // being valid the moment the main currency changes. Drop them and let the
    // rates be fetched again rather than converting with the wrong numbers.
    state.settings.rates = {}
    state.settings.ratesUpdatedAt = ''
    state.settings.exchangeRate = null
    state.settings.rateUpdatedAt = ''
    save()
  },
  setSecondaryCurrency(value) {
    state.settings.secondaryCurrency = str(value, 12) || '$'
    save()
  },
  // Typed by hand when the online rate cannot be fetched — wallet balances in
  // another currency are converted with it. Anything invalid is ignored so a
  // stray keystroke can never wipe a working rate.
  setExchangeRate(value) {
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) return
    state.settings.exchangeRate = roundRate(n)
    state.settings.rateUpdatedAt = new Date().toISOString()
    this.setRate(state.settings.secondaryCurrency, n)
  },
  // Save the rate for one currency by symbol or code. The secondary currency's
  // entry is mirrored onto the legacy single-rate fields so older saved data
  // and the Settings summary stay consistent.
  setRate(currency, value) {
    const code = currencyCode(currency)
    const n = Number(value)
    if (!code || !Number.isFinite(n) || n <= 0) return
    state.settings.rates[code] = roundRate(n)
    state.settings.ratesUpdatedAt = new Date().toISOString()
    if (code === currencyCode(state.settings.secondaryCurrency)) {
      state.settings.exchangeRate = state.settings.rates[code]
      state.settings.rateUpdatedAt = state.settings.ratesUpdatedAt
    }
    save()
  },
  getRates() {
    return { ...state.settings.rates }
  },
  rateFor(currency) {
    return currencyRate(currency)
  },
  rateCurrencies,
  rateUpdatedAt() {
    return state.settings.ratesUpdatedAt || state.settings.rateUpdatedAt || ''
  },
  // Fetch live rates for every currency the wallets use. One request against
  // the main currency gives all of them at once.
  async refreshRate() {
    const main = currencyCode(state.settings.mainCurrency) || 'EGP'
    const wanted = rateCurrencies()
    if (!wanted.length) return { ok: false, reason: 'No other currency in use' }
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(main)}`)
      const data = await res.json()
      if (data && data.result === 'success' && data.rates) {
        let updated = 0
        wanted.forEach((code) => {
          const perUnit = Number(data.rates[code])
          if (Number.isFinite(perUnit) && perUnit > 0) {
            state.settings.rates[code] = roundRate(1 / perUnit)
            updated += 1
          }
        })
        if (!updated) return { ok: false, reason: 'Rate not available' }
        state.settings.ratesUpdatedAt = new Date().toISOString()
        // Mirror the secondary currency onto the legacy single-rate fields.
        const secondaryCode = currencyCode(state.settings.secondaryCurrency)
        if (secondaryCode && state.settings.rates[secondaryCode]) {
          state.settings.exchangeRate = state.settings.rates[secondaryCode]
          state.settings.rateUpdatedAt = state.settings.ratesUpdatedAt
        }
        save()
        return { ok: true, count: updated }
      }
      return { ok: false, reason: 'Rate not available' }
    } catch {
      return { ok: false, reason: 'Offline' }
    }
  },
  getTheme() {
    return state.settings.theme
  },
  setTheme(mode) {
    state.settings.theme = mode === 'light' ? 'light' : 'dark'
    save()
  },
  setPendingAffectsBalance(value) {
    state.settings.pendingAffectsBalance = value === true
    save()
  },
  transferCounts,

  // Wallets
  getWallets() {
    return state.wallets.map((w) => ({ ...w, current: walletBalance(w.id) }))
  },
  findWallet(id) {
    return state.wallets.find((w) => w.id === id) || null
  },
  walletName,
  walletBalance,
  walletTotal,
  walletSpendable,
  walletSpendableExcluding,
  walletTotals,
  toMainCurrency,
  currencyCode,
  // Every currency the wallet form can offer: the built-in list plus the ones
  // configured in Settings, so a rate is always available for them.
  currencyChoices() {
    const extra = [
      state.settings.mainCurrency,
      state.settings.secondaryCurrency,
      ...rateCurrencies().map((code) => {
        const symbol = Object.keys(CODE_BY_SYMBOL).find((key) => CODE_BY_SYMBOL[key] === code)
        return symbol || code
      })
    ]
    const all = CURRENCY_CHOICES.concat(extra).filter(Boolean)
    return all.filter((c, i) => all.indexOf(c) === i)
  },
  addWallet(fields) {
    const wallet = normalizeWallet(fields)
    state.wallets.push(wallet)
    save()
    return wallet
  },
  updateWallet(id, fields) {
    const wallet = state.wallets.find((w) => w.id === id)
    if (!wallet) return
    Object.assign(wallet, normalizeWallet({ ...wallet, ...fields, id }))
    save()
  },
  removeWallet(id) {
    state.wallets = state.wallets.filter((w) => w.id !== id)
    save()
  },
  // Nudge a wallet up (-1) or down (+1) in the list. The array order is what
  // every screen shows, so moving within it reorders the wallets everywhere.
  moveWallet(id, delta) {
    const from = state.wallets.findIndex((w) => w.id === id)
    if (from < 0) return
    const to = from + Math.sign(delta || 0)
    if (to < 0 || to >= state.wallets.length || to === from) return
    const [wallet] = state.wallets.splice(from, 1)
    state.wallets.splice(to, 0, wallet)
    save()
  },

  // Categories / budgets
  getCategories() {
    return state.categories.map((c) => ({ ...c }))
  },
  findCategory(id) {
    return state.categories.find((c) => c.id === id) || null
  },
  categoryName,
  addCategory(fields) {
    const category = normalizeCategory(fields, state.categories.length)
    state.categories.push(category)
    save()
    return category
  },
  updateCategory(id, fields) {
    const category = state.categories.find((c) => c.id === id)
    if (!category) return
    Object.assign(category, normalizeCategory({ ...category, ...fields, id }, state.categories.indexOf(category)))
    save()
  },
  removeCategory(id) {
    state.categories = state.categories.filter((c) => c.id !== id)
    state.expenses.forEach((e) => {
      if (e.categoryId === id) e.categoryId = ''
    })
    save()
  },

  // Income sources
  getSources() {
    return state.sources.map((s) => ({ ...s }))
  },
  sourceName,
  addSource(fields) {
    const source = normalizeSource(fields)
    state.sources.push(source)
    save()
    return source
  },
  updateSource(id, fields) {
    const source = state.sources.find((s) => s.id === id)
    if (!source) return
    source.name = str(fields.name, 60) || source.name
    save()
  },
  removeSource(id) {
    state.sources = state.sources.filter((s) => s.id !== id)
    state.incomes.forEach((r) => {
      if (r.sourceId === id) r.sourceId = ''
    })
    save()
  },
  ensureSource,

  // Transactions
  getIncomes() {
    return state.incomes.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  },
  getExpenses() {
    return state.expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  },
  getTransfers() {
    return state.transfers.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  },
  getTransactions() {
    return allTransactions()
  },
  getRepeatingSchedules(kind) {
    return repeatingSchedules(kind)
  },
  getSchedule(kind, groupId) {
    return allScheduleGroups(kind).find((group) => group.id === groupId) || null
  },
  skipTransaction(kind, id, skipped) {
    const target = this.findTransaction(kind, id)
    if (!target) return
    target.skipped = skipped !== false
    save()
  },
  nextScheduledAt,
  isDue,
  findTransaction(kind, id) {
    if (kind === 'income') return state.incomes.find((r) => r.id === id) || null
    if (kind === 'expense') return state.expenses.find((r) => r.id === id) || null
    if (kind === 'transfer') return state.transfers.find((r) => r.id === id) || null
    return null
  },
  addIncome(fields) {
    const dates = recurringDates(fields)
    const repeatGroupId = fields.repeat && fields.repeat !== 'none' ? uid('rp') : ''
    const made = dates.map((date) => normalizeIncome({ ...fields, repeatGroupId, date, name: fields.name || sourceName(fields.sourceId) || 'Income' }))
    state.incomes.push(...made)
    save()
    return made[0]
  },
  addExpense(fields) {
    const dates = recurringDates(fields)
    const repeatGroupId = fields.repeat && fields.repeat !== 'none' ? uid('rp') : ''
    const made = dates.map((date) => normalizeExpense({ ...fields, repeatGroupId, date, name: fields.name || categoryName(fields.categoryId) || 'Expense' }))
    state.expenses.push(...made)
    save()
    return made[0]
  },
  addTransfer(fields) {
    const rec = normalizeTransfer(fields)
    state.transfers.push(rec)
    save()
    return rec
  },
  updateTransaction(kind, id, fields) {
    const target = this.findTransaction(kind, id)
    if (!target) return
    if (kind === 'income') Object.assign(target, normalizeIncome({ ...target, ...fields, id }))
    else if (kind === 'expense') Object.assign(target, normalizeExpense({ ...target, ...fields, id }))
    else Object.assign(target, normalizeTransfer({ ...target, ...fields, id }))
    if ((kind === 'income' || kind === 'expense') && target.repeatGroupId && target.repeat !== 'none') target.excepted = true
    save()
  },
  updateSeries(kind, id, fields) {
    const target = this.findTransaction(kind, id)
    if (!target || !target.repeatGroupId || target.repeat === 'none') return this.updateTransaction(kind, id, fields)
    const groupId = target.repeatGroupId
    const fromDate = target.date
    const list = kind === 'income' ? state.incomes : state.expenses
    list.forEach((rec) => {
      if (rec.repeatGroupId !== groupId || rec.date < fromDate) return
      const patch = { ...rec }
      if (fields.name !== undefined) patch.name = fields.name
      if (fields.amount !== undefined) patch.amount = fields.amount
      if (fields.time !== undefined) patch.time = fields.time
      if (fields.walletId !== undefined) patch.walletId = fields.walletId
      if (fields.note !== undefined) patch.note = fields.note
      if (kind === 'income' && fields.sourceId !== undefined) patch.sourceId = fields.sourceId
      if (kind === 'expense' && fields.categoryId !== undefined) patch.categoryId = fields.categoryId
      patch.excepted = false
      Object.assign(rec, kind === 'income' ? normalizeIncome(patch) : normalizeExpense(patch))
    })
    save()
  },
  removeTransaction(kind, id) {
    if (kind === 'transfer') {
      state.transfers = state.transfers.filter((t) => t.id !== id)
      save()
      return
    }
    const list = kind === 'income' ? state.incomes : state.expenses
    const target = list.find((r) => r.id === id)
    const groupId = target && target.repeatGroupId ? target.repeatGroupId : ''
    if (kind === 'income') state.incomes = state.incomes.filter((r) => r.id !== id)
    else state.expenses = state.expenses.filter((r) => r.id !== id)
    // Removing the last upcoming occurrence of a series means the series is
    // finished — mark it ended so the auto-top-up never resurrects it.
    if (groupId) {
      const remaining = (kind === 'income' ? state.incomes : state.expenses).filter((r) => r.repeatGroupId === groupId)
      if (remaining.length && !remaining.some((r) => !isDue(r))) {
        remaining.forEach((r) => { r.repeat = 'none' })
      }
    }
    save()
  },
  // End a whole recurring series: drop every upcoming occurrence and keep the
  // past ones (which already happened) as ordinary transactions.
  endSeries(kind, groupId) {
    const group = allScheduleGroups(kind).find((g) => g.id === groupId)
    if (!group) return 0
    const futureIds = new Set(group.future.map((r) => r.id))
    const groupIds = new Set(group.records.map((r) => r.id))
    const list = kind === 'income' ? state.incomes : state.expenses
    let removed = 0
    const kept = list.filter((r) => {
      if (futureIds.has(r.id)) {
        removed += 1
        return false
      }
      if (groupIds.has(r.id)) r.repeat = 'none'
      return true
    })
    if (kind === 'income') state.incomes = kept
    else state.expenses = kept
    save()
    return removed
  },
  ensureRecurring: extendRecurringSeries,

  // Assets
  getAssets() {
    return state.assets.map((a) => ({ ...a }))
  },
  addAsset(fields) {
    const asset = normalizeAsset(fields)
    state.assets.push(asset)
    save()
    return asset
  },
  updateAsset(id, fields) {
    const asset = state.assets.find((a) => a.id === id)
    if (!asset) return
    Object.assign(asset, normalizeAsset({ ...asset, ...fields, id }))
    save()
  },
  removeAsset(id) {
    state.assets = state.assets.filter((a) => a.id !== id)
    save()
  },

  // Debts
  getDebts() {
    return state.debts.slice().sort((a, b) => {
      const da = a.date || ''
      const db = b.date || ''
      return da === db
        ? String(b.time || '').localeCompare(String(a.time || ''))
        : (da < db ? 1 : -1)
    }).map((d) => ({ ...d }))
  },
  findDebt(id) {
    return state.debts.find((d) => d.id === id) || null
  },
  addDebt(fields) {
    const debt = normalizeDebt(fields)
    state.debts.push(debt)
    save()
    return debt
  },
  updateDebt(id, fields) {
    const debt = state.debts.find((d) => d.id === id)
    if (!debt) return
    Object.assign(debt, normalizeDebt({ ...debt, ...fields, id }))
    save()
  },
  removeDebt(id) {
    state.debts = state.debts.filter((d) => d.id !== id)
    save()
  },
  debtSummary,
  debtPeople,

  // Goals (optional monthly spending limits)
  getGoals(month) {
    const target = monthKey(month || todayISO())
    // Goals pinned to another month stay out of this view; goals without a
    // month are shown everywhere.
    return state.goals
      .filter((g) => !g.month || g.month === target)
      .map((g) => ({ ...g, progress: goalProgress(g, target), scope: goalScopeText(g) }))
  },
  findGoal(id) {
    return state.goals.find((g) => g.id === id) || null
  },
  goalProgress,
  goalScopeText,
  goalsHitByExpense,
  addGoal(fields) {
    const goal = normalizeGoal(fields)
    state.goals.push(goal)
    save()
    return goal
  },
  updateGoal(id, fields) {
    const goal = state.goals.find((g) => g.id === id)
    if (!goal) return
    Object.assign(goal, normalizeGoal({ ...goal, ...fields, id }))
    save()
  },
  removeGoal(id) {
    state.goals = state.goals.filter((g) => g.id !== id)
    save()
  },

  // Analytics
  monthSummary,
  categoryTotals,
  sourceTotals,
  netWorth,
  totalCash() {
    return state.wallets.reduce((sum, w) => sum + walletBalance(w.id), 0)
  },
  // Last `count` months ending with the current month (oldest first).
  monthlyTrend(count = 6) {
    const out = []
    const now = new Date()
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const income = state.incomes.filter((r) => monthKey(r.date) === key && isDue(r) && isActive(r)).reduce((s, r) => s + r.amount, 0)
      const expense = state.expenses.filter((r) => monthKey(r.date) === key && isDue(r) && isActive(r)).reduce((s, r) => s + r.amount, 0)
      out.push({ month: key, label: d.toLocaleDateString(undefined, { month: 'short' }), income, expense, net: income - expense })
    }
    return out
  },
  // Everything that touched a wallet: incomes, expenses and both sides of a
  // transfer, with transfers tagged in/out relative to this wallet.
  walletTransactions(id) {
    const rows = []
    state.incomes.forEach((r) => {
      if (r.walletId === id && isDue(r) && isActive(r)) rows.push({ ...r, kind: 'income' })
    })
    state.expenses.forEach((r) => {
      if (r.walletId === id && isDue(r) && isActive(r)) rows.push({ ...r, kind: 'expense' })
    })
    state.transfers.forEach((t) => {
      if (isDue(t) && (t.fromId === id || t.toId === id)) rows.push({ ...t, kind: 'transfer', dir: t.toId === id ? 'in' : 'out', effDate: effectiveDate(t) })
    })
    state.debts.forEach((d) => {
      if (d.walletId === id && isActive(d)) rows.push({ ...d, kind: 'debt' })
    })
    return rows.sort((a, b) => {
      const da = a.effDate || a.date
      const db = b.effDate || b.date
      return da === db ? 0 : (da < db ? 1 : -1)
    })
  },

  // Formatting
  formatMoney,
  formatDate,

  // Data in/out
  importCSVText,
  importReport() {
    return {
      wallets: state.wallets.length,
      incomes: state.incomes.length,
      expenses: state.expenses.length,
      transfers: state.transfers.length,
      categories: state.categories.length,
      sources: state.sources.length,
      goals: state.goals.length,
      assets: state.assets.length,
      debts: state.debts.length
    }
  },
  exportBackup() {
    // A full dump: settings, wallets, every transaction (income, expense,
    // transfer, debt), budgets/categories, income sources, goals and assets.
    return JSON.stringify({ app: 'Personal Cash Flow', kind: 'full-backup', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2)
  },
  importBackup(payload) {
    const data = payload && payload.data && typeof payload.data === 'object' ? payload.data : payload
    if (!data || typeof data !== 'object') return false
    const allowed = ['wallets', 'categories', 'sources', 'goals', 'incomes', 'expenses', 'transfers', 'assets', 'debts']
    if (!allowed.some((key) => Array.isArray(data[key]))) return false
    const restored = migrate(data)
    // migrate() falls back to the starter data when a collection is empty, so a
    // backup that deliberately holds none of something is restored exactly.
    allowed.forEach((key) => {
      if (Array.isArray(data[key]) && data[key].length === 0) restored[key] = []
    })
    state = restored
    save()
    return true
  },
  resetAll() {
    state = defaultState()
    save()
  }
}

export default store
