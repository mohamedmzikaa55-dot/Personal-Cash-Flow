import { store, WALLET_TYPES, WALLET_STATUS, WALLET_CURRENCY, WALLET_ICONS, WALLET_COLORS, CATEGORY_ICONS } from './store.js'

const app = document.getElementById('app')

let screen = 'home'
let modal = null
let modalPayload = null
let walletDetail = null
let deferredInstall = null
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; render() })
let month = store.monthKey(store.todayISO())
let txFilter = 'all'
let txPeriod = 'month'
// Activity list: free-text search, sort order and the optional wallet filter.
let txSearch = ''
let txSort = 'date-desc'
let txWallet = ''
// Budgets breakdown charts: 'month' or 'year' — Year makes the topbar arrows
// step twelve months at a time, like the Activity screen's year view.
let chartPeriod = 'month'
// Budgets screen: when on, every category / income source row shows its
// edit & delete controls instead of hiding them behind the edit form.
let budgetEdit = false
let dueRefreshTimer = null
let calMonth = null
let calSelected = null

// ---------- overlay history ----------
// Every modal / drill-down pushes a history entry so the Android back button,
// the iOS edge-swipe and the browser Back all dismiss it instead of leaving
// the app (or, on Android, closing it outright).
let pushedOverlays = 0
let suppressPop = false

function pushOverlay() {
  try {
    history.pushState({ pcf: 'overlay' }, '')
    pushedOverlays += 1
  } catch {}
}

function openModal(name, payload, replace) {
  if (!replace) pushOverlay()
  modal = name
  modalPayload = payload || null
  render()
}

function openWalletDetail(id) {
  walletDetail = id
  screen = 'wallets'
  pushOverlay()
  render()
}

// Close exactly one overlay layer (the modal on top, else the drill-down).
function closeTopOverlay() {
  if (modal) {
    modal = null
    modalPayload = null
    return true
  }
  if (walletDetail) {
    walletDetail = null
    return true
  }
  return false
}

function goBack() {
  if (!closeTopOverlay()) return
  if (pushedOverlays > 0) {
    pushedOverlays -= 1
    suppressPop = true
    try { history.back() } catch { suppressPop = false }
  }
  render()
}

window.addEventListener('popstate', () => {
  // A pop we triggered ourselves from goBack() — already handled.
  if (suppressPop) {
    suppressPop = false
    return
  }
  if (closeTopOverlay()) {
    pushedOverlays = Math.max(0, pushedOverlays - 1)
    render()
  }
})

// ---------- tiny helpers ----------

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
}

function money(value, withSign) {
  return store.formatMoney(value, withSign)
}

// Plain number with no currency symbol — for amounts that already carry their
// own currency code next to them (a wallet's second-currency balance).
function plainMoney(value) {
  return (Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// The symbol an ISO code is shown as, so the Settings rate rows read "1 $ = 48.5 E£".
const SYMBOL_BY_CODE = {
  USD: '$',
  EGP: 'E£',
  EUR: '€',
  GBP: '£',
  SAR: 'SAR',
  AED: 'AED',
  JPY: '¥'
}

function currencyLabel(code) {
  const key = String(code || '').toUpperCase()
  return SYMBOL_BY_CODE[key] || key
}

// One editable rate per currency the wallet balances actually use: the secondary
// currency plus every wallet that keeps a second balance in another currency.
function rateRowsHtml() {
  const settings = store.getSettings()
  const codes = store.rateCurrencies()
  if (!codes.length) {
    return '<p class="muted tight" style="margin-top:10px">No other currency is in use yet — give a wallet a balance in another currency and its rate shows up here.</p>'
  }
  const rows = codes.map((code) => {
    const label = currencyLabel(code)
    const rate = store.rateFor(code)
    return `
      <div class="rate-row">
        <span class="rate-name">1 ${escapeHtml(label)}</span>
        <input data-rate="${escapeHtml(code)}" type="number" step="0.0001" min="0" inputmode="decimal" value="${rate ? escapeHtml(String(rate)) : ''}" placeholder="0.0000" aria-label="Rate for ${escapeHtml(label)}" />
        <span class="muted tight">${escapeHtml(settings.mainCurrency)}</span>
      </div>`
  }).join('')
  return `<div class="rate-list">${rows}</div>`
}

function ratesUpdatedLabel() {
  const stamp = store.rateUpdatedAt()
  const codes = store.rateCurrencies()
  if (!codes.length) return 'Nothing to convert yet'
  const known = codes.filter((code) => store.rateFor(code) > 0).length
  const when = stamp ? ` · updated ${escapeHtml(store.formatDate(String(stamp).slice(0, 10)))}` : ''
  return `${known} of ${codes.length} rate${codes.length === 1 ? '' : 's'} saved${when}`
}

function repeatLabel(repeat) {
  if (repeat === 'weekly') return 'Every week'
  if (repeat === 'monthly') return 'Every month'
  if (repeat === 'custom') return 'Custom schedule'
  return 'Scheduled series'
}

function repeatingScheduleRow(schedule) {
  const { kind, next, upcoming, skipped, repeat, id } = schedule
  const isIncome = kind === 'income'
  const detail = isIncome
    ? store.sourceName(next.sourceId) || 'Income'
    : store.categoryName(next.categoryId) || 'Uncategorised'
  return `
    <article class="item">
      <span class="avatar" style="background:${isIncome ? 'var(--green)' : 'var(--red)'}">${icon(isIncome ? 'up' : 'down')}</span>
      <div class="body">
        <div class="title">${escapeHtml(next.name)}</div>
        <div class="meta">${escapeHtml(repeatLabel(repeat))} · next ${escapeHtml(store.formatDate(next.date))} at ${escapeHtml(next.time || '00:00')}</div>
        <div class="meta">${escapeHtml(detail)} · ${upcoming.length} remaining${skipped ? ` · ${skipped} skipped` : ''}</div>
      </div>
      <div class="repeat-actions">
        <div class="amount ${isIncome ? 'pos' : 'neg'} mono">${isIncome ? '+' : '−'}${money(next.amount)}</div>
        <div class="row-actions">
          <button class="mini-btn" type="button" data-action="edit-transaction" data-kind="${kind}" data-id="${next.id}" aria-label="Edit schedule" title="Edit this schedule">${icon('edit')}</button>
          <button class="mini-btn" type="button" data-action="open-schedule" data-kind="${kind}" data-id="${escapeHtml(id)}" aria-label="Manage dates" title="Open calendar">${icon('cal')}</button>
          <button class="mini-btn danger" type="button" data-action="end-series" data-kind="${kind}" data-id="${escapeHtml(id)}" aria-label="End recurring series" title="End this recurring series">${icon('trash')}</button>
        </div>
      </div>
    </article>
  `
}

function repeatingScheduleDisclosure(kind, label) {
  const schedules = store.getRepeatingSchedules(kind)
  return `
    <details class="repeat-disclosure">
      <summary>
        <span>${label}</span>
        <span class="badge">${schedules.length} schedule${schedules.length === 1 ? '' : 's'}</span>
      </summary>
      <div class="list">
        ${schedules.length ? schedules.map(repeatingScheduleRow).join('') : emptyState(`No repeated ${kind} scheduled.`, 'cal')}
      </div>
    </details>
  `
}

function icon(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 7a2 2 0 0 1 2-2h11v3"/><path d="M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H6"/><circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V5M16 20v-7M22 20H2"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8l-4-4L4 16z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    transfer: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
    cal: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M5.5 5h13l1.5 8v5a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
    // Wallet / account type glyphs used by the wallet cards.
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6 15h4"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6"/><path d="M5 10v9M10 10v9M14 10v9M19 10v9"/><path d="M3 20h18"/></svg>',
    safe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="12" cy="12" r="3.4"/><path d="M12 5.5v3M12 15.5v3"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.5 18.5h3"/></svg>',
    piggy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a6 6 0 0 1 6-6h4.5a5.5 5.5 0 0 1 5.5 5.5V15a2 2 0 0 1-2 2h-1v1.5a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1V18H9v1.5a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1V17.6A5.4 5.4 0 0 1 4 14.6V13Z"/><path d="M8.5 8 7 4.5M15.5 12h.01"/></svg>',
    gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l3 5-9 13L3 8l3-5Z"/><path d="M3 8h18M9.5 8 12 21 14.5 8M6 3l3.5 5M18 3l-3.5 5"/></svg>',
    // Category glyphs, offered by the category editor's icon picker.
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6.6l9.4 9.4-6.6 6.6L4 10.6z"/><circle cx="8.4" cy="8.4" r="1.2"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.2l2.2 11.4h11.4L21 7.6H6.4"/><circle cx="9.2" cy="19.2" r="1.4"/><circle cx="17.6" cy="19.2" r="1.4"/></svg>',
    food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v5.5a2 2 0 0 0 4 0V3"/><path d="M9 11v10"/><path d="M17 3c-1.7 0-3 1.8-3 4s1.3 4 3 4v10"/></svg>',
    coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5h13V13a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9.5h1.8a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3.2v2.4M12 3.2v2.4"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 14.5 5 9.6A2 2 0 0 1 6.9 8.2h10.2a2 2 0 0 1 1.9 1.4L20.5 14.5v4.3h-2.6v-1.7H6.1v1.7H3.5z"/><circle cx="7.2" cy="14.6" r="1.2"/><circle cx="16.8" cy="14.6" r="1.2"/></svg>',
    bus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="12.5" rx="2.5"/><path d="M4 10.5h16M8.5 4.5v6M15.5 4.5v6"/><circle cx="8" cy="19" r="1.2"/><circle cx="16" cy="19" r="1.2"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 21h7M12 17v4"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17.5V6l10-2.2v11.7"/><circle cx="6.5" cy="17.8" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>',
    dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4M6.5 8.5v7M17.5 8.5v7M20 10v4M6.5 12h11"/></svg>',
    health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-7-9.5A3.9 3.9 0 0 1 12 6.9a3.9 3.9 0 0 1 7 3.6c0 4.9-7 9.5-7 9.5z"/></svg>',
    pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h11a2 2 0 0 1 2 2V20H8a2 2 0 0 1-2-2z"/><path d="M9.5 3.5V20"/></svg>',
    shirt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3 4 5.8l1.8 3 1.7-.9V20h9V7.9l1.7.9 1.8-3L15.5 3a3.5 3.5 0 0 1-7 0z"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13.2h16M12 9v11"/><path d="M12 9C10.3 9 8 8.2 8 6.3A2.3 2.3 0 0 1 12 5a2.3 2.3 0 0 1 4 1.3C16 8.2 13.7 9 12 9z"/></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 3.5 3.8 11l6 2.2 2.2 6z"/><path d="m9.8 13.2 10.7-9.7"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="7" rx="6.5" ry="3.2"/><path d="M5.5 7v4.5c0 1.8 2.9 3.2 6.5 3.2s6.5-1.4 6.5-3.2V7"/><path d="M5.5 11.5V16c0 1.8 2.9 3.2 6.5 3.2s6.5-1.4 6.5-3.2v-4.5"/></svg>',
    pet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="9.5" r="1.7"/><circle cx="12" cy="7.6" r="1.7"/><circle cx="17" cy="9.5" r="1.7"/><path d="M12 20c-2.9 0-5-1.7-5-3.9 0-1.6 1.3-2.9 3-2.9h4c1.7 0 3 1.3 3 2.9 0 2.2-2.1 3.9-5 3.9z"/></svg>',
    baby: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 10.3h.01M15 10.3h.01"/><path d="M9 15c.8.9 1.9 1.4 3 1.4s2.2-.5 3-1.4"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5a12 12 0 0 1 16 0"/><path d="M7 13a8 8 0 0 1 10 0"/><path d="M10 16.4a4 4 0 0 1 4 0"/><circle cx="12" cy="19.4" r="1"/></svg>',
    game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="9.5" rx="4.5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.6" r="1"/><circle cx="18.2" cy="13.8" r="1"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
  }
  return icons[name] || ''
}

// Friendly empty state with an optional icon so lists never look broken.
function emptyState(text, iconName) {
  return `<div class="empty">${iconName ? `<span class="empty-ico">${icon(iconName)}</span>` : ''}<span>${escapeHtml(text)}</span></div>`
}

function shiftMonth(delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// On Activity with the Year filter the arrows step a year at a time.
function monthStep() {
  if (screen === 'activity' && txPeriod === 'year') return 12
  // Budgets breakdown charts in year mode step the topbar pager by a year too.
  if (screen === 'budgets' && chartPeriod === 'year') return 12
  return 1
}

function walletSelect(selected, name, required = true) {
  return `<select name="${name}" ${required ? 'required' : ''}>
    <option value="">${required ? 'Choose wallet…' : 'No wallet'}</option>
    ${store.getWallets().map((w) => `<option value="${w.id}" ${w.id === selected ? 'selected' : ''}>${escapeHtml(w.name)} · ${money(store.walletTotal(w.id))}</option>`).join('')}
  </select>`
}

// Which weekday boxes the weekly repeat panel should pre-check. Editing an
// existing series uses its stored days; older records whose days were lost
// (the boxes were never checked before) fall back to the occurrence's own
// weekday so a plain save no longer wipes the schedule.
function weeklyDaysFor(r) {
  if (Array.isArray(r.weekDays) && r.weekDays.length) {
    return r.weekDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  }
  if (r.date && r.repeat === 'weekly') {
    const dow = new Date(`${r.date}T00:00:00`).getDay()
    return Number.isInteger(dow) ? [dow] : []
  }
  return []
}

// Modal kind -> state collection used for the edit lookup.
const COLLECTIONS = {
  wallet: 'wallets',
  category: 'categories',
  source: 'sources',
  asset: 'assets',
  debt: 'debts',
  goal: 'goals',
  income: 'incomes',
  expense: 'expenses',
  transfer: 'transfers'
}

function findRecord(kind, id) {
  const list = store.getState()[COLLECTIONS[kind]] || []
  return list.find((item) => item.id === id) || null
}

function optionSelect(list, selected, name) {
  return `<select name="${name}">
    <option value="">—</option>
    ${list.map((item) => `<option value="${item.id}" ${item.id === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
  </select>`
}

// ---------- screens ----------

function renderDashboard() {
  const totals = store.netWorth()
  const summary = store.monthSummary(month)
  const wallets = store.getWallets()
  const catTotals = store.categoryTotals(month)
  const budgets = store.getCategories()
    .map((c) => ({ ...c, spent: catTotals[c.id] || 0 }))
    .filter((c) => c.budget > 0)
    .sort((a, b) => (b.spent / (b.budget || 1)) - (a.spent / (a.budget || 1)))
    .slice(0, 4)
  const recent = store.getTransactions().slice(0, 6)

  return `
    <div class="topbar">
      <div>
        <p class="kicker">Personal Cash Flow</p>
        <h1>Overview</h1>
      </div>
      <button class="ghost-btn compact" data-screen="more">Settings</button>
    </div>
    <section class="hero">
      <div class="hero-top">
        <div>
          <span class="label">Total balance</span>
          <div class="value mono">${money(totals.cash)}</div>
          <div class="sub">${wallets.length} wallets · net worth ${money(totals.total)}</div>
        </div>
        <span class="pill ${summary.net >= 0 ? 'pos' : 'neg'}">${summary.net >= 0 ? '▲' : '▼'} ${money(summary.net)}</span>
      </div>
      <div class="hero-tiles">
        <div class="tile income">
          <span class="tile-label">${icon('up')} Income</span>
          <span class="tile-figure mono">${money(summary.income)}</span>
        </div>
        <div class="tile expense">
          <span class="tile-label">${icon('down')} Expense</span>
          <span class="tile-figure mono">${money(summary.expense)}</span>
        </div>
        <div class="tile rate ${summary.net < 0 ? 'neg' : ''}">
          <span class="tile-label">Save rate</span>
          <span class="ring" role="img" aria-label="Save rate ${summary.rate}%" style="--p:${Math.max(0, Math.min(100, summary.rate))}%"><span>${summary.rate}%</span></span>
          <span class="tile-figure">${summary.net < 0 ? `${money(Math.abs(summary.net))} over` : `${money(summary.net)} kept`}</span>
        </div>
      </div>
      <p class="sub" style="margin-top:12px">${escapeHtml(store.monthLabel(month))} · assets ${money(totals.assets)} · receivable ${money(totals.receivable)}</p>
      ${walletsTotalsLine(totals)}
    </section>

    ${renderTrend()}

    ${renderGoalsCompact()}

    <section class="section">
      <div class="section-head">
        <h2>Wallets</h2>
        <button class="ghost-btn compact" data-screen="wallets">View all</button>
      </div>
      <div class="list">
        ${wallets.length ? wallets.slice(0, 4).map(walletRow).join('') : emptyState('No wallets yet. Add one from the Wallets tab.', 'wallet')}
      </div>
    </section>

    ${budgets.length ? `
    <section class="section">
      <div class="section-head"><h2>Budget usage</h2></div>
      <div class="list">${budgets.map(budgetBar).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="section-head">
        <h2>Recent activity</h2>
        <button class="ghost-btn compact" data-screen="activity">View all</button>
      </div>
      <div class="list">${recent.length ? recent.map(txRow).join('') : emptyState('No transactions yet. Tap + to add income, an expense or a transfer.', 'inbox')}</div>
    </section>
  `
}

// Wallet colours: the palette the app assigns to categories too, so every
// wallet card in the list gets its own tile colour.
// Stable per wallet name, so a restored backup keeps the same colours.
function walletColor(wallet) {
  if (wallet && wallet.color) return wallet.color
  const key = String((wallet && (wallet.name || wallet.id)) || '')
  let sum = 0
  for (let i = 0; i < key.length; i += 1) sum = (sum + key.charCodeAt(i) * (i + 1)) % 9973
  return WALLET_COLORS[sum % WALLET_COLORS.length]
}

// Soft tint of a hex colour, for the tile behind the wallet glyph.
function softColor(hex, alpha) {
  const raw = String(hex || '').replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const num = Number.parseInt(full.slice(0, 6), 16)
  if (!Number.isFinite(num)) return 'var(--accent-soft)'
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha == null ? 0.16 : alpha})`
}

// Glyph for the wallet's type, used when the user has not picked an icon.
function walletTypeIcon(wallet) {
  const type = String(wallet && wallet.type || '')
  if (type === 'Safe') return icon('safe')
  if (type === 'Digital Wallet') return icon('card')
  return icon('cash')
}

// The wallet's glyph: the icon the user picked, else one for its type.
function walletIcon(wallet) {
  if (wallet && wallet.icon && WALLET_ICONS.includes(wallet.icon)) return icon(wallet.icon)
  return walletTypeIcon(wallet)
}

function walletCardStyle(wallet) {
  const color = walletColor(wallet)
  return `--wc:${color};--wc-soft:${softColor(color)}`
}

function walletAvatar(wallet) {
  const frozen = wallet.status === 'Freezed'
  const color = frozen ? 'var(--muted)' : walletColor(wallet)
  const background = frozen ? 'var(--card-2)' : softColor(color)
  return `<span class="avatar ${frozen ? 'frozen' : ''}" style="background:${background};color:${color}">${walletIcon(wallet)}</span>`
}

// Explain what a wallet's second-currency balance is worth in the main
// currency — and say so plainly when no rate is known for it.
function walletForeignHint(wallet) {
  const settings = store.getSettings()
  const amount = Number(wallet.foreign) || 0
  const currency = wallet.currency || ''
  const main = settings.mainCurrency
  if (!amount) return `Add a balance in another currency to have it counted in the wallet total${currency ? '' : '.'}`
  if (!currency) return `${plainMoney(amount)} is counted as ${escapeHtml(main)} — pick a currency above to convert it instead.`
  if (currency === main || store.currencyCode(currency) === store.currencyCode(main)) {
    return `${plainMoney(amount)} ${escapeHtml(currency)} is already your main currency.`
  }
  const rate = store.rateFor(currency)
  const converted = store.toMainCurrency(amount, currency)
  if (converted === null) {
    return `No rate saved for ${escapeHtml(currency)} → ${escapeHtml(main)}, so it is left out of the total. Set it under Settings → Currency.`
  }
  return `${plainMoney(amount)} ${escapeHtml(currency)} ≈ ${money(converted)} ${escapeHtml(main)} (1 ${escapeHtml(currency)} = ${rate} ${escapeHtml(main)}), counted in the wallet total.`
}

// Live version used while the wallet form is being filled in.
function refreshWalletForeignHint() {
  const hint = document.getElementById('wallet-foreign-hint')
  if (!hint) return
  const form = hint.closest('form')
  if (!form) return
  const foreign = form.querySelector('input[name="foreign"]')
  const currency = form.querySelector('select[name="currency"]')
  hint.innerHTML = walletForeignHint({
    foreign: foreign ? Number(foreign.value) || 0 : 0,
    currency: currency ? currency.value : ''
  })
}

// Wallet total split into the pieces the totals are built from.
function walletBreakdown(wallet) {
  const settings = store.getSettings()
  const balance = store.walletBalance(wallet.id)
  const allowable = Math.max(0, Number(wallet.allowable) || 0)
  const converted = store.toMainCurrency(wallet.foreign, wallet.currency)
  return {
    balance,
    allowable,
    spendable: store.walletSpendable(wallet.id),
    foreign: Number(wallet.foreign) || 0,
    currency: wallet.currency || '',
    rate: store.rateFor(wallet.currency),
    converted,
    total: store.walletTotal(wallet.id)
  }
}

function walletBreakdownText(parts) {
  const bits = [`Start + moves ${money(parts.balance)}`]
  if (parts.allowable) bits.push(`allowable ${money(parts.allowable)}`)
  if (parts.foreign) {
    bits.push(parts.converted === null
      ? `${plainMoney(parts.foreign)} ${escapeHtml(parts.currency)} (no rate)`
      : `${plainMoney(parts.foreign)} ${escapeHtml(parts.currency)} ≈ ${money(parts.converted)}`)
  }
  return bits.join(' · ')
}

// What the total balance is made of: the wallet balances in the main currency,
// the amount allowed on top of them, and any second balance held in another
// currency. Wallets whose other currency has no saved rate are counted out
// rather than silently added up wrong.
function walletsTotalsLine(totals) {
  const settings = store.getSettings()
  const main = escapeHtml(settings.mainCurrency)
  const bits = [`${main} balance ${money(totals.main)}`]
  if (totals.allowable) bits.push(`allowable ${money(totals.allowable)}`)
  totals.currencies.forEach((c) => {
    const label = currencyLabel(c.code)
    bits.push(c.rated
      ? `${label} ${plainMoney(c.amount)} ≈ ${money(c.main)}`
      : `${label} ${plainMoney(c.amount)} (no rate)`)
  })
  if (totals.unrated) bits.push(`${totals.unrated} wallet${totals.unrated === 1 ? '' : 's'} not converted — set the rate in Settings`)
  return `<p class="sub" style="margin-top:4px">Wallets: ${bits.join(' · ')}</p>`
}

function walletRow(wallet) {
  const parts = walletBreakdown(wallet)
  return `
    <article class="item" data-action="open-wallet" data-id="${wallet.id}">
      ${walletAvatar(wallet)}
      <div class="body">
        <div class="title">${escapeHtml(wallet.name)}</div>
        <div class="meta"><span class="badge ${wallet.status === 'Freezed' ? 'red' : 'green'}">${wallet.status}</span>${escapeHtml(wallet.type)}${parts.foreign && parts.currency ? ` · ${escapeHtml(parts.currency)} ${plainMoney(parts.foreign)}` : ''}</div>
        <div class="meta">${walletBreakdownText(parts)}</div>
      </div>
      <div class="amount ${parts.total < 0 ? 'neg' : ''} mono">${money(parts.total)}</div>
    </article>
  `
}

function renderTrend() {
  const data = store.monthlyTrend(6)
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)))
  return `
    <section class="section">
      <div class="section-head"><h2>Cash flow</h2><span class="item-meta">${data.length} months</span></div>
      <div class="card">
        <div class="chart">
          ${data.map((d) => `
            <div class="chart-col" title="${escapeHtml(store.monthLabel(d.month))}: +${money(d.income)} / -${money(d.expense)}">
              <div class="chart-bars">
                <i style="height:${Math.max(3, Math.round((d.income / max) * 100))}%;background:var(--green)"></i>
                <i style="height:${Math.max(3, Math.round((d.expense / max) * 100))}%;background:var(--red)"></i>
              </div>
              <span class="chart-x">${escapeHtml(d.label)}</span>
            </div>
          `).join('')}
        </div>
        <div class="legend">
          <span><i style="background:var(--green)"></i>Income ${money(data.reduce((s, d) => s + d.income, 0))}</span>
          <span><i style="background:var(--red)"></i>Expense ${money(data.reduce((s, d) => s + d.expense, 0))}</span>
        </div>
      </div>
    </section>
  `
}

function budgetBar(category) {
  const pct = category.budget > 0 ? Math.round((category.spent / category.budget) * 100) : 0
  const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''
  const pctCls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''
  // The chosen icon, or the category's initial when none is set.
  const glyph = category.icon
    ? icon(category.icon)
    : escapeHtml((category.name || '?').trim().charAt(0).toUpperCase())
  return `
    <div class="budget-row">
      <div class="top">
        <span><span class="cat-tile" style="background:${softColor(category.color)};color:${escapeHtml(category.color)}">${glyph}</span>${escapeHtml(category.name)}</span>
        <span class="mono"><b>${money(category.spent)}</b> <span class="muted">/ ${money(category.budget)}</span></span>
        <span class="pct ${pctCls}">${pct}%</span>
      </div>
      <div class="bar"><span class="${cls}" style="width:${Math.min(100, pct)}%"></span></div>
      <div class="muted" style="font-size:11.5px">${pct}% used · ${money(Math.max(0, category.budget - category.spent))} left</div>
    </div>
  `
}

function txRow(tx) {
  let avatar = ''
  let title = ''
  let meta = ''
  let amount = ''
  if (tx.kind === 'income') {
    avatar = `<span class="avatar income">${icon('up')}</span>`
    title = escapeHtml(tx.name)
    meta = `${escapeHtml(store.sourceName(tx.sourceId) || 'Income')} · ${escapeHtml(store.walletName(tx.walletId) || 'No wallet')} · ${store.formatDate(tx.date)}${tx.time ? ' · ' + tx.time : ''}`
    amount = `<div class="amount pos mono">+${money(tx.amount)}</div>`
  } else if (tx.kind === 'expense') {
    avatar = `<span class="avatar expense">${icon('down')}</span>`
    title = escapeHtml(tx.name)
    meta = `${escapeHtml(store.categoryName(tx.categoryId) || 'Uncategorised')} · ${escapeHtml(store.walletName(tx.walletId) || 'No wallet')} · ${store.formatDate(tx.date)}${tx.time ? ' · ' + tx.time : ''}`
    amount = `<div class="amount neg mono">-${money(tx.amount)}</div>`
  } else {
    avatar = `<span class="avatar transfer">${icon('transfer')}</span>`
    title = `Transfer${tx.pending ? ' <span class="badge gold">Pending</span>' : ''}`
    meta = `${escapeHtml(store.walletName(tx.fromId) || '?')} → ${escapeHtml(store.walletName(tx.toId) || '?')} · ${store.formatDate(tx.date)}${tx.time ? ' · ' + tx.time : ''}${tx.releasedDate ? ` · released ${store.formatDate(tx.releasedDate)}` : ''}`
    amount = `<div class="amount mono" ${tx.pending ? 'style="opacity:.55"' : ''}>${money(tx.amount)}</div>`
  }
  return `
    <article class="item" data-action="edit-transaction" data-kind="${tx.kind}" data-id="${tx.id}">
      ${avatar}
      <div class="body">
        <div class="title">${title}</div>
        <div class="meta">${meta}</div>
      </div>
      ${amount}
    </article>
  `
}

function pendingTransferRow(tx) {
  return `
    <article class="item">
      <span class="avatar transfer">${icon('transfer')}</span>
      <div class="body">
        <div class="title">${escapeHtml(store.walletName(tx.fromId) || '?')} → ${escapeHtml(store.walletName(tx.toId) || '?')}</div>
        <div class="meta">${money(tx.amount)}${tx.fee ? ` + fee ${money(tx.fee)}` : ''} · ${store.formatDate(tx.date)}${tx.time ? ' · ' + tx.time : ''}</div>
      </div>
      <div class="row-actions">
        <button class="mini-btn" data-action="edit-transaction" data-kind="transfer" data-id="${tx.id}" title="Edit" aria-label="Edit pending transfer">${icon('edit')}</button>
        <button class="ghost-btn compact" data-action="release-pending" data-id="${tx.id}">Release</button>
      </div>
    </article>
  `
}

// ---------- activity period filters ----------

// Day/Week always follow today; Month/Year follow the month the user has
// navigated to, so the arrows still work (year steps by 12 months).
function periodRange(period) {
  const today = store.todayISO()
  if (period === 'day') return { from: today, to: today }
  if (period === 'week') {
    const start = new Date(`${today}T00:00:00`)
    start.setDate(start.getDate() - start.getDay())
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { from: store.todayISO(start), to: store.todayISO(end) }
  }
  if (period === 'year') {
    const y = month.slice(0, 4)
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}

function periodTitle(period, range) {
  if (period === 'day') return store.formatDate(range.from)
  if (period === 'week') return `${store.formatDate(range.from)} – ${store.formatDate(range.to)}`
  if (period === 'year') return range.from.slice(0, 4)
  return store.monthLabel(month)
}

function periodWord(period) {
  if (period === 'day') return 'today'
  if (period === 'week') return 'this week'
  if (period === 'year') return 'this year'
  return 'this month'
}

// ---------- activity filtering / sorting ----------

const TX_SORTS = [
  ['date-desc', 'Date: newest first'],
  ['date-asc', 'Date: oldest first'],
  ['amount-desc', 'Amount: high to low'],
  ['amount-asc', 'Amount: low to high']
]

// Free-text search covers the description, its category / income source, the
// wallets involved, the kind, the date and the amount.
function txHaystack(t) {
  const bits = [t.name, t.kind]
  if (t.kind === 'income') bits.push(store.sourceName(t.sourceId))
  if (t.kind === 'expense') bits.push(store.categoryName(t.categoryId))
  if (t.kind === 'transfer') bits.push(store.walletName(t.fromId), store.walletName(t.toId))
  bits.push(store.walletName(t.walletId), t.effDate || t.date, String(t.amount))
  return bits.filter(Boolean).join(' ').toLowerCase()
}

// Transactions matching the active period, kind, wallet and search — already
// sorted in the chosen order.
function visibleTransactions() {
  const range = periodRange(txPeriod)
  const q = txSearch.trim().toLowerCase()
  const list = store.getTransactions().filter((t) => {
    const d = t.effDate || t.date
    if (d < range.from || d > range.to) return false
    if (txFilter !== 'all' && t.kind !== txFilter) return false
    if (txWallet) {
      const ids = t.kind === 'transfer' ? [t.fromId, t.toId] : [t.walletId]
      if (!ids.includes(txWallet)) return false
    }
    if (q && !txHaystack(t).includes(q)) return false
    return true
  })
  const amount = (t) => Math.abs(Number(t.amount) || 0)
  const dateOf = (t) => t.effDate || t.date
  const byDateDesc = (a, b) => (dateOf(a) === dateOf(b)
    ? String(b.time || '').localeCompare(String(a.time || ''))
    : (dateOf(a) < dateOf(b) ? 1 : -1))
  const byDateAsc = (a, b) => (dateOf(a) === dateOf(b)
    ? String(a.time || '').localeCompare(String(b.time || ''))
    : (dateOf(a) < dateOf(b) ? -1 : 1))
  const comparators = {
    'date-asc': byDateAsc,
    'amount-desc': (a, b) => amount(b) - amount(a) || byDateDesc(a, b),
    'amount-asc': (a, b) => amount(a) - amount(b) || byDateDesc(a, b)
  }
  return list.sort(comparators[txSort] || byDateDesc)
}

function sortOptions() {
  return TX_SORTS.map(([value, label]) =>
    `<option value="${value}" ${txSort === value ? 'selected' : ''}>${label}</option>`).join('')
}

function walletFilterOptions() {
  const list = store.getWallets().map((w) =>
    `<option value="${w.id}" ${txWallet === w.id ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')
  return `<option value="" ${txWallet ? '' : 'selected'}>All wallets</option>${list}`
}

// Period label + income / expense / net for whatever the list currently shows.
function txSummaryHtml() {
  const range = periodRange(txPeriod)
  const inPeriod = store.getTransactions().filter((t) => {
    const d = t.effDate || t.date
    return d >= range.from && d <= range.to
  })
  const list = visibleTransactions()
  const income = list.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = list.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expense
  const count = list.length === inPeriod.length
    ? `${inPeriod.length} transaction${inPeriod.length === 1 ? '' : 's'}`
    : `${list.length} of ${inPeriod.length} transactions`
  return `
    <p class="muted tight" style="margin-bottom:8px">${escapeHtml(periodTitle(txPeriod, range))} · ${count}</p>
    <div class="hero-tiles" style="margin-top:0">
      <div class="tile income">
        <span class="tile-label">${icon('up')} Income</span>
        <span class="tile-figure mono">${money(income)}</span>
      </div>
      <div class="tile expense">
        <span class="tile-label">${icon('down')} Expense</span>
        <span class="tile-figure mono">${money(expense)}</span>
      </div>
      <div class="tile">
        <span class="tile-label">Net</span>
        <span class="tile-figure mono ${net >= 0 ? '' : 'neg'}">${money(net)}</span>
      </div>
    </div>
  `
}

function txListHtml() {
  const list = visibleTransactions()
  if (!list.length) {
    const q = txSearch.trim()
    const reason = q
      ? `No transactions match "${q.length > 40 ? `${q.slice(0, 40)}…` : q}".`
      : `No ${txFilter === 'all' ? '' : `${txFilter} `}transactions ${periodWord(txPeriod)}${txWallet ? ' in this wallet' : ''}.`
    return emptyState(reason, 'inbox')
  }
  return list.map(txRow).join('')
}

// Live search / sort / wallet changes only swap the results in place, so the
// text field never loses focus or its caret.
function patchTxView() {
  const summary = document.getElementById('tx-results')
  if (summary) summary.innerHTML = txSummaryHtml()
  const list = document.getElementById('tx-list')
  if (list) list.innerHTML = txListHtml()
}

function renderTransactions() {
  const pendingTransfers = store.getTransfers().filter((t) => t.pending)
  const showsMonthNav = txPeriod === 'month' || txPeriod === 'year'
  const periodChips = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']]
  const kindChips = [['all', 'All'], ['income', 'Income'], ['expense', 'Expense'], ['transfer', 'Transfers']]
  return `
    <div class="topbar topbar-inline">
      <div>
        <p class="kicker">Cash flow</p>
        <h1>Activity</h1>
      </div>
      <div class="topbar-actions">
        ${showsMonthNav ? monthNav() : `<span class="pill">${txPeriod === 'day' ? 'Today' : 'This week'}</span>`}
      </div>
    </div>

    <section class="hero" style="padding:14px">
      <div id="tx-results">${txSummaryHtml()}</div>
    </section>

    <div class="filter-bar">
      <div class="search-field">
        ${icon('search')}
        <input id="tx-search" type="text" placeholder="Search description, category, wallet, amount…" value="${escapeHtml(txSearch)}" autocomplete="off" />
        <button class="search-clear" type="button" data-action="clear-search" aria-label="Clear search" tabindex="-1">${icon('close')}</button>
      </div>
      <div class="chip-row segmented">
        ${periodChips.map(([value, label]) =>
          `<button class="chip ${txPeriod === value ? 'on' : ''}" data-action="set-period" data-period="${value}">${label}</button>`
        ).join('')}
      </div>
      <div class="chip-row">
        ${kindChips.map(([value, label]) =>
          `<button class="chip ${txFilter === value ? 'on' : ''}" data-action="set-filter" data-filter="${value}">${label}</button>`
        ).join('')}
      </div>
      <div class="row2">
        <label>Sort by<select id="tx-sort">${sortOptions()}</select></label>
        <label>Wallet<select id="tx-wallet">${walletFilterOptions()}</select></label>
      </div>
    </div>

    <div class="list" id="tx-list">
      ${txListHtml()}
    </div>

    ${pendingTransfers.length ? `
    <section class="section" style="margin-top:18px">
      <div class="section-head">
        <h2>Pending transfers</h2>
        <button class="ghost-btn compact" data-action="release-all-pending">Release all</button>
      </div>
      <p class="muted tight" style="margin-bottom:10px">These transfers are waiting — release one to move the money between wallets.</p>
      <div class="list">
        ${pendingTransfers.map(pendingTransferRow).join('')}
      </div>
    </section>` : ''}
  `
}

// Short pager caption. The full "November 2026" made the month row too wide
// for a phone topbar, so it wrapped underneath the page title; the full label
// still shows in the hero and section headers.
function monthNavLabel() {
  if (monthStep() === 12) return month.slice(0, 4)
  const d = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return store.monthLabel(month)
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function monthNav() {
  return `
    <div class="month-nav">
      <button class="icon-btn sm" data-action="month-prev" aria-label="Previous month">${icon('left')}</button>
      <button class="ghost-btn compact month-nav-label" data-action="month-now" title="${escapeHtml(monthStep() === 12 ? `Jump to ${month.slice(0, 4)}` : store.monthLabel(month))}">${escapeHtml(monthNavLabel())}</button>
      <button class="icon-btn sm" data-action="month-next" aria-label="Next month">${icon('right')}</button>
    </div>
  `
}

// ---------- goals ----------

// Months a goal can be pinned to: "Every month" plus a two-year window around
// the current month, so a one-off budget is as easy to set as a standing one.
function goalMonthOptions(selected) {
  const [y, m] = store.monthKey(store.todayISO()).split('-').map(Number)
  const options = [`<option value="" ${selected ? '' : 'selected'}>Every month</option>`]
  for (let i = -12; i <= 11; i += 1) {
    const d = new Date(y, m - 1 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push(`<option value="${key}" ${key === selected ? 'selected' : ''}>${escapeHtml(store.monthLabel(key))}</option>`)
  }
  return options.join('')
}

function goalCard(goal) {
  const p = goal.progress
  const pct = p.limit > 0 ? Math.min(100, Math.round((p.spent / p.limit) * 100)) : 0
  const level = p.over > 0 ? 'over' : p.hit ? 'warn' : 'ok'
  const status = p.over > 0
    ? `${money(p.over)} over limit`
    : p.hit
      ? 'Limit reached'
      : `${money(p.remaining)} left`
  return `
    <article class="goal-card ${level}">
      <div class="goal-top">
        <span class="avatar goal-ico">${icon('target')}</span>
        <div class="body">
          <div class="title">${escapeHtml(goal.name)}${goal.month ? ` <span class="badge gold" title="This goal only counts spending in ${escapeHtml(store.monthLabel(goal.month))}">${escapeHtml(store.monthLabel(goal.month))} only</span>` : ''}</div>
          <div class="meta">${escapeHtml(goal.scope || 'All wallets')} · ${goal.strict ? 'Blocks when full' : 'Warns when full'}</div>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-action="edit-goal" data-id="${goal.id}" title="Edit goal" aria-label="Edit goal">${icon('edit')}</button>
          <button class="mini-btn danger" data-action="delete-goal" data-id="${goal.id}" title="Delete goal" aria-label="Delete goal">${icon('trash')}</button>
        </div>
      </div>
      <div class="goal-figures">
        <span class="goal-spent mono">${money(p.spent)} <span class="muted">of ${money(p.limit)}</span></span>
        <span class="goal-right">
          <span class="goal-pct">${pct}%</span>
          <span class="goal-status">${status}</span>
        </span>
      </div>
      <div class="bar"><span class="${level === 'over' ? 'over' : level === 'warn' ? 'warn' : ''}" style="width:${pct}%"></span></div>
    </article>
  `
}

function renderGoalsSection() {
  const goals = store.getGoals(month)
  const over = goals.filter((g) => g.progress.over > 0).length
  const near = goals.filter((g) => g.progress.hit && g.progress.over === 0).length
  const alertBits = []
  if (over) alertBits.push(`${over} over the limit`)
  if (near) alertBits.push(`${near} at the limit`)
  return `
    <section class="section">
      <div class="section-head">
        <h2>${icon('target')} Goals</h2>
        <div class="head-actions">
          <span class="item-meta">${escapeHtml(store.monthLabel(month))}</span>
        </div>
      </div>
      <p class="muted tight" style="margin:-2px 0 10px">Optional monthly limits — an expense that would pass a goal's limit is blocked, or asks first.</p>
      <div class="list">
        ${goals.length ? goals.map(goalCard).join('') : emptyState(`No goals for ${escapeHtml(store.monthLabel(month))}. Add a monthly limit to keep spending in check.`, 'target')}
      </div>
      <button class="goal-add-btn" type="button" data-action="new-goal">${icon('plus')}<span>New goal</span></button>
      ${alertBits.length ? `<p class="goal-alert">${icon('warn')}<span>${alertBits.join(' · ')}</span></p>` : ''}
    </section>
  `
}

function renderGoalsCompact() {
  const goals = store.getGoals(month)
  if (!goals.length) return ''
  const top = goals.slice(0, 2)
  return `
    <section class="section">
      <div class="section-head">
        <h2>${icon('target')} Monthly goals</h2>
        <button class="ghost-btn compact" data-screen="wallets">Manage</button>
      </div>
      <div class="list">${top.map(goalCard).join('')}</div>
    </section>
  `
}

function renderWallets() {
  const wallets = store.getWallets()
  const total = wallets.reduce((sum, w) => sum + store.walletTotal(w.id), 0)
  const totals = store.walletTotals()
  return `
    <div class="topbar">
      <div>
        <p class="kicker">Accounts</p>
        <h1>Wallets</h1>
      </div>
      <div class="topbar-actions">
        <button class="ghost-btn compact" data-action="new-wallet">+ Add wallet</button>
      </div>
    </div>
    <section class="hero">
      <div class="hero-top">
        <div>
          <span class="label">Total balance</span>
          <div class="value mono">${money(total)}</div>
          <div class="sub">${wallets.length} wallet${wallets.length === 1 ? '' : 's'} · spendable ${money(wallets.reduce((sum, w) => sum + store.walletSpendable(w.id), 0))}</div>
        </div>
        <span class="pill ${total >= 0 ? 'pos' : 'neg'}">${total >= 0 ? '▲' : '▼'} ${money(total)}</span>
      </div>
      ${walletsTotalsLine(totals)}
    </section>
    <div class="list">
      ${wallets.length ? wallets.map((w) => walletDetailRow(w)).join('') : emptyState('No wallets yet. Tap + to add one.', 'wallet')}
    </div>
    ${renderGoalsSection()}
  `
}

function walletDetailRow(wallet) {
  const parts = walletBreakdown(wallet)
  const monthTx = store.walletTransactions(wallet.id).filter((r) => store.monthKey(r.date) === month)
  const income = monthTx.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount, 0)
  const expense = monthTx.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0)
  const note = []
  if (income || expense) note.push(`this month +${money(income)} / −${money(expense)}`)
  if (parts.foreign && parts.currency) {
    note.push(parts.converted === null
      ? `${plainMoney(parts.foreign)} ${escapeHtml(parts.currency)} (no rate)`
      : `${plainMoney(parts.foreign)} ${escapeHtml(parts.currency)} ≈ ${money(parts.converted)}`)
  }
  return `
    <article class="wallet-card" style="${walletCardStyle(wallet)}" data-action="open-wallet" data-id="${wallet.id}">
      <span class="wallet-tile">${walletIcon(wallet)}</span>
      <div class="body">
        <div class="wallet-name">${escapeHtml(wallet.name)}</div>
        <div class="wallet-kind">
          <span class="badge ${wallet.status === 'Freezed' ? 'red' : 'green'}">${wallet.status}</span>
          <span>${escapeHtml(wallet.type)}</span>
          ${note.length ? `<span>· ${note.join(' · ')}</span>` : ''}
        </div>
      </div>
      <div class="wallet-figure">
        <b class="mono ${parts.total < 0 ? 'neg' : ''}">${money(parts.total)}</b>
        <div class="row-actions">
          <button class="mini-btn" data-action="edit-wallet" data-id="${wallet.id}" title="Edit" aria-label="Edit wallet">${icon('edit')}</button>
          <button class="mini-btn danger" data-action="delete-wallet" data-id="${wallet.id}" title="Delete" aria-label="Delete wallet">${icon('trash')}</button>
        </div>
      </div>
    </article>
  `
}

function renderWalletDetail() {
  const wallet = store.findWallet(walletDetail)
  if (!wallet) {
    walletDetail = null
    return renderWallets()
  }
  const tx = store.walletTransactions(wallet.id)
  const income = tx.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount, 0)
  const expense = tx.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0)
  const inflow = tx.filter((r) => r.kind === 'transfer' && r.dir === 'in' && store.transferCounts(r)).reduce((s, r) => s + r.amount, 0)
  const outflow = tx.filter((r) => r.kind === 'transfer' && r.dir === 'out' && store.transferCounts(r)).reduce((s, r) => s + r.amount + (r.fee || 0), 0)
  const walletGoals = store.getGoals(month).filter((g) => g.walletId === wallet.id)
  const parts = walletBreakdown(wallet)
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:10px">
        <button class="icon-btn" data-action="wallet-back" aria-label="Back">${icon('left')}</button>
        <span class="wallet-tile sm" style="${wallet.status === 'Freezed' ? '--wc:var(--muted);--wc-soft:var(--card-2)' : walletCardStyle(wallet)}">${walletIcon(wallet)}</span>
        <div>
          <p class="kicker">${escapeHtml(wallet.type)}</p>
          <h1 style="font-size:24px">${escapeHtml(wallet.name)}</h1>
        </div>
      </div>
      <button class="mini-btn" data-action="edit-wallet" data-id="${wallet.id}" aria-label="Edit wallet">${icon('edit')}</button>
    </div>

    <section class="hero">
      <div class="hero-top">
        <div>
          <span class="label">Total in ${escapeHtml(store.getSettings().mainCurrency)}</span>
          <div class="value mono" style="font-size:34px">${money(parts.total)}</div>
          <div class="sub">Balance ${money(parts.balance)}${parts.allowable ? ` · allowable ${money(parts.allowable)}` : ''}${parts.foreign ? ` · ${escapeHtml(parts.currency)} ${plainMoney(parts.foreign)}${parts.converted === null ? ' (no rate)' : ` ≈ ${money(parts.converted)}`}` : ''}</div>
          <div class="sub" style="margin-top:4px">You can spend up to ${money(parts.spendable)} from this wallet</div>
        </div>
        <span class="pill ${wallet.status === 'Freezed' ? 'neg' : 'pos'}">${wallet.status}</span>
      </div>
      <div class="stat-grid">
        <div class="stat"><span class="muted">Income</span><b class="pos mono">${money(income)}</b></div>
        <div class="stat"><span class="muted">Expense</span><b class="neg mono">${money(expense)}</b></div>
        <div class="stat"><span class="muted">Transfers</span><b class="mono">${money(inflow - outflow)}</b></div>
      </div>
      <div class="stat-grid" style="margin-top:10px">
        <div class="stat"><span class="muted">Start (main)</span><b class="mono">${money(Number(wallet.start) || 0)}</b></div>
        <div class="stat"><span class="muted">Allowable</span><b class="mono">${money(parts.allowable)}</b></div>
        <div class="stat"><span class="muted">Spendable</span><b class="mono">${money(parts.spendable)}</b></div>
      </div>
      <div class="stat-grid" style="margin-top:10px">
        <div class="stat"><span class="muted">${parts.currency ? escapeHtml(parts.currency) : 'Other currency'}</span><b class="mono">${plainMoney(parts.foreign)}</b></div>
        <div class="stat"><span class="muted">Worth in ${escapeHtml(store.getSettings().mainCurrency)}</span><b class="mono">${parts.foreign ? (parts.converted === null ? 'no rate' : money(parts.converted)) : '—'}</b></div>
        <div class="stat"><span class="muted">Rate</span><b class="mono">${parts.foreign && parts.currency && parts.rate ? `1 ${escapeHtml(parts.currency)} = ${parts.rate}` : '—'}</b></div>
      </div>
      ${parts.spendable < 0 ? `<p class="goal-alert" style="margin-top:12px">${icon('warn')}<span>Spending has passed what this wallet allows</span></p>` : ''}
    </section>

    ${walletGoals.length ? `
    <section class="section">
      <div class="section-head"><h2>${icon('target')} Goals on this wallet</h2></div>
      <div class="list">${walletGoals.map(goalCard).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="section-head"><h2>Activity</h2><span class="item-meta">${tx.length} item${tx.length === 1 ? '' : 's'}</span></div>
      <div class="list">
        ${tx.length ? tx.map(txRow).join('') : emptyState('No transactions for this wallet yet.', 'inbox')}
      </div>
    </section>
  `
}

// ---------- breakdown charts ----------

// Income sources carry no colour of their own, so give the donut a fixed set.
const SOURCE_COLORS = ['#6ea8ff', '#f4b942', '#3ddc84', '#a06bff', '#22b07d', '#f472b6', '#38bdf8', '#fb923c', '#a3e635', '#e879f9', '#f87171', '#60a5fa', '#e8a51c', '#14b8a6']

// Month or year totals keyed by category (expenses) or source (income).
function breakdownTotals(kind, period) {
  const { from, to } = periodRange(period)
  const wanted = kind === 'expense' ? 'expense' : 'income'
  const totals = new Map()
  store.getTransactions().forEach((t) => {
    if (t.kind !== wanted) return
    const d = t.effDate || t.date
    if (d < from || d > to) return
    const key = wanted === 'expense' ? (t.categoryId || '') : (t.sourceId || '')
    totals.set(key, (totals.get(key) || 0) + t.amount)
  })
  return totals
}

function breakdownItems(kind, period) {
  const totals = breakdownTotals(kind, period)
  const records = kind === 'expense' ? store.getCategories() : store.getSources()
  const items = [...totals.entries()].map(([id, value], i) => {
    const rec = records.find((r) => r.id === id)
    return {
      id,
      label: rec ? rec.name : (kind === 'expense' ? 'Uncategorised' : 'Unassigned'),
      value,
      color: kind === 'expense' ? (rec ? rec.color : 'var(--muted)') : SOURCE_COLORS[i % SOURCE_COLORS.length]
    }
  })
  return items.sort((a, b) => b.value - a.value)
}

// Short caption shown inside the ring: "Nov 2026" for a month, "2026" a year.
function chartRangeLabel(period) {
  if (period === 'year') return month.slice(0, 4)
  const d = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(d.getTime())) return store.monthLabel(month)
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function donutChart(items) {
  const total = items.reduce((s, it) => s + it.value, 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const segments = items.map((it) => {
    const len = total > 0 ? (it.value / total) * circumference : 0
    const seg = `<circle cx="50" cy="50" r="${radius}" fill="none" stroke-width="15" style="stroke:${it.color}" stroke-dasharray="${len.toFixed(2)} ${(circumference - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 50 50)" />`
    offset += len
    return seg
  }).join('')
  const range = chartRangeLabel(chartPeriod)
  return `
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(`${money(total)} in ${range}`)}">
        <circle cx="50" cy="50" r="${radius}" fill="none" style="stroke:var(--card-2)" stroke-width="15" />
        ${segments}
      </svg>
      <div class="donut-center">
        <b class="mono">${money(total)}</b>
        <span>${escapeHtml(range)}</span>
      </div>
    </div>
  `
}

function donutLegend(items, total) {
  const rows = items.slice(0, 8).map((it) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${it.color}"></span>
      <span class="legend-name" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</span>
      <span class="legend-val mono">${money(it.value)}</span>
      <span class="legend-pct">${total > 0 ? Math.round((it.value / total) * 100) : 0}%</span>
    </div>
  `)
  const rest = items.slice(8)
  if (rest.length) {
    const restTotal = rest.reduce((s, it) => s + it.value, 0)
    rows.push(`
      <div class="legend-row muted">
        <span class="legend-dot" style="background:var(--card-2)"></span>
        <span class="legend-name">Other (${rest.length})</span>
        <span class="legend-val mono">${money(restTotal)}</span>
        <span class="legend-pct">${total > 0 ? Math.round((restTotal / total) * 100) : 0}%</span>
      </div>
    `)
  }
  return `<div class="chart-legend">${rows.join('')}</div>`
}

function breakdownCard(kind, title) {
  const items = breakdownItems(kind, chartPeriod)
  const total = items.reduce((s, it) => s + it.value, 0)
  const range = chartRangeLabel(chartPeriod)
  return `
    <div class="card donut-card">
      <h3 class="donut-title">${escapeHtml(title)}</h3>
      ${items.length ? `${donutChart(items)}${donutLegend(items, total)}`
        : `<p class="muted tight">No ${kind === 'expense' ? 'spending' : 'income'} recorded in ${escapeHtml(range)}.</p>`}
    </div>
  `
}

// How many past expenses / incomes still point at this category or source,
// so the delete prompt can say exactly what will survive the deletion.
function categoryUsage(id) {
  return store.getTransactions().filter((t) => t.kind === 'expense' && t.categoryId === id).length
}

function sourceUsage(id) {
  return store.getTransactions().filter((t) => t.kind === 'income' && t.sourceId === id).length
}

function renderBudgets() {
  const catTotals = store.categoryTotals(month)
  const categories = store.getCategories().map((c) => ({ ...c, spent: catTotals[c.id] || 0 }))
  const spent = categories.reduce((s, c) => s + c.spent, 0)
  const budget = categories.reduce((s, c) => s + c.budget, 0)

  return `
    <div class="topbar topbar-inline">
      <div>
        <p class="kicker">Planning</p>
        <h1>Budgets</h1>
      </div>
      <div class="topbar-actions">
        <button class="chip edit-toggle ${budgetEdit ? 'on' : ''}" type="button" data-action="toggle-budget-edit" aria-pressed="${budgetEdit ? 'true' : 'false'}">${budgetEdit ? icon('check') : icon('edit')}<span>${budgetEdit ? 'Done' : 'Edit'}</span></button>
        ${monthNav()}
      </div>
    </div>

    ${budgetEdit ? `<p class="muted tight" style="margin:-6px 0 14px">Edit mode — edit or delete a category or income source straight from its row. Deleting keeps past transactions in your history.</p>` : ''}

    <section class="hero" style="padding:16px">
      <span class="label">Spent this month</span>
      <div class="value mono" style="font-size:30px">${money(spent)}</div>
      <div class="sub">of ${money(budget)} budgeted</div>
      <div class="progress-track"><div class="progress-fill" style="width:${budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0}%"></div></div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>${icon('chart')} Breakdown</h2>
        <div class="chip-row segmented">
          <button class="chip ${chartPeriod === 'month' ? 'on' : ''}" type="button" data-action="chart-period" data-value="month">Month</button>
          <button class="chip ${chartPeriod === 'year' ? 'on' : ''}" type="button" data-action="chart-period" data-value="year">Year</button>
        </div>
      </div>
      <div class="chart-grid">
        ${breakdownCard('expense', 'Spending by category')}
        ${breakdownCard('income', 'Income by source')}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Categories</h2>
        <button class="ghost-btn compact" data-action="new-category">+ Add</button>
      </div>
      <div class="list">
        ${categories.map((c) => `
          <article class="budget-cat" data-action="edit-category" data-id="${c.id}">
            ${budgetBar(c)}
            ${budgetEdit ? `
              <div class="row-actions">
                <button class="mini-btn" type="button" data-action="edit-category" data-id="${c.id}" title="Edit category" aria-label="Edit ${escapeHtml(c.name)}">${icon('edit')}</button>
                <button class="mini-btn danger" type="button" data-action="delete-category" data-id="${c.id}" data-count="${categoryUsage(c.id)}" title="Delete category" aria-label="Delete ${escapeHtml(c.name)}">${icon('trash')}</button>
              </div>` : ''}
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Income sources</h2><button class="ghost-btn compact" data-action="new-source">+ Add</button></div>
      <div class="list">
        ${store.getSources().map((s) => `
          <article class="item" data-action="edit-source" data-id="${s.id}">
            <span class="avatar source">${escapeHtml(s.name.charAt(0).toUpperCase())}</span>
            <div class="body"><div class="title">${escapeHtml(s.name)}</div></div>
            ${budgetEdit ? `
              <div class="row-actions">
                <button class="mini-btn" type="button" data-action="edit-source" data-id="${s.id}" title="Edit source" aria-label="Edit ${escapeHtml(s.name)}">${icon('edit')}</button>
                <button class="mini-btn danger" type="button" data-action="delete-source" data-id="${s.id}" data-count="${sourceUsage(s.id)}" title="Delete source" aria-label="Delete ${escapeHtml(s.name)}">${icon('trash')}</button>
              </div>` : ''}
          </article>
        `).join('')}
      </div>
    </section>
  `
}

// A settings block: an icon tile beside the title, then its controls. This is
// the shape the showcase's Settings tab uses (icon + label + value).
function settingsRow(iconName, title, body) {
  return `
    <div class="budget-row settings-row">
      <div class="top">
        <span><span class="settings-ico">${icon(iconName)}</span>${escapeHtml(title)}</span>
        ${icon('chevron')}
      </div>
      ${body}
    </div>
  `
}

// Symbol quick-picks plus the main / secondary currency and their rates.
function currencySettingsHtml(settings, currencies) {
  return `
    <div class="chip-row">
      ${WALLET_CURRENCY.filter(Boolean).concat(['$', 'E£', '€']).filter((v, i, a) => a.indexOf(v) === i).map((c) =>
        `<button class="chip ${settings.currency === c ? 'on' : ''}" data-action="set-currency" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>`
      ).join('')}
    </div>
    <div class="row2" style="margin-top:10px">
      <label>Main currency<select id="main-currency">
        ${currencies.map((c) => `<option value="${escapeHtml(c)}" ${settings.mainCurrency === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select></label>
      <label>Secondary currency<select id="secondary-currency">
        ${currencies.map((c) => `<option value="${escapeHtml(c)}" ${settings.secondaryCurrency === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select></label>
    </div>
    <p class="muted tight" style="margin-top:8px">Every balance a wallet keeps in another currency is turned into ${escapeHtml(settings.mainCurrency)} with these rates. Fetch them online, or type them yourself when you are offline.</p>
    ${rateRowsHtml()}
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap">
      <p class="muted tight" style="margin:0">${ratesUpdatedLabel()}</p>
      <button class="ghost-btn compact" data-action="refresh-rate">Update rates</button>
    </div>
  `
}

function renderMore() {
  const settings = store.getSettings()
  const debts = store.debtSummary()
  const assets = store.getAssets()
  const report = store.importReport()
  // The same currency list the wallet form offers, so a main/secondary
  // currency can always be picked for the balances already in use.
  const currencies = store.currencyChoices()
  return `
    <div class="topbar">
      <div>
        <p class="kicker">Manage</p>
        <h1>More</h1>
      </div>
      <button class="ghost-btn compact" data-action="set-theme">${settings.theme === 'light' ? 'Dark' : 'Light'} mode</button>
    </div>

    <section class="section">
      <div class="section-head"><h2>Repeated income &amp; expenses</h2></div>
      <div class="repeat-disclosures">
        ${repeatingScheduleDisclosure('income', 'Repeated income')}
        ${repeatingScheduleDisclosure('expense', 'Repeated expense')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Preferences</h2></div>
      <div class="list">
        ${settingsRow('cal', 'Pending transfers', `
          <p class="muted tight">Choose what a transfer marked “Pending” does: wait until you untick it, or move the money right away.</p>
          <div class="chip-row">
            <button class="chip ${settings.pendingAffectsBalance ? '' : 'on'}" data-action="set-pending-behavior" data-value="wait">Don't move money yet</button>
            <button class="chip ${settings.pendingAffectsBalance ? 'on' : ''}" data-action="set-pending-behavior" data-value="count">Count as moved</button>
          </div>
        `)}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Assets</h2><button class="ghost-btn compact" data-action="new-asset">+ Add</button></div>
      <p class="muted tight" style="margin-bottom:10px">${assets.length} item${assets.length === 1 ? '' : 's'} · worth ${money(assets.filter((a) => !a.sold).reduce((s, a) => s + a.buyingPrice, 0))}</p>
      <div class="list">
        ${assets.length ? assets.map((a) => `
          <article class="item" data-action="edit-asset" data-id="${a.id}">
            <span class="avatar asset">${escapeHtml((a.name || '?').charAt(0).toUpperCase())}</span>
            <div class="body">
              <div class="title">${escapeHtml(a.name)} ${a.sold ? '<span class="badge green">Sold</span>' : ''}</div>
              <div class="meta">Bought ${money(a.buyingPrice)}${a.date ? ` · ${store.formatDate(a.date)}` : ''}</div>
            </div>
            <div class="amount mono">${a.sold ? money(a.sellingPrice) : money(a.buyingPrice)}</div>
          </article>
        `).join('') : emptyState('No assets tracked.', 'inbox')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Debts</h2><button class="ghost-btn compact" data-action="new-debt">+ Add</button></div>
      <p class="muted tight" style="margin-bottom:10px">Lent ${money(debts.lent)} · collected ${money(debts.collected)} · outstanding ${money(debts.outstanding)}</p>
      <div class="list">
        ${store.getDebts().length ? store.getDebts().map((d) => `
          <article class="item" data-action="edit-debt" data-id="${d.id}">
            <span class="avatar ${d.direction === 'Collect' ? 'income' : 'expense'}">${d.direction === 'Collect' ? icon('down') : icon('up')}</span>
            <div class="body">
              <div class="title">${escapeHtml(d.person)}</div>
              <div class="meta"><span class="badge ${d.direction === 'Collect' ? 'green' : 'red'}">${d.direction}</span>${d.date ? store.formatDate(d.date) : ''}${d.expectedDate ? ` · due ${store.formatDate(d.expectedDate)}` : ''}${d.walletId ? ` · ${escapeHtml(store.walletName(d.walletId))}` : ''}</div>
            </div>
            <div class="amount ${d.direction === 'Collect' ? 'pos' : 'neg'} mono">${money(d.amount)}</div>
          </article>
        `).join('') : emptyState('No debts tracked.', 'inbox')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Data</h2></div>
      <div class="list">
        ${settingsRow('check', 'App status', `
          <p class="muted tight">Works fully offline · updates automatically when online · an automatic data backup is exported before every update.</p>
          <button class="ghost-btn" data-action="install-app">${deferredInstall ? 'Install app' : 'Install app (browser menu)'}</button>
        `)}
        ${settingsRow('up', 'Import from CSV', `
          <p class="muted tight">Bring in your Notion exports: Wallets, Income, Expense, Transfer, Budget or Debt CSV. The type is detected automatically.</p>
          <button class="ghost-btn" data-action="import-csv">Choose CSV file</button>
          <input type="file" id="csv-input" accept=".csv,text/csv" hidden />
        `)}
        ${settingsRow('safe', 'Backup', `
          <p class="muted tight">${report.wallets} wallets · ${report.incomes} income · ${report.expenses} expenses · ${report.transfers} transfers</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
             <button class="ghost-btn" data-action="export-backup">Export backup</button>
             <button class="ghost-btn" data-action="export-backup-pick">Export to location…</button>
             <button class="ghost-btn" data-action="import-backup">Restore backup</button>
             <button class="ghost-btn" data-action="check-update">Check for update</button>
             <button class="ghost-btn danger" data-action="reset-all">Reset all</button>
           </div>
          <input type="file" id="backup-input" accept=".json,application/json" hidden />
        `)}
        ${settingsRow('cash', 'Currency', currencySettingsHtml(settings, currencies))}
      </div>
    </section>

    <p class="muted tight" style="text-align:center;margin-top:8px">Personal Cash Flow · offline · saved on this device</p>
  `
}

// ---------- schedule calendar ----------

function shiftCal(delta) {
  const base = calMonth || store.monthKey(store.todayISO())
  const [y, m] = base.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function scheduleModalHtml() {
  const { kind, groupId } = modalPayload || {}
  // Legacy groups (auto-detected from imported data) have no repeatGroupId on
  // their records, so look them up through the schedule API instead.
  let records
  if (String(groupId || '').startsWith('legacy-')) {
    const group = store.getSchedule(kind, groupId)
    records = group ? group.records : []
  } else {
    records = (store.getState()[kind === 'income' ? 'incomes' : 'expenses'] || [])
      .filter((r) => r.repeatGroupId === groupId)
  }
  const byDate = {}
  records.forEach((r) => { byDate[r.date] = r })
  if (!calMonth) calMonth = store.monthKey(store.todayISO())
  const [y, m] = calMonth.split('-').map(Number)
  const startDow = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, iso, record: byDate[iso] || null })
  }
  const selected = calSelected && byDate[calSelected] ? byDate[calSelected] : null
  const isIncome = kind === 'income'
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="sheet">
        <div class="handle"></div>
        <h2>${isIncome ? 'Income' : 'Expense'} schedule</h2>
        <div class="cal-head">
          <button class="icon-btn" type="button" data-action="cal-prev" aria-label="Previous month">${icon('left')}</button>
          <b>${escapeHtml(store.monthLabel(calMonth))}</b>
          <button class="icon-btn" type="button" data-action="cal-next" aria-label="Next month">${icon('right')}</button>
        </div>
        <div class="cal-grid">
          ${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span class="cal-dow">${d}</span>`).join('')}
          ${cells.map((cell) => {
            if (!cell) return '<span class="cal-day blank"></span>'
            const rec = cell.record
            if (!rec) return `<span class="cal-day"><span class="cal-num">${cell.day}</span></span>`
            const cls = ['cal-day', 'has']
            if (rec.skipped) cls.push('skipped')
            if (rec.excepted) cls.push('edited')
            if (calSelected === cell.iso) cls.push('sel')
            return `<button class="${cls.join(' ')}" type="button" data-action="cal-select" data-date="${cell.iso}">
              <span class="cal-num">${cell.day}</span>
              <i class="cal-amt">${money(rec.amount)}</i>
            </button>`
          }).join('')}
        </div>
        <p class="muted tight">Tap a highlighted day to skip it, restore it or replace it.</p>
        ${selected ? `
        <div class="cal-detail">
          <div class="cal-detail-top">
            <b>${escapeHtml(store.formatDate(selected.date))}</b>
            <span class="mono ${isIncome ? 'pos' : 'neg'}">${isIncome ? '+' : '−'}${money(selected.amount)}</span>
            ${selected.skipped ? '<span class="badge gold">Skipped</span>' : ''}
            ${selected.excepted ? '<span class="badge">Edited</span>' : ''}
          </div>
          <div class="row-actions">
            <button class="ghost-btn compact" type="button" data-action="cal-toggle-skip" data-kind="${kind}" data-id="${selected.id}">${selected.skipped ? 'Restore' : 'Skip'}</button>
            <button class="ghost-btn compact" type="button" data-action="cal-replace" data-kind="${kind}" data-id="${selected.id}">Replace</button>
            <button class="ghost-btn compact danger" type="button" data-action="cal-delete" data-kind="${kind}" data-id="${selected.id}">Delete</button>
          </div>
        </div>` : ''}
        <div class="form-actions">
          <button class="ghost-btn" type="button" data-action="close-modal">Done</button>
        </div>
      </div>
    </div>
  `
}

// ---------- modal ----------

function renderModal() {
  if (!modal) return ''

  if (modal === 'schedule') return scheduleModalHtml()

  if (modal === 'choose') {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="sheet">
          <div class="handle"></div>
          <h2>Add to cash flow</h2>
          <p class="muted tight" style="margin-top:4px">Pick what you want to record.</p>
          <div class="choose-list">
            <button class="choose-item" data-action="open-income">
              <span class="avatar income">${icon('up')}</span>
              <span class="choose-body"><b>Income</b><span class="muted">Money coming in</span></span>
              ${icon('right')}
            </button>
            <button class="choose-item" data-action="open-expense">
              <span class="avatar expense">${icon('down')}</span>
              <span class="choose-body"><b>Expense</b><span class="muted">Money going out</span></span>
              ${icon('right')}
            </button>
            <button class="choose-item" data-action="open-transfer">
              <span class="avatar transfer">${icon('transfer')}</span>
              <span class="choose-body"><b>Transfer</b><span class="muted">Move between wallets</span></span>
              ${icon('right')}
            </button>
            <button class="choose-item" data-action="new-goal">
              <span class="avatar goal">${icon('target')}</span>
              <span class="choose-body"><b>Goal</b><span class="muted">A monthly spending limit</span></span>
              ${icon('right')}
            </button>
          </div>
          <div class="form-actions">
            <button class="ghost-btn" type="button" data-action="close-modal">Cancel</button>
          </div>
        </div>
      </div>
    `
  }

  const isEdit = Boolean(modalPayload && modalPayload.id)
  let title = ''
  let body = ''

  if (modal === 'wallet') {
    const w = modalPayload || {}
    const currencies = store.currencyChoices()
    const hasCurrency = w.currency && currencies.includes(w.currency) ? w.currency : ''
    title = `${isEdit ? 'Edit' : 'New'} wallet`
    body = `
      <label>Wallet name<input name="name" required maxlength="60" value="${escapeHtml(w.name || '')}" placeholder="Cash, Visa, PayPal…" /></label>
      <div class="row2">
        <label>Type<select name="type">${WALLET_TYPES.map((t) => `<option ${w.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Status<select name="status">${WALLET_STATUS.map((s) => `<option ${w.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      </div>
      <div class="row2">
        <label>Start (main) balance<input name="start" type="number" step="0.01" value="${Number(w.start) || 0}" /></label>
        <label>Allowable balance<input name="allowable" type="number" step="0.01" min="0" value="${Number(w.allowable) || 0}" /></label>
      </div>
      <p class="muted tight" style="margin-top:-4px">Start (main) is what the wallet began with in your main currency; allowable is the extra amount you allow yourself to use from it.</p>
      <div class="row2">
        <label>Balance in another currency<input name="foreign" type="number" step="0.01" value="${Number(w.foreign) || 0}" /></label>
        <label>That currency<select name="currency" data-currency>
          <option value="">— None —</option>
          ${currencies.map((c) => `<option value="${escapeHtml(c)}" ${c === hasCurrency ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          ${w.currency && !currencies.includes(w.currency) ? `<option value="${escapeHtml(w.currency)}" selected>${escapeHtml(w.currency)} (no rate)</option>` : ''}
        </select></label>
      </div>
      <p class="muted tight" id="wallet-foreign-hint" style="margin-top:-4px">${walletForeignHint(w)}</p>
      <div class="seg-field">
        <span class="seg-label">Tile colour</span>
        <div class="swatch-row">
          <button type="button" class="swatch auto ${w.color ? '' : 'on'}" data-action="wallet-auto-color" title="Automatic colour" aria-label="Automatic colour">A</button>
          ${WALLET_COLORS.map((c) => `<button type="button" class="swatch ${w.color === c ? 'on' : ''}" data-action="wallet-color" data-value="${c}" style="--sw:${c}" aria-label="Colour ${c}"></button>`).join('')}
          <label class="swatch custom ${w.color && !WALLET_COLORS.includes(w.color) ? 'on' : ''}" title="Custom colour" style="--sw:${escapeHtml(w.color || '#35d997')}">
            <input type="color" data-wallet-color value="${escapeHtml(w.color || '#35d997')}" aria-label="Custom colour" />
          </label>
          <input type="hidden" name="color" value="${escapeHtml(w.color || '')}" />
        </div>
      </div>
      <div class="seg-field">
        <span class="seg-label">Tile icon</span>
        <div class="icon-row" id="wallet-icon-row">
          ${WALLET_ICONS.map((name) => `<button type="button" class="icon-pick ${w.icon === name ? 'on' : ''}" data-action="wallet-icon" data-value="${name}" aria-label="${name}">${icon(name)}</button>`).join('')}
          <input type="hidden" name="icon" value="${escapeHtml(w.icon || '')}" />
        </div>
        <p class="muted tight" id="wallet-look-hint">Pick a colour and an icon. Tap “A” or the chosen icon again to let the app decide from the wallet's name and type.</p>
      </div>
    `
  } else if (modal === 'category') {
    const c = modalPayload || {}
    title = `${isEdit ? 'Edit' : 'New'} category`
    body = `
      <label>Category name<input name="name" required maxlength="40" value="${escapeHtml(c.name || '')}" placeholder="Groceries" /></label>
      <div class="row2">
        <label>Monthly budget<input name="budget" type="number" step="0.01" value="${Number(c.budget) || 0}" /></label>
        <label>Colour<input name="color" type="color" value="${escapeHtml(c.color || '#5b8cff')}" style="padding:4px;height:46px" /></label>
      </div>
      <div class="seg-field">
        <span class="seg-label">Tile icon</span>
        <div class="icon-row" id="category-icon-row">
          ${CATEGORY_ICONS.map((name) => `<button type="button" class="icon-pick ${c.icon === name ? 'on' : ''}" data-action="category-icon" data-value="${name}" aria-label="${name}">${icon(name)}</button>`).join('')}
          <input type="hidden" name="icon" value="${escapeHtml(c.icon || '')}" />
        </div>
        <p class="muted tight" id="category-icon-hint">${c.icon ? `Showing the “${escapeHtml(c.icon)}” icon on this category's tile.` : "Pick an icon for this category, or leave it blank to show the first letter of its name."}</p>
      </div>
    `
  } else if (modal === 'source') {
    const s = modalPayload || {}
    title = `${isEdit ? 'Edit' : 'New'} income source`
    body = `<label>Source name<input name="name" required maxlength="60" value="${escapeHtml(s.name || '')}" placeholder="Salary" /></label>`
  } else if (modal === 'goal') {
    const g = modalPayload || {}
    title = `${isEdit ? 'Edit' : 'New'} monthly goal`
    body = `
      <p class="muted tight">A goal caps how much you can spend in one month. Leave wallet &amp; category empty to watch everything.</p>
      <label>Goal name<input name="name" required maxlength="60" value="${escapeHtml(g.name || '')}" placeholder="Monthly spending cap…" /></label>
      <label>Monthly limit<input name="limit" type="number" step="0.01" min="0.01" required value="${g.limit ? Number(g.limit) : ''}" placeholder="0.00" /></label>
      <label>Applies to<select name="month">${goalMonthOptions(g.month)}</select></label>
      <p class="muted tight" style="margin-top:-6px">Pick “Every month” to keep this limit running all the time, or a single month for a one-off budget.</p>
      <div class="row2">
        <label>Watch wallet<select name="walletId">
          <option value="">All wallets</option>
          ${store.getWallets().map((w) => `<option value="${w.id}" ${w.id === g.walletId ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')}
        </select></label>
        <label>Watch category<select name="categoryId">
          <option value="">All spending</option>
          ${store.getCategories().map((c) => `<option value="${c.id}" ${c.id === g.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select></label>
      </div>
      <div class="seg-field">
        <span class="seg-label">When the limit is reached</span>
        <div class="chip-row segmented">
          <button type="button" class="chip ${g.strict === false ? '' : 'on'}" data-action="goal-mode" data-value="block">Block the expense</button>
          <button type="button" class="chip ${g.strict === false ? 'on' : ''}" data-action="goal-mode" data-value="warn">Ask me first</button>
        </div>
        <input type="hidden" name="strict" value="${g.strict === false ? 'warn' : 'block'}" />
        <p class="muted tight" id="goal-mode-hint">${g.strict === false ? 'A matching expense asks for confirmation before it is saved.' : 'A matching expense is refused while the goal is full.'}</p>
      </div>
    `
  } else if (modal === 'income') {
    const r = modalPayload || {}
    const weeklyDays = weeklyDaysFor(r)
    title = `${isEdit ? 'Edit' : 'New'} income`
    body = `
      <label>Description<input name="name" required maxlength="120" value="${escapeHtml(r.name || '')}" placeholder="Salary, refund…" /></label>
      <div class="row2">
        <label>Amount<input name="amount" type="number" step="0.01" required value="${r.amount ? Number(r.amount) : ''}" placeholder="0.00" /></label>
        <label>Date<input name="date" type="date" value="${r.date || store.todayISO()}" /></label>
      </div>
      <div class="row2">
        <label>Time<input name="time" type="time" value="${escapeHtml(r.time || store.nowTime())}" /></label>
        <label>Repeat<select name="repeat" data-repeat>
          <option value="none" ${!r.repeat || r.repeat === 'none' ? 'selected' : ''}>One time</option>
          <option value="weekly" ${r.repeat === 'weekly' ? 'selected' : ''}>Every week</option>
          <option value="monthly" ${r.repeat === 'monthly' ? 'selected' : ''}>Every month</option>
          <option value="custom" ${r.repeat === 'custom' ? 'selected' : ''}>Custom (every N days)</option>
        </select></label>
      </div>
      <div data-repeat-panel="weekly" style="display:none">
        <div class="muted tight" style="margin-bottom:4px">On these days:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" name="weekDay" value="${i}" ${weeklyDays.includes(i) ? 'checked' : ''} style="width:auto" /> ${d}</label>`).join('')}</div>
      </div>
      <div data-repeat-panel="monthly" style="display:none">
        <label>Day of month<input name="monthDay" type="number" min="1" max="31" value="${r.monthDay || ''}" placeholder="Same as start date" /></label>
      </div>
      <div data-repeat-panel="custom" style="display:none">
        <label>Every how many days<input name="customDays" type="number" min="1" max="365" value="${r.customDays || 7}" /></label>
      </div>
      <div class="row2">
        <label>Wallet${walletSelect(r.walletId, 'walletId')}</label>
        <label>Source${optionSelect(store.getSources(), r.sourceId, 'sourceId')}</label>
      </div>
      <label>Note (optional)<textarea name="note" maxlength="400">${escapeHtml(r.note || '')}</textarea></label>
      ${isEdit && r.repeatGroupId ? `
      <p class="muted tight">This income is part of a repeated series. Saving changes only this occurrence — it becomes an exception.</p>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px">
        <input type="checkbox" name="applySeries" style="width:auto" /> Apply amount, description, time, wallet &amp; source to this and all upcoming occurrences
      </label>` : ''}
    `
  } else if (modal === 'expense') {
    const r = modalPayload || {}
    const weeklyDays = weeklyDaysFor(r)
    title = `${isEdit ? 'Edit' : 'New'} expense`
    body = `
      <label>Description<input name="name" required maxlength="120" value="${escapeHtml(r.name || '')}" placeholder="Groceries, rent…" /></label>
      <div class="row2">
        <label>Amount<input name="amount" type="number" step="0.01" required value="${r.amount ? Number(r.amount) : ''}" placeholder="0.00" /></label>
        <label>Date<input name="date" type="date" value="${r.date || store.todayISO()}" /></label>
      </div>
      <div class="row2">
        <label>Time<input name="time" type="time" value="${escapeHtml(r.time || store.nowTime())}" /></label>
        <label>Repeat<select name="repeat" data-repeat>
          <option value="none" ${!r.repeat || r.repeat === 'none' ? 'selected' : ''}>One time</option>
          <option value="weekly" ${r.repeat === 'weekly' ? 'selected' : ''}>Every week</option>
          <option value="monthly" ${r.repeat === 'monthly' ? 'selected' : ''}>Every month</option>
          <option value="custom" ${r.repeat === 'custom' ? 'selected' : ''}>Custom (every N days)</option>
        </select></label>
      </div>
      <div data-repeat-panel="weekly" style="display:none">
        <div class="muted tight" style="margin-bottom:4px">On these days:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" name="weekDay" value="${i}" ${weeklyDays.includes(i) ? 'checked' : ''} style="width:auto" /> ${d}</label>`).join('')}</div>
      </div>
      <div data-repeat-panel="monthly" style="display:none">
        <label>Day of month<input name="monthDay" type="number" min="1" max="31" value="${r.monthDay || ''}" placeholder="Same as start date" /></label>
      </div>
      <div data-repeat-panel="custom" style="display:none">
        <label>Every how many days<input name="customDays" type="number" min="1" max="365" value="${r.customDays || 7}" /></label>
      </div>
      <div class="row2">
        <label>Wallet${walletSelect(r.walletId, 'walletId')}</label>
        <label>Category${optionSelect(store.getCategories(), r.categoryId, 'categoryId')}</label>
      </div>
      <label>Note (optional)<textarea name="note" maxlength="400">${escapeHtml(r.note || '')}</textarea></label>
      ${isEdit && r.repeatGroupId ? `
      <p class="muted tight">This expense is part of a repeated series. Saving changes only this occurrence — it becomes an exception.</p>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px">
        <input type="checkbox" name="applySeries" style="width:auto" /> Apply amount, description, time, wallet &amp; category to this and all upcoming occurrences
      </label>` : ''}
    `
  } else if (modal === 'transfer') {
    const r = modalPayload || {}
    title = `${isEdit ? 'Edit' : 'New'} transfer`
    body = `
      <div class="row2">
        <label>Amount<input name="amount" type="number" step="0.01" required value="${r.amount ? Number(r.amount) : ''}" placeholder="0.00" /></label>
        <label>Date<input name="date" type="date" value="${r.date || store.todayISO()}" /></label>
      </div>
      <div class="row2">
        <label>From${walletSelect(r.fromId, 'fromId')}</label>
        <label>To${walletSelect(r.toId, 'toId')}</label>
      </div>
      <label>Fee (optional)<input name="fee" type="number" step="0.01" value="${r.fee ? Number(r.fee) : ''}" placeholder="0.00" /></label>
      <label class="row2" style="grid-template-columns:auto 1fr;align-items:center;color:var(--text)">
        <input type="checkbox" name="pending" ${r.pending ? 'checked' : ''} style="width:auto" /> Pending transfer — don't move money yet
      </label>
      <label>Note (optional)<textarea name="note" maxlength="400">${escapeHtml(r.note || '')}</textarea></label>
    `
  } else if (modal === 'asset') {
    const a = modalPayload || {}
    title = `${isEdit ? 'Edit' : 'New'} asset`
    body = `
      <label>Asset name<input name="name" required maxlength="120" value="${escapeHtml(a.name || '')}" placeholder="Laptop, phone…" /></label>
      <div class="row2">
        <label>Buying price<input name="buyingPrice" type="number" step="0.01" value="${a.buyingPrice ? Number(a.buyingPrice) : ''}" /></label>
        <label>Selling price<input name="sellingPrice" type="number" step="0.01" value="${a.sellingPrice ? Number(a.sellingPrice) : ''}" /></label>
      </div>
      <div class="row2">
        <label>Paid from wallet${walletSelect(a.walletId, 'walletId', false)}</label>
        <label>Date<input name="date" type="date" value="${a.date || ''}" /></label>
      </div>
      <label class="row2" style="grid-template-columns:auto 1fr;align-items:center;color:var(--text)">
        <input type="checkbox" name="sold" ${a.sold ? 'checked' : ''} style="width:auto" /> Mark as sold
      </label>
    `
  } else if (modal === 'debt') {
    const d = modalPayload || {}
    title = `${isEdit ? 'Edit' : 'New'} debt`
    body = `
      <label>Person / party<input name="person" required maxlength="80" value="${escapeHtml(d.person || '')}" /></label>
      <div class="row2">
        <label>Amount<input name="amount" type="number" step="0.01" required value="${d.amount ? Number(d.amount) : ''}" /></label>
        <label>Type<select name="direction"><option ${d.direction !== 'Collect' ? 'selected' : ''}>Lent</option><option ${d.direction === 'Collect' ? 'selected' : ''} value="Collect">Collect</option></select></label>
      </div>
      <div class="row2">
        <label>Date<input name="date" type="date" value="${d.date || store.todayISO()}" /></label>
        <label>Expected date<input name="expectedDate" type="date" value="${d.expectedDate || ''}" /></label>
      </div>
      <label>Wallet${walletSelect(d.walletId, 'walletId', false)}</label>
    `
  }

  const deleteActions = {
    wallet: 'delete-wallet',
    category: 'delete-category',
    income: 'delete-transaction',
    expense: 'delete-transaction',
    transfer: 'delete-transaction',
    asset: 'delete-asset',
    debt: 'delete-debt',
    goal: 'delete-goal'
  }
  const deleteAction = isEdit ? deleteActions[modal] : ''

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <form class="sheet" data-form="${modal}" data-id="${(modalPayload && modalPayload.id) || ''}">
        <div class="handle"></div>
        <h2>${title}</h2>
        <div class="form">
          ${body}
          <div class="form-actions">
            <button class="primary-btn" type="submit">Save</button>
            ${deleteAction ? `<button class="ghost-btn danger" type="button" data-action="${deleteAction}" ${modal === 'income' || modal === 'expense' || modal === 'transfer' ? `data-kind="${modal}"` : ''} data-id="${escapeHtml((modalPayload && modalPayload.id) || '')}">Delete</button>` : ''}
            <button class="ghost-btn" type="button" data-action="close-modal">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  `
}

// ---------- app shell ----------

function render() {
  if (!app) return
  const showFab = screen !== 'more' && !walletDetail
  app.innerHTML = `
    <div class="app-shell">
      <main>
        ${screen === 'home' ? renderDashboard() : ''}
        ${screen === 'activity' ? renderTransactions() : ''}
        ${screen === 'wallets' ? (walletDetail ? renderWalletDetail() : renderWallets()) : ''}
        ${screen === 'budgets' ? renderBudgets() : ''}
        ${screen === 'more' ? renderMore() : ''}
      </main>
      ${showFab ? `<button class="fab" data-action="open-add" aria-label="Add income, expense, transfer or wallet">${icon('plus')}</button>` : ''}
      <nav class="tabbar">
        ${[
          ['home', 'Home', 'home'],
          ['activity', 'Activity', 'list'],
          ['wallets', 'Wallets', 'wallet'],
          ['budgets', 'Budgets', 'chart'],
          ['more', 'More', 'more']
        ].map(([key, label, ico]) => `<button class="tab ${screen === key ? 'active' : ''}" data-screen="${key}" ${screen === key ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span></button>`).join('')}
      </nav>
    </div>
    ${renderModal()}
    <div class="toast" id="toast"></div>
  `
  document.body.classList.toggle('modal-open', Boolean(modal))
  const repeatSel = document.querySelector('select[data-repeat]')
  if (repeatSel) syncRepeatPanels(repeatSel.value)
  // Live search patches only the results, so the field keeps its caret.
  const searchInput = document.getElementById('tx-search')
  if (searchInput) searchInput.addEventListener('input', (event) => {
    txSearch = event.target.value || ''
    patchTxView()
  })
  // The wallet form recalculates its second-currency hint as it is filled in.
  const walletForm = document.querySelector('form[data-form="wallet"]')
  if (walletForm) {
    const hintTargets = walletForm.querySelectorAll('input[name="foreign"], select[name="currency"]')
    hintTargets.forEach((field) => field.addEventListener('input', refreshWalletForeignHint))
    const currencyField = walletForm.querySelector('select[name="currency"]')
    if (currencyField) currencyField.addEventListener('change', refreshWalletForeignHint)
    // A custom colour from the native picker takes over from the swatches.
    const colorField = walletForm.querySelector('input[data-wallet-color]')
    if (colorField) colorField.addEventListener('input', () => {
      const row = colorField.closest('.swatch-row')
      if (!row) return
      const hidden = row.querySelector('input[name="color"]')
      if (hidden) hidden.value = colorField.value
      const label = colorField.closest('.swatch')
      if (label) label.style.setProperty('--sw', colorField.value)
      row.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === label))
    })
  }
  scheduleDueRefresh()
}

function scheduleDueRefresh() {
  if (dueRefreshTimer) clearTimeout(dueRefreshTimer)
  dueRefreshTimer = null
  if (modal) return
  const next = store.nextScheduledAt()
  if (next === null) return
  const delay = Math.min(2147483647, Math.max(0, next - Date.now() + 50))
  dueRefreshTimer = setTimeout(() => render(), delay)
}

function syncRepeatPanels(value) {
  ;['weekly', 'monthly', 'custom'].forEach((name) => {
    const p = document.querySelector(`[data-repeat-panel="${name}"]`)
    if (p) p.style.display = value === name ? '' : 'none'
  })
}

function toast(message) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 1900)
}

function applyTheme() {
  document.documentElement.dataset.theme = store.getTheme()
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = store.getTheme() === 'light' ? '#f2f4f9' : '#0b1220'
}

// ---------- events ----------

document.addEventListener('click', (event) => {
  const screenBtn = event.target.closest('[data-screen]')
  if (screenBtn) {
    screen = screenBtn.dataset.screen
    if (screen !== 'wallets') walletDetail = null
    // Edit mode only makes sense while the Budgets screen is open.
    if (screen !== 'budgets') budgetEdit = false
    window.scrollTo({ top: 0 })
    render()
    return
  }

  const actionEl = event.target.closest('[data-action]')
  if (!actionEl) return
  const action = actionEl.dataset.action

  if (action === 'close-modal') {
    if (event.target.classList.contains('modal-backdrop') || actionEl.tagName === 'BUTTON') goBack()
    return
  }
  if (action === 'wallet-back') { goBack(); return }

  if (action === 'month-prev') { shiftMonth(monthStep() * -1); render(); return }
  if (action === 'month-next') { shiftMonth(monthStep()); render(); return }
  if (action === 'month-now') { month = store.monthKey(store.todayISO()); render(); return }
  if (action === 'toggle-budget-edit') { budgetEdit = !budgetEdit; render(); return }
  if (action === 'set-filter') { txFilter = actionEl.dataset.filter; render(); return }
  if (action === 'set-period') { txPeriod = actionEl.dataset.period || 'month'; render(); return }
  if (action === 'clear-search') { txSearch = ''; render(); return }
  if (action === 'chart-period') { chartPeriod = actionEl.dataset.value === 'year' ? 'year' : 'month'; render(); return }
  if (action === 'set-theme') { store.setTheme(store.getTheme() === 'light' ? 'dark' : 'light'); applyTheme(); render(); return }
  if (action === 'set-pending-behavior') { store.setPendingAffectsBalance(actionEl.dataset.value === 'count'); toast('Preference saved'); render(); return }
  if (action === 'set-currency') { store.setCurrency(actionEl.dataset.value); render(); return }
  if (action === 'wallet-color' || action === 'wallet-auto-color') {
    const row = actionEl.closest('.swatch-row')
    if (!row) return
    const field = row.querySelector('input[name="color"]')
    if (field) field.value = action === 'wallet-color' ? actionEl.dataset.value : ''
    row.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === actionEl))
    return
  }
  if (action === 'wallet-icon') {
    const row = actionEl.closest('.icon-row')
    if (!row) return
    const hidden = row.querySelector('input[name="icon"]')
    // Tapping the active icon clears it, back to the glyph for the wallet type.
    const next = hidden && hidden.value === actionEl.dataset.value ? '' : actionEl.dataset.value
    if (hidden) hidden.value = next
    row.querySelectorAll('.icon-pick').forEach((b) => b.classList.toggle('on', b.dataset.value === next))
    const hint = document.getElementById('wallet-look-hint')
    if (hint) hint.textContent = next
      ? `Showing the “${next}” icon on this wallet's tile.`
      : "Pick a colour and an icon. Tap “A” or the chosen icon again to let the app decide from the wallet's name and type."
    return
  }
  if (action === 'category-icon') {
    const row = actionEl.closest('.icon-row')
    if (!row) return
    const hidden = row.querySelector('input[name="icon"]')
    // Tapping the active icon clears it, back to the name's first letter.
    const next = hidden && hidden.value === actionEl.dataset.value ? '' : actionEl.dataset.value
    if (hidden) hidden.value = next
    row.querySelectorAll('.icon-pick').forEach((b) => b.classList.toggle('on', b.dataset.value === next))
    const hint = document.getElementById('category-icon-hint')
    if (hint) hint.textContent = next
      ? `Showing the “${next}” icon on this category's tile.`
      : "Pick an icon for this category, or leave it blank to show the first letter of its name."
    return
  }
  if (action === 'goal-mode') {
    const wrap = actionEl.closest('.seg-field')
    if (!wrap) return
    wrap.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === actionEl))
    const hidden = wrap.querySelector('input[name="strict"]')
    const hint = wrap.querySelector('#goal-mode-hint')
    if (hidden) hidden.value = actionEl.dataset.value
    if (hint) hint.textContent = actionEl.dataset.value === 'warn'
      ? 'A matching expense asks for confirmation before it is saved.'
      : 'A matching expense is refused while the goal is full.'
    return
  }
  if (action === 'refresh-rate') {
    store.refreshRate().then((res) => {
      toast(res.ok ? `Rate${res.count === 1 ? '' : 's'} updated` : (res.reason || 'Could not update'))
      render()
    })
    return
  }
  if (action === 'check-update') {
    if (!('serviceWorker' in navigator)) { toast('Updates are not supported in this browser'); return }
    toast('Checking for updates…')
    bustSwScript()
      // Register on demand so the button still works when the load-time
      // registration has not resolved yet (or failed).
      .then(() => (swReg ? swReg.update() : navigator.serviceWorker.register('./sw.js')))
      .then((reg) => {
        if (reg && typeof reg.update === 'function') swReg = reg
        if (!swReg) { toast('Could not check for updates'); return }
        // A worker is waiting (already downloaded) or still downloading — either
        // way there is something new to hand over.
        if (swReg.waiting) { applyUpdate(swReg.waiting); return }
        if (swReg.installing) {
          toast('Downloading the new version…')
          whenWorkerInstalled(swReg.installing, () => {
            applyUpdate(swReg.waiting || swReg.installing)
          }, () => toast('Update failed — try again in a moment'))
          return
        }
        toast('App is up to date')
      })
      .catch(() => toast('Could not check for updates'))
    return
  }

  if (action === 'open-wallet') { openWalletDetail(actionEl.dataset.id); return }
  if (action === 'open-add') { openModal('choose', null); return }
  const opens = {
    'new-wallet': 'wallet', 'edit-wallet': 'wallet',
    'new-category': 'category', 'edit-category': 'category',
    'new-source': 'source', 'edit-source': 'source',
    'new-asset': 'asset', 'edit-asset': 'asset',
    'new-debt': 'debt', 'edit-debt': 'debt',
    'new-goal': 'goal', 'edit-goal': 'goal'
  }
  if (opens[action]) {
    const kind = opens[action]
    const id = actionEl.dataset.id
    // Opening from the "+" sheet replaces it so Back does not stack sheets.
    openModal(kind, id ? (findRecord(kind, id) || {}) : {}, modal === 'choose')
    return
  }

  // Choosing a type from the "+" sheet replaces the sheet, so it does not add
  // a second history layer.
  const fromChoose = modal === 'choose'
  if (action === 'open-income') { openModal('income', {}, fromChoose); return }
  if (action === 'open-expense') { openModal('expense', {}, fromChoose); return }
  if (action === 'open-transfer') { openModal('transfer', {}, fromChoose); return }
  if (action === 'open-choose') { openModal('choose', null); return }
  if (action === 'open-wallet-new') { openModal('wallet', {}, fromChoose); return }

  if (action === 'edit-transaction') {
    const kind = actionEl.dataset.kind
    const rec = store.findTransaction(kind, actionEl.dataset.id)
    if (!rec) return
    openModal(kind, { ...rec })
    return
  }
  if (action === 'open-schedule') {
    calMonth = store.monthKey(store.todayISO())
    calSelected = null
    openModal('schedule', { kind: actionEl.dataset.kind, groupId: actionEl.dataset.id })
    return
  }
  if (action === 'cal-prev') { shiftCal(-1); calSelected = null; render(); return }
  if (action === 'cal-next') { shiftCal(1); calSelected = null; render(); return }
  if (action === 'cal-select') { calSelected = actionEl.dataset.date; render(); return }
  if (action === 'cal-toggle-skip') {
    const kind = actionEl.dataset.kind
    const rec = store.findTransaction(kind, actionEl.dataset.id)
    if (!rec) { render(); return }
    store.skipTransaction(kind, actionEl.dataset.id, !rec.skipped)
    toast(!rec.skipped ? 'Occurrence skipped' : 'Occurrence restored')
    render()
    return
  }
  if (action === 'cal-replace') {
    const kind = actionEl.dataset.kind
    const rec = store.findTransaction(kind, actionEl.dataset.id)
    if (!rec) return
    calSelected = null
    openModal(kind, { ...rec }, true)
    return
  }
  if (action === 'cal-delete') {
    const kind = actionEl.dataset.kind
    if (!window.confirm('Delete this occurrence?')) return
    store.removeTransaction(kind, actionEl.dataset.id)
    calSelected = null
    const groupId = modalPayload && modalPayload.groupId
    const remaining = String(groupId || '').startsWith('legacy-')
      ? (store.getSchedule(kind, groupId) ? store.getSchedule(kind, groupId).records : [])
      : (store.getState()[kind === 'income' ? 'incomes' : 'expenses'] || []).filter((r) => r.repeatGroupId === groupId)
    toast('Occurrence deleted')
    if (!remaining.length) { goBack(); return }
    render()
    return
  }
  if (action === 'end-series') {
    const kind = actionEl.dataset.kind
    const label = kind === 'income' ? 'income' : 'expense'
    if (!window.confirm(`End this recurring ${label} series? Upcoming occurrences will be removed — past ones stay in your history.`)) return
    const removed = store.endSeries(kind, actionEl.dataset.id)
    toast(`Series ended · ${removed} upcoming occurrence${removed === 1 ? '' : 's'} removed`)
    render()
    return
  }
  if (action === 'delete-category') {
    // Expenses keep pointing at their category, so deleting is always safe:
    // they simply fall back to "Uncategorised" in the history.
    const id = actionEl.dataset.id
    const cat = store.findCategory(id)
    const name = cat ? cat.name : 'this category'
    const count = Number(actionEl.dataset.count) || categoryUsage(id)
    const detail = count > 0
      ? `\n\nIts ${count} expense${count === 1 ? '' : 's'} stay in your history as uncategorised.`
      : ''
    if (!window.confirm(`Delete "${name}"?${detail}`)) return
    store.removeCategory(id)
    toast('Category deleted')
    if (modal) goBack()
    else render()
    return
  }
  if (action === 'delete-wallet') {
    if (!window.confirm('Delete this wallet? Transactions will keep pointing at it but show no name.')) return
    store.removeWallet(actionEl.dataset.id)
    toast('Wallet deleted')
    if (modal) goBack()
    else { walletDetail = null; render() }
    return
  }
  if (action === 'delete-source') {
    const id = actionEl.dataset.id
    const name = store.sourceName(id) || 'this income source'
    const count = Number(actionEl.dataset.count) || sourceUsage(id)
    const detail = count > 0
      ? `\n\nIts ${count} income record${count === 1 ? '' : 's'} stay in your history as plain income.`
      : ''
    if (!window.confirm(`Delete "${name}"?${detail}`)) return
    store.removeSource(id)
    toast('Source deleted')
    render()
    return
  }
  if (action === 'delete-goal') {
    if (!window.confirm('Delete this goal? Your spending will no longer be limited.')) return
    store.removeGoal(actionEl.dataset.id)
    toast('Goal deleted')
    if (modal) goBack()
    else render()
    return
  }
  if (action === 'delete-upcoming-repeat') {
    const kind = actionEl.dataset.kind
    const record = store.findTransaction(kind, actionEl.dataset.id)
    if (!record || !['income', 'expense'].includes(kind)) {
      toast('That scheduled item is no longer available')
      render()
      return
    }
    if (store.isDue(record)) {
      toast('That item is due already and was not deleted')
      render()
      return
    }
    const label = kind === 'income' ? 'income' : 'expense'
    const when = `${store.formatDate(record.date)} at ${record.time || '00:00'}`
    if (!window.confirm(`Delete the upcoming ${label} "${record.name}" scheduled for ${when}? Other scheduled occurrences will remain.`)) return
    store.removeTransaction(kind, record.id)
    toast('Upcoming occurrence deleted')
    render()
    return
  }
  if (action === 'release-pending') {
    store.updateTransaction('transfer', actionEl.dataset.id, { pending: false, releasedDate: store.todayISO() })
    toast('Transfer released')
    render()
    return
  }
  if (action === 'release-all-pending') {
    const waiting = store.getTransfers().filter((t) => t.pending)
    const today = store.todayISO()
    waiting.forEach((t) => store.updateTransaction('transfer', t.id, { pending: false, releasedDate: today }))
    toast(`Released ${waiting.length} transfer${waiting.length === 1 ? '' : 's'}`)
    render()
    return
  }
  if (action === 'delete-transaction') {
    if (!window.confirm('Delete this transaction?')) return
    store.removeTransaction(actionEl.dataset.kind, actionEl.dataset.id)
    toast('Deleted')
    goBack()
    return
  }
  if (action === 'delete-asset') {
    if (!window.confirm('Delete this asset?')) return
    store.removeAsset(actionEl.dataset.id)
    toast('Asset deleted')
    goBack()
    return
  }
  if (action === 'delete-debt') {
    if (!window.confirm('Delete this debt record?')) return
    store.removeDebt(actionEl.dataset.id)
    toast('Debt deleted')
    goBack()
    return
  }

  if (action === 'import-csv') { const i = document.getElementById('csv-input'); if (i) i.click(); return }
  if (action === 'export-backup') {
    downloadBackup(`personal-cash-flow-backup-${store.todayISO()}.json`)
    toast('Backup exported')
    return
  }
  if (action === 'install-app') {
    if (deferredInstall) {
      deferredInstall.prompt()
      deferredInstall.userChoice.then((r) => { deferredInstall = null; render() })
    } else {
      toast('Use your browser menu → Add to Home screen / Install app')
    }
    return
  }
  if (action === 'export-backup-pick') {
    pickBackupLocation()
    return
  }
  if (action === 'import-backup') { const i = document.getElementById('backup-input'); if (i) i.click(); return }
  if (action === 'reset-all') {
    if (!window.confirm('Erase ALL data and restore the starter wallets/budgets? This cannot be undone.')) return
    store.resetAll()
    toast('Everything reset')
    render()
    return
  }
})

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]')
  if (!form) return
  event.preventDefault()
  const type = form.dataset.form
  const id = form.dataset.id
  const data = new FormData(form)
  const get = (key) => String(data.get(key) || '').trim()
  const num = (key) => store.parseMoney(get(key))

  if (type === 'wallet') {
    const fields = { name: get('name'), type: get('type'), status: get('status'), start: num('start'), allowable: num('allowable'), foreign: num('foreign'), currency: get('currency'), color: get('color'), icon: get('icon') }
    if (!fields.name) return
    if (id) store.updateWallet(id, fields)
    else store.addWallet(fields)
    toast(id ? 'Wallet updated' : 'Wallet added')
  } else if (type === 'category') {
    const fields = { name: get('name'), budget: num('budget'), color: get('color'), icon: get('icon') }
    if (!fields.name) return
    if (id) store.updateCategory(id, fields)
    else store.addCategory(fields)
    toast(id ? 'Category updated' : 'Category added')
  } else if (type === 'source') {
    const fields = { name: get('name') }
    if (!fields.name) return
    if (id) store.updateSource(id, fields)
    else store.addSource(fields)
    toast(id ? 'Source updated' : 'Source added')
  } else if (type === 'goal') {
    const fields = { name: get('name'), limit: num('limit'), walletId: get('walletId'), categoryId: get('categoryId'), strict: get('strict') !== 'warn', month: get('month') }
    if (!fields.name) return
    if (!fields.limit) { toast('Enter a monthly limit'); return }
    if (id) store.updateGoal(id, fields)
    else store.addGoal(fields)
    toast(id ? 'Goal updated' : 'Goal added')
  } else if (type === 'income') {
    const fields = { name: get('name') || 'Income', amount: num('amount'), date: get('date'), time: get('time'), walletId: get('walletId'), sourceId: get('sourceId'), note: get('note'), repeat: get('repeat'), weekDays: data.getAll('weekDay'), monthDay: num('monthDay'), customDays: num('customDays') }
    if (!fields.amount) { toast('Enter an amount'); return }
    if (fields.repeat === 'weekly' && !fields.weekDays.length) {
      const existing = id ? store.findTransaction('income', id) : null
      if (existing && Array.isArray(existing.weekDays) && existing.weekDays.length) fields.weekDays = existing.weekDays
      else if (fields.date) fields.weekDays = [new Date(`${fields.date}T00:00:00`).getDay()]
    }
    if (id && data.get('applySeries') === 'on') store.updateSeries('income', id, fields)
    else if (id) store.updateTransaction('income', id, fields)
    else store.addIncome(fields)
    toast(id ? 'Income updated' : 'Income added')
  } else if (type === 'expense') {
    const fields = { name: get('name') || 'Expense', amount: num('amount'), date: get('date'), time: get('time'), walletId: get('walletId'), categoryId: get('categoryId'), note: get('note'), repeat: get('repeat'), weekDays: data.getAll('weekDay'), monthDay: num('monthDay'), customDays: num('customDays') }
    if (!fields.amount) { toast('Enter an amount'); return }
    if (fields.repeat === 'weekly' && !fields.weekDays.length) {
      const existing = id ? store.findTransaction('expense', id) : null
      if (existing && Array.isArray(existing.weekDays) && existing.weekDays.length) fields.weekDays = existing.weekDays
      else if (fields.date) fields.weekDays = [new Date(`${fields.date}T00:00:00`).getDay()]
    }
    // Monthly goals: a strict goal refuses the expense outright; a soft goal
    // asks for confirmation before it is saved.
    const hits = store.goalsHitByExpense(fields, id || '')
    if (hits.length) {
      const lines = hits.map((h) => `• ${h.goal.name}: ${money(h.next)} of ${money(h.goal.limit)}${store.monthLabel(h.month) ? ` in ${store.monthLabel(h.month)}` : ''}`).join('\n')
      if (hits.some((h) => h.goal.strict)) {
        window.alert(`Blocked by a monthly goal:\n\n${lines}\n\nRaise the goal's limit, lower this expense, or change the goal to "Ask me first".`)
        toast('Expense blocked by goal limit')
        return
      }
      if (!window.confirm(`This expense reaches a monthly goal limit:\n\n${lines}\n\nAdd it anyway?`)) {
        toast('Expense not saved')
        return
      }
    }
    // The wallet's allowable amount is what lets an expense through even when
    // the balance alone would not cover it — ask before going past it.
    const spentOn = fields.walletId ? store.findWallet(fields.walletId) : null
    if (spentOn) {
      const existing = id ? store.findTransaction('expense', id) : null
      const room = existing && existing.walletId === fields.walletId
        ? store.walletSpendableExcluding(spentOn.id, existing.amount)
        : store.walletSpendable(spentOn.id)
      if (fields.amount > room + 0.01) {
        const over = fields.amount - room
        if (!window.confirm(`This expense is ${money(over)} more than ${escapeHtml(spentOn.name)} allows.\n\nBalance + allowable: ${money(room)}\nAdd it anyway?`)) {
          toast('Expense not saved')
          return
        }
      }
    }
    if (id && data.get('applySeries') === 'on') store.updateSeries('expense', id, fields)
    else if (id) store.updateTransaction('expense', id, fields)
    else store.addExpense(fields)
    toast(id ? 'Expense updated' : 'Expense added')
  } else if (type === 'transfer') {
    const fromId = get('fromId')
    const toId = get('toId')
    if (!fromId || !toId || fromId === toId) { toast('Pick two different wallets'); return }
    const fields = { amount: num('amount'), fee: num('fee'), fromId, toId, date: get('date'), note: get('note'), pending: data.get('pending') === 'on' }
    if (!fields.amount) { toast('Enter an amount'); return }
    // Unticking "Pending" in the edit form releases the transfer — stamp the
    // released date exactly like the Release button does.
    const existingTransfer = id ? store.findTransaction('transfer', id) : null
    if (existingTransfer && existingTransfer.pending && !fields.pending) fields.releasedDate = store.todayISO()
    if (id) store.updateTransaction('transfer', id, fields)
    else store.addTransfer(fields)
    toast(id ? 'Transfer updated' : (fields.pending ? 'Pending transfer added' : 'Transfer added'))
  } else if (type === 'asset') {
    const fields = { name: get('name'), buyingPrice: num('buyingPrice'), sellingPrice: num('sellingPrice'), walletId: get('walletId'), date: get('date'), sold: data.get('sold') === 'on' }
    if (!fields.name) return
    if (id) store.updateAsset(id, fields)
    else store.addAsset(fields)
    toast(id ? 'Asset updated' : 'Asset added')
  } else if (type === 'debt') {
    const fields = { person: get('person'), amount: num('amount'), direction: get('direction'), walletId: get('walletId'), date: get('date'), expectedDate: get('expectedDate') }
    if (!fields.person || !fields.amount) return
    if (id) store.updateDebt(id, fields)
    else store.addDebt(fields)
    toast(id ? 'Debt updated' : 'Debt added')
  }

  // Save closes the sheet and pops the overlay history entry.
  goBack()
})

document.addEventListener('change', (event) => {
  const el = event.target
  if (el && el.id === 'tx-sort') {
    txSort = TX_SORTS.some(([value]) => value === el.value) ? el.value : 'date-desc'
    patchTxView()
    return
  }
  if (el && el.id === 'tx-wallet') {
    txWallet = el.value || ''
    patchTxView()
    return
  }
  if (el && el.id === 'main-currency') {
    store.setMainCurrency(el.value)
    store.refreshRate().then((res) => { if (res.ok) toast('Rates updated'); render() })
    return
  }
  if (el && el.id === 'secondary-currency') {
    store.setSecondaryCurrency(el.value)
    store.refreshRate().then((res) => { if (res.ok) toast('Rates updated'); render() })
    return
  }
  if (el && el.dataset && el.dataset.rate) {
    const value = Number(el.value)
    if (!el.value || !Number.isFinite(value) || value <= 0) { toast('Enter a rate above zero'); render(); return }
    store.setRate(el.dataset.rate, value)
    toast('Rate saved')
    render()
    return
  }
  if (el && el.matches && el.matches('select[data-repeat]')) {
    syncRepeatPanels(el.value)
    // Picking "Every week" with nothing ticked yet: tick the start date's own
    // weekday so a weekly series is never created with an empty day set.
    if (el.value === 'weekly') {
      const boxes = Array.from(document.querySelectorAll('input[name="weekDay"]'))
      if (boxes.length && !boxes.some((b) => b.checked)) {
        const dateInput = document.querySelector('input[name="date"]')
        const raw = dateInput && dateInput.value ? dateInput.value : store.todayISO()
        const dow = new Date(`${raw}T00:00:00`).getDay()
        boxes.forEach((b) => { b.checked = Number(b.value) === dow })
      }
    }
    return
  }
  if (el && el.id === 'csv-input') {
    const file = el.files && el.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const res = store.importCSVText(String(reader.result || ''))
      if (!res.ok) toast(res.reason || "Couldn't read that CSV")
      else toast(`Imported ${res.count} ${res.kind} row${res.count === 1 ? '' : 's'}`)
      render()
    }
    reader.onerror = () => toast("Couldn't read that file")
    reader.readAsText(file)
    el.value = ''
    return
  }
  if (el && el.id === 'backup-input') {
    const file = el.files && el.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const ok = store.importBackup(JSON.parse(String(reader.result || '')))
        toast(ok ? 'Backup restored' : 'That file is not a Cash Flow backup')
      } catch {
        toast('That file is not valid JSON')
      }
      render()
    }
    reader.onerror = () => toast("Couldn't read that file")
    reader.readAsText(file)
    el.value = ''
  }
})

function downloadBackup(filename) {
  const blob = new Blob([store.exportBackup()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

async function pickBackupLocation() {
  const filename = `personal-cash-flow-backup-${store.todayISO()}.json`
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Cash Flow backup (JSON)', accept: { 'application/json': ['.json'] } }]
      })
      const writable = await handle.createWritable()
      await writable.write(new Blob([store.exportBackup()], { type: 'application/json' }))
      await writable.close()
      toast('Backup exported')
      return
    } catch (err) {
      if (err && err.name === 'AbortError') return
    }
  }
  downloadBackup(filename)
  toast('Backup exported')
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !modal) {
    store.ensureRecurring()
    render()
  }
})

// ---------- boot ----------

applyTheme()
render()

;(function autoRate() {
  const stamp = store.rateUpdatedAt()
  const stale = !stamp || Date.now() - new Date(stamp).getTime() > 12 * 60 * 60 * 1000
  if (!stale) return
  store.refreshRate().then((res) => { if (res.ok) render() })
})()

let swReg = null
// Set once an update has reloaded the page, so the safety-net timer below does
// not trigger a second reload.
let updateReloaded = false

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      swReg = reg
      if (reg.waiting) toast('Update ready — tap Check for update in Settings')
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Update available — tap Check for update in Settings')
          }
        })
      })
    }).catch(() => {})

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateReloaded) return
      updateReloaded = true
      // A new worker took over: reload so the page runs the new files.
      window.location.reload()
    })
  })
}

// Re-fetch sw.js bypassing the HTTP cache. Without this a cached copy can be
// served to the update check, which then compares identical bytes and reports
// "App is up to date" even though a new release is on the server.
function bustSwScript() {
  try {
    return fetch('./sw.js', { cache: 'reload' }).then(() => undefined, () => undefined)
  } catch {
    return Promise.resolve()
  }
}

// Resolve once a worker finishes installing (or fails). The update check can
// find a new worker that is still downloading the app files, and reporting
// "up to date" at that point is what made updates look broken.
function whenWorkerInstalled(worker, done, onFail) {
  if (!worker) { done(); return }
  if (worker.state === 'installed' || worker.state === 'activated') { done(); return }
  let settled = false
  const onChange = () => {
    if (settled) return
    if (worker.state === 'installed' || worker.state === 'activated') {
      settled = true
      worker.removeEventListener('statechange', onChange)
      done()
    } else if (worker.state === 'redundant') {
      settled = true
      worker.removeEventListener('statechange', onChange)
      if (onFail) onFail()
    }
  }
  worker.addEventListener('statechange', onChange)
}

// Export a safety backup, then let the fresh service worker take over. Once it
// activates it claims the page, and that reloads the app onto the new files.
function applyUpdate(worker) {
  try {
    downloadBackup(`personal-cash-flow-autobackup-${store.todayISO()}.json`)
    toast('Backup exported before update')
  } catch {}
  let asked = false
  const activate = () => {
    if (asked) return
    asked = true
    try { worker.postMessage({ type: 'SKIP_WAITING' }) } catch {}
  }
  // skipWaiting() is accepted while the worker installs, so a worker that has
  // only just been found can still be nudged straight away — one that is still
  // downloading gets the nudge once it settles.
  if (worker.state === 'installing') {
    whenWorkerInstalled(worker, activate, () => toast('Update failed — nothing changed'))
  } else {
    activate()
  }
  // Safety net: if the new worker never claims this page, reload anyway — by
  // then it is active and serves the fresh files.
  setTimeout(() => {
    if (!updateReloaded) window.location.reload()
  }, 3000)
}

const bootError = document.getElementById('boot-error')
if (bootError && app && app.hasChildNodes()) bootError.hidden = true
