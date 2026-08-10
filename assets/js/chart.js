/**
 * A small canvas line chart built for a series that never stops growing.
 *
 * Fixed y-domain of 0–1 (a win rate), an x-axis that can run linear or log10,
 * a dashed reference line for the theoretical value, one direct label at the
 * line end, and a crosshair + tooltip on hover. Colors are read from CSS
 * custom properties so the chart follows the page theme.
 */

const PAD = { top: 16, right: 58, bottom: 26, left: 46 };
const LINE_W = 2;
const DOT_R = 4;
const RING_W = 2;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-US');

export const formatCount = (n) => (n < 10000 ? plain.format(n) : compact.format(n));
export const formatRate = (r) => `${(r * 100).toFixed(1)}%`;

export class WinRateChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{reference: number, referenceLabel: string, colorVar: string}} options
   */
  constructor(canvas, { reference, referenceLabel, colorVar }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reference = reference;
    this.referenceLabel = referenceLabel;
    this.colorVar = colorVar;

    this.points = [];      // sampled history: [{ n, rate }, …]
    this.live = null;      // exact current value, always drawn at the line end
    this.log = true;
    this.hover = null;     // { x, y, point } in CSS pixels

    this.tip = document.createElement('div');
    this.tip.className = 'chart-tip';
    this.tip.setAttribute('role', 'presentation');
    canvas.parentElement.appendChild(this.tip);

    this._resize();
    this._observer = new ResizeObserver(() => { this._resize(); this.render(); });
    this._observer.observe(canvas.parentElement);

    canvas.addEventListener('pointermove', (e) => this._onPointer(e));
    canvas.addEventListener('pointerleave', () => this._clearHover());
    canvas.addEventListener('pointerdown', (e) => this._onPointer(e));
  }

  setData(points, live) {
    this.points = points;
    this.live = live;
  }

  setLogScale(on) {
    this.log = on;
  }

  /* ── geometry ─────────────────────────────────────────────── */

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _plot() {
    return {
      x0: PAD.left,
      x1: this.w - PAD.right,
      y0: PAD.top,
      y1: this.h - PAD.bottom,
    };
  }

  _xMax() {
    const last = this.live ?? this.points[this.points.length - 1];
    const n = last ? last.n : 0;
    return this.log ? Math.max(10, n) : Math.max(10, n);
  }

  _xPos(n) {
    const p = this._plot();
    const max = this._xMax();
    if (this.log) {
      const t = Math.log10(Math.max(1, n)) / Math.log10(Math.max(10, max));
      return p.x0 + t * (p.x1 - p.x0);
    }
    return p.x0 + (n / max) * (p.x1 - p.x0);
  }

  _yPos(rate) {
    const p = this._plot();
    return p.y1 - rate * (p.y1 - p.y0);
  }

  _css(name, fallback) {
    const v = getComputedStyle(this.canvas).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ── interaction ──────────────────────────────────────────── */

  _series() {
    if (!this.live) return this.points;
    const last = this.points[this.points.length - 1];
    if (last && last.n === this.live.n) return this.points;
    return [...this.points, this.live];
  }

  _onPointer(event) {
    const series = this._series();
    if (series.length === 0) return this._clearHover();

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const p = this._plot();
    if (x < p.x0 - 12 || x > p.x1 + 12) return this._clearHover();

    // Nearest point in screen space — the hit target is the whole column,
    // never the 8px dot.
    let best = series[0];
    let bestDist = Infinity;
    for (const point of series) {
      const d = Math.abs(this._xPos(point.n) - x);
      if (d < bestDist) { bestDist = d; best = point; }
    }

    this.hover = { point: best };
    this.tip.dataset.show = '1';
    this.tip.innerHTML =
      `<b>${formatRate(best.rate)}</b> win rate<br><span>after ${plain.format(best.n)} trials</span>`;
    // Keep the tooltip inside the card even when the point is at an edge.
    const tipX = Math.min(Math.max(this._xPos(best.n), 76), this.w - 76);
    this.tip.style.left = `${tipX}px`;
    this.tip.style.top = `${this._yPos(best.rate)}px`;
    this.render();
  }

  _clearHover() {
    if (!this.hover) return;
    this.hover = null;
    this.tip.dataset.show = '0';
    this.render();
  }

  /* ── drawing ──────────────────────────────────────────────── */

  render() {
    const ctx = this.ctx;
    const p = this._plot();
    if (p.x1 <= p.x0 || p.y1 <= p.y0) return;

    const surface = this._css('--surface-1', '#fff');
    const grid = this._css('--grid', '#e1e0d9');
    const axis = this._css('--axis', '#c3c2b7');
    const muted = this._css('--text-muted', '#898781');
    const color = this._css(this.colorVar, '#2a78d6');

    ctx.clearRect(0, 0, this.w, this.h);
    ctx.font = '11px ' + this._css('--font', 'system-ui, sans-serif');
    ctx.textBaseline = 'middle';

    // y gridlines + ticks (solid hairlines, one step off the surface)
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const y = Math.round(this._yPos(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x0, y);
      ctx.lineTo(p.x1, y);
      ctx.stroke();
      ctx.fillText(`${t * 100}%`, p.x0 - 8, y);
    }

    // x ticks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const tick of this._xTicks()) {
      const x = this._xPos(tick);
      if (x < p.x0 - 1 || x > p.x1 + 1) continue;
      ctx.fillText(formatCount(tick), x, p.y1 + 8);
    }
    ctx.textBaseline = 'middle';

    // baseline
    ctx.strokeStyle = axis;
    ctx.beginPath();
    ctx.moveTo(p.x0, Math.round(p.y1) + 0.5);
    ctx.lineTo(p.x1, Math.round(p.y1) + 0.5);
    ctx.stroke();

    // theoretical reference — dashed so it never reads as a gridline
    const refY = this._yPos(this.reference);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = axis;
    ctx.beginPath();
    ctx.moveTo(p.x0, refY);
    ctx.lineTo(p.x1, refY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = muted;
    ctx.textAlign = 'left';
    ctx.fillText(this.referenceLabel, p.x1 + 6, refY);

    const series = this._series();
    if (series.length === 0) return;

    // area wash
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this._xPos(series[0].n), p.y1);
    for (const point of series) ctx.lineTo(this._xPos(point.n), this._yPos(point.rate));
    ctx.lineTo(this._xPos(series[series.length - 1].n), p.y1);
    ctx.closePath();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // the line
    ctx.beginPath();
    series.forEach((point, i) => {
      const x = this._xPos(point.n);
      const y = this._yPos(point.rate);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineWidth = LINE_W;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();

    // crosshair + hovered marker
    if (this.hover) {
      const hx = this._xPos(this.hover.point.n);
      const hy = this._yPos(this.hover.point.rate);
      ctx.strokeStyle = axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(hx) + 0.5, p.y0);
      ctx.lineTo(Math.round(hx) + 0.5, p.y1);
      ctx.stroke();
      this._dot(hx, hy, color, surface);
    }

    // end marker + direct label
    const last = series[series.length - 1];
    const lx = this._xPos(last.n);
    const ly = this._yPos(last.rate);
    this._dot(lx, ly, color, surface);

    if (Math.abs(ly - refY) > 13) {
      ctx.fillStyle = this._css('--text-secondary', '#52514e');
      ctx.textAlign = 'left';
      ctx.font = '600 12px ' + this._css('--font', 'system-ui, sans-serif');
      ctx.fillText(formatRate(last.rate), Math.min(lx + 9, p.x1 + 6), ly);
    }
  }

  _dot(x, y, color, surface) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = RING_W;
    ctx.strokeStyle = surface;   // 2px surface ring keeps it legible on the line
    ctx.stroke();
  }

  _xTicks() {
    const max = this._xMax();
    if (this.log) {
      const ticks = [];
      for (let e = 0; Math.pow(10, e) <= max; e++) ticks.push(Math.pow(10, e));
      return ticks;
    }
    const step = niceStep(max / 4);
    const ticks = [];
    for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v));
    return ticks;
  }
}

function niceStep(raw) {
  const exp = Math.floor(Math.log10(Math.max(1, raw)));
  const base = Math.pow(10, exp);
  const frac = raw / base;
  const mult = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return mult * base;
}
