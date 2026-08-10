/**
 * The interactive game: pick a door, watch the host open a goat, then keep or
 * switch. The host's constraint — never your door, never the car — is the
 * whole puzzle, so it is enforced explicitly here too.
 */

const STORE_KEY = 'monty-hall-record';
const CAR = '🚗';
const GOAT = '🐐';

const rand3 = () => (Math.random() * 3) | 0;

function loadRecord() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && typeof raw === 'object') {
      return {
        stay: { plays: raw.stay?.plays | 0, wins: raw.stay?.wins | 0 },
        switch: { plays: raw.switch?.plays | 0, wins: raw.switch?.wins | 0 },
      };
    }
  } catch { /* corrupt or unavailable storage — start clean */ }
  return { stay: { plays: 0, wins: 0 }, switch: { plays: 0, wins: 0 } };
}

function saveRecord(record) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(record));
  } catch { /* private mode — the session still works, it just won't persist */ }
}

export function initGame(root) {
  const doorsEl = root.querySelector('#doors');
  const doors = [...doorsEl.querySelectorAll('.door')];
  const prompt = root.querySelector('#game-prompt');
  const actions = root.querySelector('#game-actions');
  const againBox = root.querySelector('#game-again');
  const btnStay = root.querySelector('#btn-stay');
  const btnSwitch = root.querySelector('#btn-switch');
  const btnAgain = root.querySelector('#btn-again');
  const scoreReset = root.querySelector('#score-reset');

  const scoreEls = {
    stay: root.querySelector('#score-stay'),
    switch: root.querySelector('#score-switch'),
    total: root.querySelector('#score-total'),
  };

  let record = loadRecord();
  let state = null;

  /* ── rendering ────────────────────────────────────────────── */

  function paintDoor(i, { open = false, prize = '', tag = '', picked = false, result = '' }) {
    const el = doors[i];
    el.querySelector('.door-prize').textContent = prize;
    el.querySelector('.door-tag').textContent = tag;
    if (open) el.dataset.open = 'true'; else delete el.dataset.open;
    if (picked) el.dataset.picked = 'true'; else delete el.dataset.picked;
    if (result) el.dataset.result = result; else delete el.dataset.result;
    el.setAttribute('aria-label', doorLabel(i, { open, prize, tag }));
  }

  function doorLabel(i, { open, prize, tag }) {
    const n = i + 1;
    if (!open) return tag ? `Door ${n} — ${tag}, still closed` : `Door ${n}, closed`;
    const behind = prize === CAR ? 'the car' : 'a goat';
    return `Door ${n} — open, ${behind}${tag ? `, ${tag}` : ''}`;
  }

  function resetDoors() {
    doors.forEach((el, i) => {
      el.disabled = false;
      paintDoor(i, {});
    });
  }

  function renderScore() {
    for (const key of ['stay', 'switch']) {
      const { plays, wins } = record[key];
      const rate = plays ? `${Math.round((wins / plays) * 100)}%` : '—';
      scoreEls[key].innerHTML =
        `${rate} <span class="stat-unit">(${wins} of ${plays})</span>`;
    }
    scoreEls.total.textContent = record.stay.plays + record.switch.plays;
  }

  /* ── flow ─────────────────────────────────────────────────── */

  function newRound() {
    state = { car: rand3(), pick: null, opened: null, phase: 'pick' };
    resetDoors();
    actions.hidden = true;
    againBox.hidden = true;
    prompt.textContent = 'Pick a door to begin.';
  }

  function onPick(index) {
    if (!state || state.phase !== 'pick') return;
    state.pick = index;

    // The host opens a goat door that is neither the pick nor the car.
    state.opened = state.pick === state.car
      ? (state.pick + 1 + (Math.random() < 0.5 ? 0 : 1)) % 3
      : 3 - state.pick - state.car;

    state.phase = 'decide';
    state.other = 3 - state.pick - state.opened;

    doors.forEach((el) => { el.disabled = true; });
    paintDoor(state.pick, { picked: true, tag: 'Your pick' });
    paintDoor(state.opened, { open: true, prize: GOAT, tag: 'Host opened' });

    actions.hidden = false;
    prompt.innerHTML =
      `The host opens door <b>${state.opened + 1}</b> — a goat. ` +
      `Keep door ${state.pick + 1}, or switch to door ${state.other + 1}?`;
    btnSwitch.focus({ preventScroll: true });
  }

  function decide(switching) {
    if (!state || state.phase !== 'decide') return;
    const final = switching ? state.other : state.pick;
    const won = final === state.car;
    state.phase = 'done';

    doors.forEach((_, i) => {
      const prize = i === state.car ? CAR : GOAT;
      const isFinal = i === final;
      paintDoor(i, {
        open: true,
        prize,
        tag: isFinal ? 'Your door'
          : i === state.opened ? 'Host opened'
          : i === state.pick ? 'First pick' : '',
        result: isFinal ? (won ? 'win' : 'lose') : '',
      });
    });

    const key = switching ? 'switch' : 'stay';
    record[key].plays++;
    if (won) record[key].wins++;
    saveRecord(record);
    renderScore();

    const choice = switching ? 'Switched' : 'Kept your door';
    prompt.innerHTML = won
      ? `<span class="win">You win the car!</span> ${choice} — door ${final + 1}.`
      : `<span class="lose">A goat.</span> ${choice} — the car was behind door ${state.car + 1}.`;

    actions.hidden = true;
    againBox.hidden = false;
    btnAgain.focus({ preventScroll: true });
  }

  /* ── wiring ───────────────────────────────────────────────── */

  doors.forEach((el, i) => el.addEventListener('click', () => onPick(i)));
  btnStay.addEventListener('click', () => decide(false));
  btnSwitch.addEventListener('click', () => decide(true));
  btnAgain.addEventListener('click', newRound);
  scoreReset.addEventListener('click', () => {
    record = { stay: { plays: 0, wins: 0 }, switch: { plays: 0, wins: 0 } };
    saveRecord(record);
    renderScore();
  });

  renderScore();
  newRound();
}
