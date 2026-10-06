import { store, WALLET_TYPES, WALLET_STATUS, WALLET_CURRENCY } from './store.js'

const app = document.getElementById('app')

let screen = 'home'
let modal = null
let modalPayload = null
let walletDetail = null
let deferredInstall = null
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; render() })
let month = store.monthKey(store.todayISO())
let txFilter = 'all'
let dueRefreshTimer = null

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

function repeatLabel(repeat) {
  if (repeat === 'weekly') return 'Every week'
  if (repeat === 'monthly') return 'Every month'
  if (repeat === 'custom') return 'Custom schedule'
  return 'Scheduled series'
}

function repeatingScheduleRow(schedule) {
  const { kind, next, upcoming, repeat } = schedule
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
        <div class="meta">${escapeHtml(detail)} · ${upcoming.length} scheduled occurrence${upcoming.length === 1 ? '' : 's'} remaining</div>
      </div>
      <div class="amount ${isIncome ? 'pos' : 'neg'} mono">${isIncome ? '+' : '−'}${money(next.amount)}</div>
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
        ${schedules.length ? schedules.map(repeatingScheduleRow).join('') : `<div class="empty">No repeated ${kind} scheduled.</div>`}
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
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
  }
  return icons[name] || ''
}

function shiftMonth(delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function walletSelect(selected, name, required = true) {
  return `<select name="${name}" ${required ? 'required' : ''}>
    <option value="">${required ? 'Choose wallet…' : 'No wallet'}</option>
    ${store.getWallets().map((w) => `<option value="${w.id}" ${w.id === selected ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')}
  </select>`
}

// Modal kind -> state collection used for the edit lookup.
const COLLECTIONS = {
  wallet: 'wallets',
  category: 'categories',
  source: 'sources',
  asset: 'assets',
  debt: 'debts',
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
      <div class="stat-grid">
        <div class="stat"><span class="muted">Income</span><b class="pos mono">${money(summary.income)}</b></div>
        <div class="stat"><span class="muted">Expense</span><b class="neg mono">${money(summary.expense)}</b></div>
        <div class="stat"><span class="muted">Save rate</span><b class="${summary.rate >= 0 ? 'pos' : 'neg'}">${summary.rate}%</b></div>
      </div>
      <p class="sub" style="margin-top:12px">${escapeHtml(store.monthLabel(month))} · assets ${money(totals.assets)} · receivable ${money(totals.receivable)}</p>
    </section>

    ${renderTrend()}

    <section class="section">
      <div class="section-head">
        <h2>Wallets</h2>
        <button class="ghost-btn compact" data-screen="wallets">View all</button>
      </div>
      <div class="list">
        ${wallets.length ? wallets.map(walletRow).join('') : '<div class="empty">No wallets yet. Add one from the Wallets tab.</div>'}
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
      <div class="list">${recent.length ? recent.map(txRow).join('') : '<div class="empty">No transactions yet. Tap + to add income, an expense or a transfer.</div>'}</div>
    </section>
  `
}

function walletAvatar(wallet) {
  const initial = escapeHtml((wallet.name || '?').trim().charAt(0).toUpperCase())
  const color = wallet.status === 'Freezed' ? 'var(--muted)' : 'var(--gold)'
  return `<span class="avatar" style="background:${color}">${initial}</span>`
}

function walletRow(wallet) {
  return `
    <article class="item" data-action="open-wallet" data-id="${wallet.id}">
      ${walletAvatar(wallet)}
      <div class="body">
        <div class="title">${escapeHtml(wallet.name)}</div>
        <div class="meta"><span class="badge ${wallet.status === 'Freezed' ? 'red' : 'green'}">${wallet.status}</span>${escapeHtml(wallet.type)}${wallet.currency ? ` · ${escapeHtml(wallet.currency)}` : ''}</div>
      </div>
      <div class="amount ${wallet.current < 0 ? 'neg' : ''} mono">${money(wallet.current)}</div>
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
  return `
    <div class="budget-row">
      <div class="top">
        <span>${escapeHtml(category.name)}</span>
        <span class="mono"><b>${money(category.spent)}</b> <span class="muted">/ ${money(category.budget)}</span></span>
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
    avatar = `<span class="avatar" style="background:var(--green)">${icon('up')}</span>`
    title = escapeHtml(tx.name)
    meta = `${escapeHtml(store.sourceName(tx.sourceId) || 'Income')} · ${escapeHtml(store.walletName(tx.walletId) || 'No wallet')} · ${store.formatDate(tx.date)}${tx.time ? ' · ' + tx.time : ''}`
    amount = `<div class="amount pos mono">+${money(tx.amount)}</div>`
  } else if (tx.kind === 'expense') {
    avatar = `<span class="avatar" style="background:var(--red)">${icon('down')}</span>`
    title = escapeHtml(tx.name)
    meta = `${escapeHtml(store.categoryName(tx.categoryId) || 'Uncategorised')} · ${escapeHtml(store.walletName(tx.walletId) || 'No wallet')} · ${store.formatDate(tx.date)}${tx.time ? ' · ' + tx.time : ''}`
    amount = `<div class="amount neg mono">-${money(tx.amount)}</div>`
  } else {
    avatar = `<span class="avatar" style="background:var(--blue)">${icon('transfer')}</span>`
    title = 'Transfer'
    meta = `${escapeHtml(store.walletName(tx.fromId) || '?')} → ${escapeHtml(store.walletName(tx.toId) || '?')} · ${store.formatDate(tx.date)}${tx.time ? ' · ' + tx.time : ''}`
    amount = `<div class="amount mono">${money(tx.amount)}</div>`
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

function renderTransactions() {
  const all = store.getTransactions()
  const list = txFilter === 'all' ? all : all.filter((t) => t.kind === txFilter)
  const summary = store.monthSummary(month)
  return `
    <div class="topbar">
      <div>
        <p class="kicker">Cash flow</p>
        <h1>Activity</h1>
      </div>
      ${monthNav()}
    </div>

    <section class="hero" style="padding:14px">
      <div class="stat-grid" style="margin-top:0">
        <div class="stat"><span class="muted">Income</span><b class="pos mono">${money(summary.income)}</b></div>
        <div class="stat"><span class="muted">Expense</span><b class="neg mono">${money(summary.expense)}</b></div>
        <div class="stat"><span class="muted">Net</span><b class="${summary.net >= 0 ? 'pos' : 'neg'} mono">${money(summary.net)}</b></div>
      </div>
    </section>

    <div class="chip-row" style="margin-bottom:12px">
      ${[['all', 'All'], ['income', 'Income'], ['expense', 'Expense'], ['transfer', 'Transfers']].map(([value, label]) =>
        `<button class="chip ${txFilter === value ? 'on' : ''}" data-action="set-filter" data-filter="${value}">${label}</button>`
      ).join('')}
    </div>

    <div class="list">
      ${list.length ? list.map(txRow).join('') : `<div class="empty">No ${txFilter === 'all' ? '' : txFilter + ' '}transactions this period.</div>`}
    </div>
  `
}

function monthNav() {
  return `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <button class="icon-btn" data-action="month-prev" aria-label="Previous month">${icon('left')}</button>
      <button class="ghost-btn compact" data-action="month-now" style="min-width:112px;flex:0 1 auto">${escapeHtml(store.monthLabel(month))}</button>
      <button class="icon-btn" data-action="month-next" aria-label="Next month">${icon('right')}</button>
    </div>
  `
}

function renderWallets() {
  const wallets = store.getWallets()
  const total = wallets.reduce((sum, w) => sum + w.current, 0)
  return `
    <div class="topbar">
      <div>
        <p class="kicker">Accounts</p>
        <h1>Wallets</h1>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="pill">${money(total)}</span>
        <button class="ghost-btn compact" data-action="new-wallet">+ Add wallet</button>
      </div>
    </div>
    <div class="list">
      ${wallets.length ? wallets.map((w) => walletDetailRow(w)).join('') : '<div class="empty">No wallets yet. Tap + to add one.</div>'}
    </div>
  `
}

function walletDetailRow(wallet) {
  const income = store.getIncomes().filter((r) => r.walletId === wallet.id && store.isDue(r)).reduce((s, r) => s + r.amount, 0)
  const expense = store.getExpenses().filter((r) => r.walletId === wallet.id && store.isDue(r)).reduce((s, r) => s + r.amount, 0)
  return `
    <article class="item" style="align-items:start" data-action="open-wallet" data-id="${wallet.id}">
      ${walletAvatar(wallet)}
      <div class="body">
        <div class="title">${escapeHtml(wallet.name)}</div>
        <div class="meta"><span class="badge ${wallet.status === 'Freezed' ? 'red' : 'green'}">${wallet.status}</span>${escapeHtml(wallet.type)}</div>
        <div class="meta" style="margin-top:6px">Opening ${money(wallet.opening)} · in ${money(income)} · out ${money(expense)}</div>
      </div>
      <div style="display:grid;gap:8px;justify-items:end">
        <div class="amount ${wallet.current < 0 ? 'neg' : ''} mono">${money(wallet.current)}</div>
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
  const current = store.walletBalance(wallet.id)
  const tx = store.walletTransactions(wallet.id)
  const income = tx.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount, 0)
  const expense = tx.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0)
  const inflow = tx.filter((r) => r.kind === 'transfer' && r.dir === 'in').reduce((s, r) => s + r.amount, 0)
  const outflow = tx.filter((r) => r.kind === 'transfer' && r.dir === 'out').reduce((s, r) => s + r.amount + (r.fee || 0), 0)
  return `
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:10px">
        <button class="icon-btn" data-action="wallet-back" aria-label="Back">${icon('left')}</button>
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
          <span class="label">Current balance</span>
          <div class="value mono" style="font-size:34px">${money(current)}</div>
          <div class="sub">Opening ${money(wallet.opening)}${wallet.currency ? ` · ${escapeHtml(wallet.currency)}` : ''}</div>
        </div>
        <span class="pill ${wallet.status === 'Freezed' ? 'neg' : 'pos'}">${wallet.status}</span>
      </div>
      <div class="stat-grid">
        <div class="stat"><span class="muted">Income</span><b class="pos mono">${money(income)}</b></div>
        <div class="stat"><span class="muted">Expense</span><b class="neg mono">${money(expense)}</b></div>
        <div class="stat"><span class="muted">Transfers</span><b class="mono">${money(inflow - outflow)}</b></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Activity</h2><span class="item-meta">${tx.length} item${tx.length === 1 ? '' : 's'}</span></div>
      <div class="list">
        ${tx.length ? tx.map(txRow).join('') : '<div class="empty">No transactions for this wallet yet.</div>'}
      </div>
    </section>
  `
}

function renderBudgets() {
  const catTotals = store.categoryTotals(month)
  const categories = store.getCategories().map((c) => ({ ...c, spent: catTotals[c.id] || 0 }))
  const spent = categories.reduce((s, c) => s + c.spent, 0)
  const budget = categories.reduce((s, c) => s + c.budget, 0)
  const sourceTotals = store.sourceTotals(month)
  const sources = store.getSources().map((s) => ({ ...s, total: sourceTotals[s.id] || 0 })).filter((s) => s.total > 0)

  return `
    <div class="topbar">
      <div>
        <p class="kicker">Planning</p>
        <h1>Budgets</h1>
      </div>
      ${monthNav()}
    </div>

    <section class="hero" style="padding:16px">
      <span class="label">Spent this month</span>
      <div class="value mono" style="font-size:30px">${money(spent)}</div>
      <div class="sub">of ${money(budget)} budgeted</div>
      <div class="progress-track"><div class="progress-fill" style="width:${budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0}%"></div></div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Categories</h2>
        <button class="ghost-btn compact" data-action="new-category">+ Add</button>
      </div>
      <div class="list">
        ${categories.map((c) => `
          <article data-action="edit-category" data-id="${c.id}" style="cursor:pointer">
            ${budgetBar(c)}
          </article>
        `).join('')}
      </div>
    </section>

    ${sources.length ? `
    <section class="section">
      <div class="section-head"><h2>Income by source</h2></div>
      <div class="list">
        ${sources.map((s) => `
          <div class="item">
            <span class="avatar" style="background:var(--blue)">${icon('up')}</span>
            <div class="body"><div class="title">${escapeHtml(s.name)}</div></div>
            <div class="amount pos mono">${money(s.total)}</div>
          </div>
        `).join('')}
      </div>
    </section>` : ''}
  `
}

function renderMore() {
  const settings = store.getSettings()
  const debts = store.debtSummary()
  const assets = store.getAssets()
  const sources = store.getSources()
  const report = store.importReport()
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
      <div class="section-head"><h2>Assets</h2><button class="ghost-btn compact" data-action="new-asset">+ Add</button></div>
      <p class="muted tight" style="margin-bottom:10px">${assets.length} item${assets.length === 1 ? '' : 's'} · worth ${money(assets.filter((a) => !a.sold).reduce((s, a) => s + a.buyingPrice, 0))}</p>
      <div class="list">
        ${assets.length ? assets.map((a) => `
          <article class="item" data-action="edit-asset" data-id="${a.id}">
            <span class="avatar" style="background:var(--gold)">${escapeHtml((a.name || '?').charAt(0).toUpperCase())}</span>
            <div class="body">
              <div class="title">${escapeHtml(a.name)} ${a.sold ? '<span class="badge green">Sold</span>' : ''}</div>
              <div class="meta">Bought ${money(a.buyingPrice)}${a.date ? ` · ${store.formatDate(a.date)}` : ''}</div>
            </div>
            <div class="amount mono">${a.sold ? money(a.sellingPrice) : money(a.buyingPrice)}</div>
          </article>
        `).join('') : '<div class="empty">No assets tracked.</div>'}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Debts</h2><button class="ghost-btn compact" data-action="new-debt">+ Add</button></div>
      <p class="muted tight" style="margin-bottom:10px">Lent ${money(debts.lent)} · collected ${money(debts.collected)} · outstanding ${money(debts.outstanding)}</p>
      <div class="list">
        ${store.getDebts().length ? store.getDebts().map((d) => `
          <article class="item" data-action="edit-debt" data-id="${d.id}">
            <span class="avatar" style="background:${d.direction === 'Collect' ? 'var(--green)' : 'var(--red)'}">${d.direction === 'Collect' ? icon('down') : icon('up')}</span>
            <div class="body">
              <div class="title">${escapeHtml(d.person)}</div>
              <div class="meta"><span class="badge ${d.direction === 'Collect' ? 'green' : 'red'}">${d.direction}</span>${d.date ? store.formatDate(d.date) : ''}${d.expectedDate ? ` · due ${store.formatDate(d.expectedDate)}` : ''}${d.walletId ? ` · ${escapeHtml(store.walletName(d.walletId))}` : ''}</div>
            </div>
            <div class="amount ${d.direction === 'Collect' ? 'pos' : 'neg'} mono">${money(d.amount)}</div>
          </article>
        `).join('') : '<div class="empty">No debts tracked.</div>'}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Income sources</h2><button class="ghost-btn compact" data-action="new-source">+ Add</button></div>
      <div class="list">
        ${sources.map((s) => `
          <article class="item" data-action="edit-source" data-id="${s.id}">
            <span class="avatar" style="background:var(--blue)">${escapeHtml(s.name.charAt(0).toUpperCase())}</span>
            <div class="body"><div class="title">${escapeHtml(s.name)}</div></div>
            <div style="display:flex;gap:6px">
              <button class="mini-btn" data-action="edit-source" data-id="${s.id}">${icon('edit')}</button>
              <button class="mini-btn danger" data-action="delete-source" data-id="${s.id}">${icon('trash')}</button>
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Data</h2></div>
      <div class="list">
        <div class="budget-row">
          <div class="top"><b>App status</b></div>
          <p class="muted tight">Works fully offline · updates automatically when online · an automatic data backup is exported before every update.</p>
          <button class="ghost-btn" data-action="install-app">${deferredInstall ? 'Install app' : 'Install app (browser menu)'}</button>
        </div>
        <div class="budget-row">
          <div class="top"><b>Import from CSV</b></div>
          <p class="muted tight">Bring in your Notion exports: Wallets, Income, Expense, Transfer, Budget or Debt CSV. The type is detected automatically.</p>
          <button class="ghost-btn" data-action="import-csv">Choose CSV file</button>
          <input type="file" id="csv-input" accept=".csv,text/csv" hidden />
        </div>
        <div class="budget-row">
          <div class="top"><b>Backup</b></div>
          <p class="muted tight">${report.wallets} wallets · ${report.incomes} income · ${report.expenses} expenses · ${report.transfers} transfers</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
             <button class="ghost-btn" data-action="export-backup">Export backup</button>
             <button class="ghost-btn" data-action="export-backup-pick">Export to location…</button>
             <button class="ghost-btn" data-action="import-backup">Restore backup</button>
             <button class="ghost-btn" data-action="check-update">Check for update</button>
             <button class="ghost-btn danger" data-action="reset-all">Reset all</button>
           </div>
          <input type="file" id="backup-input" accept=".json,application/json" hidden />
        </div>
        <div class="budget-row">
          <div class="top"><b>Currency</b></div>
          <div class="chip-row">
            ${WALLET_CURRENCY.filter(Boolean).concat(['$', 'E£', '€']).filter((v, i, a) => a.indexOf(v) === i).map((c) =>
              `<button class="chip ${settings.currency === c ? 'on' : ''}" data-action="set-currency" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>`
            ).join('')}
          </div>
          <div class="row2" style="margin-top:10px">
            <label>Main currency<select id="main-currency">
              ${WALLET_CURRENCY.filter(Boolean).concat(['EGP', '$', '€', '£', 'SAR', 'AED']).filter((v, i, a) => a.indexOf(v) === i).map((c) => `<option value="${escapeHtml(c)}" ${settings.mainCurrency === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select></label>
            <label>Secondary currency<select id="secondary-currency">
              ${WALLET_CURRENCY.filter(Boolean).concat(['$', 'EGP', '€', '£', 'SAR', 'AED']).filter((v, i, a) => a.indexOf(v) === i).map((c) => `<option value="${escapeHtml(c)}" ${settings.secondaryCurrency === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select></label>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap">
            <p class="muted tight" style="margin:0">${escapeHtml(settings.secondaryCurrency)} = ${settings.exchangeRate ? escapeHtml(String(settings.exchangeRate)) : '…'} ${escapeHtml(settings.mainCurrency)}${settings.rateUpdatedAt ? ` · updated ${escapeHtml(store.formatDate(String(settings.rateUpdatedAt).slice(0, 10)))}` : ''}</p>
            <button class="ghost-btn compact" data-action="refresh-rate">Update rate</button>
          </div>
        </div>
      </div>
    </section>

    <p class="muted tight" style="text-align:center;margin-top:8px">Personal Cash Flow · offline · saved on this device</p>
  `
}

// ---------- modal ----------

function renderModal() {
  if (!modal) return ''

  if (modal === 'choose') {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="sheet">
          <div class="handle"></div>
          <h2>Add to cash flow</h2>
          <div class="form">
            <button class="ghost-btn" data-action="open-income">＋ Income — money in</button>
            <button class="ghost-btn" data-action="open-expense">－ Expense — money out</button>
            <button class="ghost-btn" data-action="open-transfer">⇄ Transfer — move between wallets</button>
            <button class="ghost-btn" data-action="open-wallet-new">▣ Wallet — add an account</button>
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
    title = `${isEdit ? 'Edit' : 'New'} wallet`
    body = `
      <label>Wallet name<input name="name" required maxlength="60" value="${escapeHtml(w.name || '')}" placeholder="Cash, Visa, PayPal…" /></label>
      <div class="row2">
        <label>Type<select name="type">${WALLET_TYPES.map((t) => `<option ${w.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Status<select name="status">${WALLET_STATUS.map((s) => `<option ${w.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      </div>
      <div class="row2">
        <label>Opening balance<input name="opening" type="number" step="0.01" value="${Number(w.opening) || 0}" /></label>
        <label>Foreign currency (opt.)<select name="currency">
          ${WALLET_CURRENCY.map((c) => `<option value="${escapeHtml(c)}" ${c === (w.currency || '') ? 'selected' : ''}>${c || '— None —'}</option>`).join('')}
          ${w.currency && !WALLET_CURRENCY.includes(w.currency) ? `<option value="${escapeHtml(w.currency)}" selected>${escapeHtml(w.currency)}</option>` : ''}
        </select></label>
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
    `
  } else if (modal === 'source') {
    const s = modalPayload || {}
    title = `${isEdit ? 'Edit' : 'New'} income source`
    body = `<label>Source name<input name="name" required maxlength="60" value="${escapeHtml(s.name || '')}" placeholder="Salary" /></label>`
  } else if (modal === 'income') {
    const r = modalPayload || {}
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
        <div style="display:flex;gap:6px;flex-wrap:wrap">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" name="weekDay" value="${i}" style="width:auto" /> ${d}</label>`).join('')}</div>
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
    `
  } else if (modal === 'expense') {
    const r = modalPayload || {}
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
        <div style="display:flex;gap:6px;flex-wrap:wrap">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<label style="display:flex;align-items:center;gap:4px;font-size:13px"><input type="checkbox" name="weekDay" value="${i}" style="width:auto" /> ${d}</label>`).join('')}</div>
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
    debt: 'delete-debt'
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
      ${showFab ? '<button class="fab" data-action="open-add" aria-label="Add">+</button>' : ''}
      <nav class="tabbar">
        ${[
          ['home', 'Home', 'home'],
          ['activity', 'Activity', 'list'],
          ['wallets', 'Wallets', 'wallet'],
          ['budgets', 'Budgets', 'chart'],
          ['more', 'More', 'more']
        ].map(([key, label, ico]) => `<button class="tab ${screen === key ? 'active' : ''}" data-screen="${key}">${icon(ico)}<span>${label}</span></button>`).join('')}
      </nav>
    </div>
    ${renderModal()}
    <div class="toast" id="toast"></div>
  `
  document.body.classList.toggle('modal-open', Boolean(modal))
  const repeatSel = document.querySelector('select[data-repeat]')
  if (repeatSel) syncRepeatPanels(repeatSel.value)
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

  if (action === 'month-prev') { shiftMonth(-1); render(); return }
  if (action === 'month-next') { shiftMonth(1); render(); return }
  if (action === 'month-now') { month = store.monthKey(store.todayISO()); render(); return }
  if (action === 'set-filter') { txFilter = actionEl.dataset.filter; render(); return }
  if (action === 'set-theme') { store.setTheme(store.getTheme() === 'light' ? 'dark' : 'light'); applyTheme(); render(); return }
  if (action === 'set-currency') { store.setCurrency(actionEl.dataset.value); render(); return }
  if (action === 'refresh-rate') {
    store.refreshRate().then((res) => { toast(res.ok ? 'Rate updated' : (res.reason || 'Could not update')); render() })
    return
  }
  if (action === 'check-update') {
    if (!swReg) { toast('Updates not supported here'); return }
    toast('Checking for updates…')
    swReg.update().then(() => {
      setTimeout(() => {
        if (swReg.waiting) applyUpdate(swReg.waiting)
        else toast('App is up to date')
      }, 1500)
    }).catch(() => toast('Could not check for updates'))
    return
  }

  if (action === 'open-wallet') { openWalletDetail(actionEl.dataset.id); return }
  if (action === 'open-add') { openModal('choose', null); return }
  const opens = {
    'new-wallet': 'wallet', 'edit-wallet': 'wallet',
    'new-category': 'category', 'edit-category': 'category',
    'new-source': 'source', 'edit-source': 'source',
    'new-asset': 'asset', 'edit-asset': 'asset',
    'new-debt': 'debt', 'edit-debt': 'debt'
  }
  if (opens[action]) {
    const kind = opens[action]
    const id = actionEl.dataset.id
    openModal(kind, id ? (findRecord(kind, id) || {}) : {})
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
  if (action === 'delete-category') {
    if (!window.confirm('Delete this category? Its expenses become uncategorised.')) return
    store.removeCategory(actionEl.dataset.id)
    toast('Category deleted')
    goBack()
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
    if (!window.confirm('Delete this income source?')) return
    store.removeSource(actionEl.dataset.id)
    toast('Source deleted')
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
    const fields = { name: get('name'), type: get('type'), status: get('status'), opening: num('opening'), currency: get('currency') }
    if (!fields.name) return
    if (id) store.updateWallet(id, fields)
    else store.addWallet(fields)
    toast(id ? 'Wallet updated' : 'Wallet added')
  } else if (type === 'category') {
    const fields = { name: get('name'), budget: num('budget'), color: get('color') }
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
  } else if (type === 'income') {
    const fields = { name: get('name') || 'Income', amount: num('amount'), date: get('date'), time: get('time'), walletId: get('walletId'), sourceId: get('sourceId'), note: get('note'), repeat: get('repeat'), weekDays: data.getAll('weekDay'), monthDay: num('monthDay'), customDays: num('customDays') }
    if (!fields.amount) { toast('Enter an amount'); return }
    if (id) store.updateTransaction('income', id, fields)
    else store.addIncome(fields)
    toast(id ? 'Income updated' : 'Income added')
  } else if (type === 'expense') {
    const fields = { name: get('name') || 'Expense', amount: num('amount'), date: get('date'), time: get('time'), walletId: get('walletId'), categoryId: get('categoryId'), note: get('note'), repeat: get('repeat'), weekDays: data.getAll('weekDay'), monthDay: num('monthDay'), customDays: num('customDays') }
    if (!fields.amount) { toast('Enter an amount'); return }
    if (id) store.updateTransaction('expense', id, fields)
    else store.addExpense(fields)
    toast(id ? 'Expense updated' : 'Expense added')
  } else if (type === 'transfer') {
    const fromId = get('fromId')
    const toId = get('toId')
    if (!fromId || !toId || fromId === toId) { toast('Pick two different wallets'); return }
    const fields = { amount: num('amount'), fee: num('fee'), fromId, toId, date: get('date'), note: get('note') }
    if (!fields.amount) { toast('Enter an amount'); return }
    if (id) store.updateTransaction('transfer', id, fields)
    else store.addTransfer(fields)
    toast(id ? 'Transfer updated' : 'Transfer added')
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
  if (el && el.id === 'main-currency') {
    store.setMainCurrency(el.value)
    store.refreshRate().then((res) => { if (res.ok) toast('Rate updated'); render() })
    return
  }
  if (el && el.id === 'secondary-currency') {
    store.setSecondaryCurrency(el.value)
    store.refreshRate().then((res) => { if (res.ok) toast('Rate updated'); render() })
    return
  }
  if (el && el.matches && el.matches('select[data-repeat]')) {
    syncRepeatPanels(el.value)
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
  if (!document.hidden && !modal) render()
})

// ---------- boot ----------

applyTheme()
render()

;(function autoRate() {
  const s = store.getSettings()
  const stale = !s.rateUpdatedAt || Date.now() - new Date(s.rateUpdatedAt).getTime() > 12 * 60 * 60 * 1000
  if (!stale) return
  store.refreshRate().then((res) => { if (res.ok) render() })
})()

let swReg = null
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

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}

// Export a safety backup, then let the waiting service worker take over.
function applyUpdate(worker) {
  try {
    downloadBackup(`personal-cash-flow-autobackup-${store.todayISO()}.json`)
    toast('Backup exported before update')
  } catch {}
  try { worker.postMessage({ type: 'SKIP_WAITING' }) } catch {}
}

const bootError = document.getElementById('boot-error')
if (bootError && app && app.hasChildNodes()) bootError.hidden = true
