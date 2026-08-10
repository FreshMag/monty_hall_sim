/**
 * Monty Hall trial engine.
 *
 * One trial is played out step by step — car placement, contestant pick, the
 * host opening a goat door they are allowed to open, then the final choice —
 * rather than shortcutting to `pick === car`. Slower, but the code says what
 * the puzzle says.
 */

const rand3 = () => (Math.random() * 3) | 0;

/** Plays one game. Returns true when the contestant drives the car home. */
export function playTrial(switching) {
  const car = rand3();
  const pick = rand3();

  // The host opens a door that is neither the contestant's nor the car's.
  let opened;
  if (pick === car) {
    // Two legal doors — pick one of them at random.
    opened = (pick + 1 + (Math.random() < 0.5 ? 0 : 1)) % 3;
  } else {
    // Only one door is neither the pick nor the car. Door indices sum to 3.
    opened = 3 - pick - car;
  }

  const final = switching ? 3 - pick - opened : pick;
  return final === car;
}

/**
 * A win-rate history that stays bounded while the trial count runs away:
 * once the buffer is full it drops every other sample and doubles the
 * sampling interval, so the whole run stays evenly represented.
 */
class History {
  constructor(max = 600) {
    this.max = max;
    this.points = [];
    this.interval = 1;
    this.nextAt = 1;
  }

  record(n, rate) {
    if (n < this.nextAt) return;
    this.points.push({ n, rate });
    this.nextAt = n + this.interval;
    if (this.points.length > this.max) {
      this.points = this.points.filter((_, i) => i % 2 === 0);
      this.interval *= 2;
      this.nextAt = n + this.interval;
    }
  }

  reset() {
    this.points = [];
    this.interval = 1;
    this.nextAt = 1;
  }
}

export class Strategy {
  /** @param {'stay'|'switch'} name */
  constructor(name) {
    this.name = name;
    this.switching = name === 'switch';
    this.trials = 0;
    this.wins = 0;
    this.history = new History();
  }

  runBatch(count) {
    let wins = 0;
    for (let i = 0; i < count; i++) {
      if (playTrial(this.switching)) wins++;
    }
    this.wins += wins;
    this.trials += count;
    this.history.record(this.trials, this.rate);
  }

  get rate() {
    return this.trials === 0 ? 0 : this.wins / this.trials;
  }

  /** The exact current value, for the live end of the line. */
  get live() {
    return this.trials === 0 ? null : { n: this.trials, rate: this.rate };
  }

  reset() {
    this.trials = 0;
    this.wins = 0;
    this.history.reset();
  }
}
