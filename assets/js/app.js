import { Strategy } from './simulation.js';
import { WinRateChart, formatCount, formatRate } from './chart.js';
import { initGame } from './game.js';

/* ── Theme ───────────────────────────────────────────────────── */

const THEME_KEY = 'monty-hall-theme';

function currentTheme() {
  const stamped = document.documentElement.dataset.theme;
  if (stamped) return stamped;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

document.querySelector('#theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  charts.forEach((chart) => chart.render());
});

/* ── Tabs ────────────────────────────────────────────────────── */

const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab) {
  for (const other of tabs) {
    const selected = other === tab;
    other.setAttribute('aria-selected', String(selected));
    other.tabIndex = selected ? 0 : -1;
    document.getElementById(other.getAttribute('aria-controls')).hidden = !selected;
  }
  charts.forEach((chart) => chart.render());
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    next.focus();
    selectTab(next);
  });
});

/* ── Simulations ─────────────────────────────────────────────── */

const strategies = {
  stay: new Strategy('stay'),
  switch: new Strategy('switch'),
};

const charts = [
  new WinRateChart(document.querySelector('[data-chart="stay"]'), {
    reference: 1 / 3,
    referenceLabel: '33.3%',
    colorVar: '--series-stay',
  }),
  new WinRateChart(document.querySelector('[data-chart="switch"]'), {
    reference: 2 / 3,
    referenceLabel: '66.7%',
    colorVar: '--series-switch',
  }),
];

const cards = {
  stay: document.querySelector('.sim-card[data-series="stay"]'),
  switch: document.querySelector('.sim-card[data-series="switch"]'),
};

const statusEl = document.querySelector('#sim-status');
const verdictEl = document.querySelector('#verdict');
const toggleBtn = document.querySelector('#sim-toggle');
const toggleLabel = document.querySelector('#sim-toggle-label');
const toggleIcon = toggleBtn.querySelector('.btn-icon');

let running = false;
let speed = 120000;        // trials per second, per strategy
let carry = 0;             // fractional trials left over between frames
let lastFrame = 0;
let lastStats = 0;
let lastTables = 0;

function syncCharts() {
  charts[0].setData(strategies.stay.history.points, strategies.stay.live);
  charts[1].setData(strategies.switch.history.points, strategies.switch.live);
  charts.forEach((chart) => chart.render());
}

function renderStats() {
  for (const key of ['stay', 'switch']) {
    const s = strategies[key];
    const card = cards[key];
    card.querySelector('[data-stat="rate"]').textContent = s.trials ? formatRate(s.rate) : '—';
    card.querySelector('[data-stat="wins"]').textContent = formatCount(s.wins);
    card.querySelector('[data-stat="trials"]').textContent = formatCount(s.trials);
  }

  const n = strategies.stay.trials;
  statusEl.textContent = running
    ? `Running — ${n.toLocaleString('en-US')} trials per strategy.`
    : `${n ? 'Paused' : 'Idle'} — ${n.toLocaleString('en-US')} trials per strategy.`;

  renderVerdict();
}

function renderVerdict() {
  const stay = strategies.stay;
  const swi = strategies.switch;
  if (stay.trials < 30) {
    verdictEl.textContent = stay.trials
      ? 'Too few trials to say anything yet — keep it running.'
      : 'Start the run to compare the two strategies.';
    return;
  }
  const ratio = stay.rate > 0 ? swi.rate / stay.rate : Infinity;
  const ratioText = Number.isFinite(ratio) ? `${ratio.toFixed(2)}×` : 'far more often';
  verdictEl.innerHTML =
    `After <strong>${stay.trials.toLocaleString('en-US')}</strong> trials each: switching won ` +
    `<strong>${formatRate(swi.rate)}</strong> of its games, staying <strong>${formatRate(stay.rate)}</strong> — ` +
    `switching wins <strong>${ratioText}</strong> as often. Theory says exactly 2×.`;
}

function renderTables() {
  for (const key of ['stay', 'switch']) {
    const details = cards[key].querySelector('.table-view');
    if (!details.open) continue;
    const body = details.querySelector('tbody');
    const rows = strategies[key].history.points
      .slice(-60)
      .map((p) => `<tr><td>${p.n.toLocaleString('en-US')}</td><td>${formatRate(p.rate)}</td></tr>`)
      .join('');
    body.innerHTML = rows || '<tr><td colspan="2">No trials yet.</td></tr>';
  }
}

function frame(now) {
  if (!running) return;
  const dt = Math.min(now - lastFrame, 50) / 1000;
  lastFrame = now;

  // Never queue more than a quarter second of work, so the warm-up below
  // can't build a backlog that lands as one janky catch-up frame.
  carry = Math.min(carry + speed * dt, speed * 0.25);

  // Ramp up geometrically instead of jumping straight to full speed: at the
  // requested rate the first frame would already be thousands of trials and
  // the chart would miss the early swings, which are the interesting part.
  const done = strategies.stay.trials;
  const batch = Math.min(Math.floor(carry), Math.max(1, Math.round(done * 0.4)));
  if (batch > 0) {
    carry -= batch;
    strategies.stay.runBatch(batch);
    strategies.switch.runBatch(batch);
    syncCharts();
  }

  if (now - lastStats > 120) { lastStats = now; renderStats(); }
  if (now - lastTables > 600) { lastTables = now; renderTables(); }

  requestAnimationFrame(frame);
}

function setRunning(next) {
  running = next;
  toggleBtn.setAttribute('aria-pressed', String(running));
  toggleLabel.textContent = running ? 'Pause' : (strategies.stay.trials ? 'Resume' : 'Run simulations');
  toggleIcon.textContent = running ? '❚❚' : '▶';
  if (running) {
    lastFrame = performance.now();
    carry = 0;
    requestAnimationFrame(frame);
  } else {
    renderStats();
    renderTables();
  }
}

toggleBtn.addEventListener('click', () => setRunning(!running));

document.querySelector('#sim-reset').addEventListener('click', () => {
  setRunning(false);
  strategies.stay.reset();
  strategies.switch.reset();
  syncCharts();
  renderStats();
  renderTables();
  toggleLabel.textContent = 'Run simulations';
});

document.querySelectorAll('.seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    speed = Number(btn.dataset.speed);
    carry = 0;
  });
});

document.querySelector('#log-scale').addEventListener('change', (e) => {
  charts.forEach((chart) => { chart.setLogScale(e.target.checked); chart.render(); });
});

document.querySelectorAll('.table-view').forEach((details) => {
  details.addEventListener('toggle', () => { if (details.open) renderTables(); });
});

/* Pausing when the page is hidden keeps a background tab from burning CPU. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) setRunning(false);
});

/* ── Boot ────────────────────────────────────────────────────── */

initGame(document.querySelector('#panel-play'));
syncCharts();
renderStats();
