// Personal Cash Flow — data layer.
// Everything lives in localStorage, so the app works fully offline.

const STORAGE_KEY = 'personal-cash-flow-v1'

export const WALLET_TYPES = ['In Hand', 'Digital Wallet', 'Safe']
export const WALLET_STATUS = ['Available', 'Freezed']
export const WALLET_CURRENCY = ['', '$', 'E£', 'EGP', '€', 'SAR', 'AED']

const PALETTE = [
  '#5b8cff', '#a06bff', '#22b07d', '#e8a51c', '#14b8a6',
  '#f472b6', '#38bdf8', '#fb923c', '#a3e635', '#facc15',
  '#e879f9', '#f87171', '#60a5fa'
]

// Seed data mirrors the Notion export this app was built from: the wallet
// list, expense categories and their monthly budgets, and income sources.
const DEFAULT_WALLETS = [
  { name: 'Mini Pocket', type: 'In Hand', status: 'Available', opening: 200 },
  { name: 'Cashed', type: 'In Hand', status: 'Available', opening: 3110 },
  { name: 'Saved Cash', type: 'Safe', status: 'Available', opening: 21000 },
  { name: 'RedToPay Virtual Card', type: 'Digital Wallet', status: 'Available', opening: 0, currency: '?1.60' },
  { name: 'SproutGigs Wallet', type: 'Digital Wallet', status: 'Freezed', opening: 0, currency: '?2.97' },
  { name: 'EasyPay Visa Card', type: 'Digital Wallet', status: 'Available', opening: 42 },
  { name: '5amsat Wallet', type: 'Digital Wallet', status: 'Freezed', opening: 0, currency: '?20.00' },
  { name: 'PayPal Wallet', type: 'Digital Wallet', status: 'Available', opening: 0 },
  { name: 'Etisalat Cash', type: 'Digital Wallet', status: 'Available', opening: 41.7 },
  { name: 'Vodafone Cash', type: 'Digital Wallet', status: 'Available', opening: 783 },
  { name: 'AAIB Visa Card', type: 'Digital Wallet', status: 'Available', opening: 1662 }
]

const DEFAULT_CATEGORIES = [
  { name: 'Other', budget: 1000 },
  { name: 'Debt', budget: 500 },
  { name: 'Entertainment', budget: 4000 },
  { name: 'Transportation', budget: 600 },
  { name: 'Bills', budget: 3000 },
  { name: 'Subscription', budget: 1000 },
  { name: 'Rent', budget: 1000 },
  { name: 'Work Transportation', budget: 800 },
  { name: 'Sport', budget: 1000 },
  { name: 'Health Care', budget: 500 },
  { name: 'Food & Drink', budget: 3000 },
  { name: 'Gym', budget: 200 },
  { name: 'Investment', budget: 5000 }
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

function isDue(record, now = new Date()) {
  const today = todayISO(now)
  if (record.date < today) return true
  if (record.date > today) return false
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

function clampColor(color, index) {
  const c = str(color, 20)
  return /^#[0-9a-f]{3,8}$/i.test(c) ? c : PALETTE[index % PALETTE.length]
}

function normalizeWallet(wallet) {
  return {
    id: wallet.id || uid('w'),
    name: str(wallet.name, 60) || 'Wallet',
    type: WALLET_TYPES.includes(wallet.type) ? wallet.type : 'In Hand',
    status: WALLET_STATUS.includes(wallet.status) ? wallet.status : 'Available',
    opening: parseMoney(wallet.opening),
    currency: str(wallet.currency, 12),
    note: str(wallet.note, 200)
  }
}

function normalizeCategory(category, index) {
  return {
    id: category.id || uid('c'),
    name: str(category.name, 40) || 'Category',
    budget: Math.max(0, parseMoney(category.budget)),
    color: clampColor(category.color, index || 0)
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
      const d = new Date(begin.getFullYear(), begin.getMonth() + i, dayOfMonth)
      if (d < begin) continue
      if (d.getMonth() !== (begin.getMonth() + i) % 12) continue
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
    excepted: rec.excepted === true
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
    sold: asset.sold === true || Math.abs(selling) > 0,
    walletId: str(asset.walletId, 60),
    date: isValidISO(asset.date) ? asset.date : '',
    sort: str(asset.sort, 40),
    note: str(asset.note, 400)
  }
}

function normalizeDebt(debt) {
  return {
    id: debt.id || uid('d'),
    person: str(debt.person, 80) || 'Someone',
    amount: Math.abs(parseMoney(debt.amount)),
    direction: debt.direction === 'Collect' ? 'Collect' : 'Lent',
    walletId: str(debt.walletId, 60),
    date: isValidISO(debt.date) ? debt.date : '',
    expectedDate: isValidISO(debt.expectedDate) ? debt.expectedDate : '',
    property: Boolean(debt.property),
    note: str(debt.note, 300),
    settled: debt.settled === true
  }
}

function defaultState() {
  return {
    version: 1,
    settings: { currency: '$', theme: 'dark', mainCurrency: 'EGP', secondaryCurrency: '$', exchangeRate: null, rateUpdatedAt: '' },
    wallets: DEFAULT_WALLETS.map(normalizeWallet),
    categories: DEFAULT_CATEGORIES.map(normalizeCategory),
    sources: DEFAULT_SOURCES.map((name) => normalizeSource({ name })),
    incomes: [],
    expenses: [],
    transfers: [],
    assets: [],
    debts: []
  }
}

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultState()
  const out = defaultState()
  out.settings = {
    currency: str(raw.settings && raw.settings.currency, 6) || '$',
    theme: raw.settings && raw.settings.theme === 'light' ? 'light' : 'dark',
    mainCurrency: str(raw.settings && raw.settings.mainCurrency, 12) || 'EGP',
    secondaryCurrency: str(raw.settings && raw.settings.secondaryCurrency, 12) || '$',
    exchangeRate: Number(raw.settings && raw.settings.exchangeRate) > 0 ? Number(raw.settings.exchangeRate) : null,
    rateUpdatedAt: str(raw.settings && raw.settings.rateUpdatedAt, 40)
  }
  if (Array.isArray(raw.wallets) && raw.wallets.length) out.wallets = raw.wallets.map(normalizeWallet)
  if (Array.isArray(raw.categories) && raw.categories.length) out.categories = raw.categories.map(normalizeCategory)
  if (Array.isArray(raw.sources) && raw.sources.length) out.sources = raw.sources.map(normalizeSource)
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

function walletBalance(id) {
  const wallet = state.wallets.find((w) => w.id === id)
  if (!wallet) return 0
  let total = wallet.opening
  state.incomes.forEach((r) => {
    if (r.walletId === id && isDue(r)) total += r.amount
  })
  state.expenses.forEach((r) => {
    if (r.walletId === id && isDue(r)) total -= r.amount
  })
  state.transfers.forEach((t) => {
    if (!isDue(t)) return
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
    total += d.direction === 'Lent' ? -d.amount : d.amount
  })
  return Math.round(total * 100) / 100
}

function monthItems(month) {
  const inMonth = (date) => monthKey(date) === month
  return {
    incomes: state.incomes.filter((r) => inMonth(r.date) && isDue(r)),
    expenses: state.expenses.filter((r) => inMonth(r.date) && isDue(r)),
    transfers: state.transfers.filter((r) => inMonth(r.date) && isDue(r))
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
    if (monthKey(r.date) !== month || !isDue(r)) return
    totals[r.categoryId] = (totals[r.categoryId] || 0) + r.amount
  })
  return totals
}

function sourceTotals(month) {
  const totals = {}
  state.incomes.forEach((r) => {
    if (monthKey(r.date) !== month || !isDue(r)) return
    totals[r.sourceId] = (totals[r.sourceId] || 0) + r.amount
  })
  return totals
}

function allTransactions() {
  const list = [
    ...state.incomes.filter((r) => isDue(r)).map((r) => ({ ...r, kind: 'income' })),
    ...state.expenses.filter((r) => isDue(r)).map((r) => ({ ...r, kind: 'expense' })),
    ...state.transfers.filter((r) => isDue(r)).map((t) => ({ ...t, kind: 'transfer' }))
  ]
  return list.sort((a, b) => a.date === b.date
    ? String(b.time || '').localeCompare(String(a.time || ''))
    : (a.date < b.date ? 1 : -1))
}

function repeatingSchedules(kind) {
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
    const upcoming = items.filter((item) => !isDue(item))
    if (!upcoming.length) return
    groups.set(`legacy-${kind}-${signature}`, { id: `legacy-${kind}-${signature}`, kind, repeat: 'scheduled', records: items })
  })

  return [...groups.values()].map((group) => {
    const upcoming = group.records.filter((record) => !isDue(record))
      .sort((a, b) => a.date === b.date
        ? String(a.time || '').localeCompare(String(b.time || ''))
        : (a.date < b.date ? -1 : 1))
    return { ...group, upcoming, next: upcoming[0] }
  }).filter((group) => group.upcoming.length > 0)
}

function nextScheduledAt() {
  const now = new Date()
  const pending = [...state.incomes, ...state.expenses, ...state.transfers]
    .filter((record) => !isDue(record))
    .map((record) => new Date(`${record.date}T${record.time || '00:00'}:00`))
    .filter((date) => Number.isFinite(date.getTime()) && date > now)
  const earliest = pending.reduce((timestamp, date) => Math.min(timestamp, date.getTime()), Infinity)
  return Number.isFinite(earliest) ? earliest : null
}

function netWorth() {
  const cash = state.wallets.reduce((sum, w) => sum + walletBalance(w.id), 0)
  const assets = state.assets.filter((a) => !a.sold).reduce((sum, a) => sum + a.buyingPrice, 0)
  const lent = state.debts.filter((d) => d.direction === 'Lent' && !d.settled).reduce((sum, d) => sum + d.amount, 0)
  const collected = state.debts.filter((d) => d.direction === 'Collect').reduce((sum, d) => sum + d.amount, 0)
  return { cash, assets, receivable: Math.max(0, lent - collected), total: Math.round((cash + assets + Math.max(0, lent - collected)) * 100) / 100 }
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
    const currency = pick(row, 'Dollar Currency')
    const existing = findByName(state.wallets, name)
    const payload = {
      name,
      type: WALLET_TYPES.includes(type) ? type : (existing ? existing.type : 'In Hand'),
      status: WALLET_STATUS.includes(status) ? status : (existing ? existing.status : 'Available'),
      opening: opening || balance || (existing ? existing.opening : 0),
      currency: currency || (existing ? existing.currency : '')
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
      amount,
      direction: /collect/i.test(pick(row, 'Status', 'Collect/Return')) ? 'Collect' : 'Lent',
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
    save()
  },
  setSecondaryCurrency(value) {
    state.settings.secondaryCurrency = str(value, 12) || '$'
    save()
  },
  async refreshRate() {
    const toCode = (v) => {
      const s = String(v || '').trim()
      if (s === '$') return 'USD'
      if (s === '€') return 'EUR'
      if (s === '£') return 'GBP'
      if (s === 'E£' || s.toUpperCase() === 'EGP') return 'EGP'
      return s.replace(/[^A-Za-z]/g, '').toUpperCase() || 'USD'
    }
    const from = toCode(state.settings.secondaryCurrency)
    const to = toCode(state.settings.mainCurrency)
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`)
      const data = await res.json()
      if (data && data.result === 'success' && data.rates && data.rates[to]) {
        state.settings.exchangeRate = Math.round(Number(data.rates[to]) * 100) / 100
        state.settings.rateUpdatedAt = new Date().toISOString()
        save()
        return { ok: true, rate: state.settings.exchangeRate }
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

  // Wallets
  getWallets() {
    return state.wallets.map((w) => ({ ...w, current: walletBalance(w.id) }))
  },
  findWallet(id) {
    return state.wallets.find((w) => w.id === id) || null
  },
  walletName,
  walletBalance,
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
    if (kind === 'income') state.incomes = state.incomes.filter((r) => r.id !== id)
    else if (kind === 'expense') state.expenses = state.expenses.filter((r) => r.id !== id)
    else state.transfers = state.transfers.filter((t) => t.id !== id)
    save()
  },

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
    return state.debts.map((d) => ({ ...d }))
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
  debtSummary() {
    const lent = state.debts.filter((d) => d.direction === 'Lent').reduce((sum, d) => sum + d.amount, 0)
    const collected = state.debts.filter((d) => d.direction === 'Collect').reduce((sum, d) => sum + d.amount, 0)
    return { lent, collected, outstanding: Math.max(0, lent - collected) }
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
      const income = state.incomes.filter((r) => monthKey(r.date) === key && isDue(r)).reduce((s, r) => s + r.amount, 0)
      const expense = state.expenses.filter((r) => monthKey(r.date) === key && isDue(r)).reduce((s, r) => s + r.amount, 0)
      out.push({ month: key, label: d.toLocaleDateString(undefined, { month: 'short' }), income, expense, net: income - expense })
    }
    return out
  },
  // Everything that touched a wallet: incomes, expenses and both sides of a
  // transfer, with transfers tagged in/out relative to this wallet.
  walletTransactions(id) {
    const rows = []
    state.incomes.forEach((r) => {
      if (r.walletId === id && isDue(r)) rows.push({ ...r, kind: 'income' })
    })
    state.expenses.forEach((r) => {
      if (r.walletId === id && isDue(r)) rows.push({ ...r, kind: 'expense' })
    })
    state.transfers.forEach((t) => {
      if (isDue(t) && (t.fromId === id || t.toId === id)) rows.push({ ...t, kind: 'transfer', dir: t.toId === id ? 'in' : 'out' })
    })
    return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
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
      categories: state.categories.length
    }
  },
  exportBackup() {
    return JSON.stringify({ app: 'Personal Cash Flow', kind: 'full-backup', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2)
  },
  importBackup(payload) {
    const data = payload && payload.data && typeof payload.data === 'object' ? payload.data : payload
    if (!data || typeof data !== 'object') return false
    const allowed = ['wallets', 'categories', 'sources', 'incomes', 'expenses', 'transfers', 'assets', 'debts']
    if (!allowed.some((key) => Array.isArray(data[key]))) return false
    state = migrate(data)
    save()
    return true
  },
  resetAll() {
    state = defaultState()
    save()
  }
}

export default store
