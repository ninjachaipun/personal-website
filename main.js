/* =========================================================
   Shared site behavior: nav toggle + reusable chart helpers
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('nav-links-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      links.style.display = open ? 'flex' : '';
    });
  }
});

/* ---------- shared svg / formatting helpers ---------- */
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function fmtMoney(v, opts) {
  opts = opts || {};
  const abs = Math.abs(v);
  let out;
  if (abs >= 1e6) out = '$' + (v / 1e6).toFixed(opts.decimals ?? 1) + 'M';
  else if (abs >= 1e3) out = '$' + (v / 1e3).toFixed(0) + 'K';
  else out = '$' + v.toFixed(0);
  return out;
}

function fmtPct(v, decimals) {
  return (v * 100).toFixed(decimals ?? 1) + '%';
}

function makeTooltip(container) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  container.style.position = 'relative';
  container.appendChild(tip);
  return {
    show(x, y, html) {
      tip.innerHTML = html;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
      tip.classList.add('visible');
    },
    hide() { tip.classList.remove('visible'); }
  };
}

/* interpolate along the sequential blue ramp (100 -> 700) */
const SEQ_RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
function seqColor(t) {
  t = Math.max(0, Math.min(1, t));
  const idx = Math.round(t * (SEQ_RAMP.length - 1));
  return SEQ_RAMP[idx];
}

/* =========================================================
   Line chart: two series over time, shared x-axis
   ========================================================= */
function drawLineChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const width = container.clientWidth || 640;
  const height = opts.height || 320;
  const margin = { top: 16, right: 78, bottom: 34, left: 56 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'viz-root' });
  const g = svgEl('g', { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(g);

  const xs = opts.categories;
  const allVals = opts.series.flatMap(s => s.values);
  const yMax = Math.max(...allVals) * 1.12;
  const yMin = Math.min(0, Math.min(...allVals));

  const xScale = i => (i / (xs.length - 1)) * w;
  const yScale = v => h - ((v - yMin) / (yMax - yMin)) * h;

  // gridlines (horizontal, 4 steps)
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = yMin + (i / steps) * (yMax - yMin);
    const y = yScale(v);
    g.appendChild(svgEl('line', { x1: 0, x2: w, y1: y, y2: y, class: 'gridline' }));
    const label = svgEl('text', { x: -10, y: y + 4, class: 'axis-label', 'text-anchor': 'end' });
    label.textContent = opts.yFormat ? opts.yFormat(v) : v.toFixed(0);
    g.appendChild(label);
  }

  // baseline
  g.appendChild(svgEl('line', { x1: 0, x2: w, y1: yScale(0), y2: yScale(0), class: 'hairline-axis' }));

  // x-axis labels (sparse)
  const xTickEvery = Math.ceil(xs.length / 8);
  xs.forEach((label, i) => {
    if (i % xTickEvery !== 0 && i !== xs.length - 1) return;
    const t = svgEl('text', { x: xScale(i), y: h + 22, class: 'axis-label', 'text-anchor': 'middle' });
    t.textContent = label;
    g.appendChild(t);
  });

  const tipEl = document.createElement('div');
  tipEl.className = 'tooltip';
  const tooltip = makeTooltipOn(tipEl);

  opts.series.forEach((s) => {
    let d = '';
    s.values.forEach((v, i) => {
      d += (i === 0 ? 'M' : 'L') + xScale(i) + ',' + yScale(v) + ' ';
    });
    g.appendChild(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2 }));

    // end label
    const lastI = s.values.length - 1;
    const endLabel = svgEl('text', {
      x: xScale(lastI) + 6, y: yScale(s.values[lastI]) + 4,
      class: 'value-label', style: `fill:${s.color}`, 'font-weight': '700'
    });
    endLabel.textContent = s.name;
    g.appendChild(endLabel);

    // hover dots
    s.values.forEach((v, i) => {
      const dot = svgEl('circle', { cx: xScale(i), cy: yScale(v), r: 9, fill: 'transparent' });
      dot.addEventListener('mouseenter', () => {
        const cx = margin.left + xScale(i);
        const cy = margin.top + yScale(v);
        tooltip.show(cx, cy, `<strong>${xs[i]}</strong><br>${s.name}: ${opts.yFormat ? opts.yFormat(v) : v}`);
      });
      dot.addEventListener('mouseleave', () => tooltip.hide());
      g.appendChild(dot);
      const visDot = svgEl('circle', { cx: xScale(i), cy: yScale(v), r: 2.5, fill: s.color });
      g.appendChild(visDot);
    });
  });

  container.innerHTML = '';
  container.style.position = 'relative';
  container.appendChild(svg);
  container.appendChild(tipEl);
}

function makeTooltipOn(tipEl) {
  return {
    show(x, y, html) {
      tipEl.innerHTML = html;
      tipEl.style.left = x + 'px';
      tipEl.style.top = y + 'px';
      tipEl.classList.add('visible');
    },
    hide() { tipEl.classList.remove('visible'); }
  };
}

/* =========================================================
   Heatmap: rows x cols grid, sequential color
   ========================================================= */
function drawHeatmap(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.style.position = 'relative';

  const width = container.clientWidth || 560;
  const rowLabels = opts.rowLabels;
  const colLabels = opts.colLabels;
  const values = opts.values; // [row][col]
  const rowMetricLabel = opts.rowMetricLabel || 'Exit Cap';
  const colMetricLabel = opts.colMetricLabel || 'Rent Growth';
  const metricLabel = opts.metricLabel || 'Levered IRR';
  const colCaption = opts.colCaption || 'Rental Growth Rate →';
  const formatValue = opts.formatValue || ((v) => (v * 100).toFixed(1) + '%');
  const formatCellLabel = opts.formatCellLabel || formatValue;
  const margin = { top: 8, right: 8, bottom: 40, left: opts.leftMargin || 84 };
  const cellGap = 2;
  const gridWMax = width - margin.left - margin.right;
  const cellSize = Math.min(72, gridWMax / colLabels.length);
  const gridW = cellSize * colLabels.length;
  const gridH = cellSize * rowLabels.length;
  const height = gridH + margin.top + margin.bottom;

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'viz-root' });
  const g = svgEl('g', { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(g);

  const flat = values.flat();
  const vMin = Math.min(...flat), vMax = Math.max(...flat);

  const tipEl = document.createElement('div');
  tipEl.className = 'tooltip';
  const tooltip = makeTooltipOn(tipEl);

  rowLabels.forEach((rl, ri) => {
    const rowLabel = svgEl('text', { x: -10, y: ri * cellSize + cellSize / 2 + 4, class: 'axis-label', 'text-anchor': 'end' });
    rowLabel.textContent = rl;
    g.appendChild(rowLabel);

    colLabels.forEach((cl, ci) => {
      const v = values[ri][ci];
      const t = (v - vMin) / (vMax - vMin);
      const rect = svgEl('rect', {
        x: ci * cellSize + cellGap / 2, y: ri * cellSize + cellGap / 2,
        width: cellSize - cellGap, height: cellSize - cellGap,
        rx: 4, fill: seqColor(t), class: 'heat-cell', 'data-r': ri, 'data-c': ci
      });
      rect.addEventListener('mouseenter', () => {
        const cx = margin.left + ci * cellSize + cellSize / 2;
        const cy = margin.top + ri * cellSize;
        tooltip.show(cx, cy, `${rowMetricLabel} ${rl}, ${colMetricLabel} ${cl}<br><strong>${metricLabel}: ${formatValue(v)}</strong>`);
      });
      rect.addEventListener('mouseleave', () => tooltip.hide());
      g.appendChild(rect);

      // direct label on darker cells only if contrast requires — always show value, light text on dark, dark text on light
      const label = svgEl('text', {
        x: ci * cellSize + cellSize / 2, y: ri * cellSize + cellSize / 2 + 4,
        class: 'value-label', 'text-anchor': 'middle',
        style: `fill:${t > 0.55 ? '#ffffff' : '#16181c'}`, 'font-weight': '600'
      });
      label.textContent = formatCellLabel(v);
      g.appendChild(label);
    });
  });

  colLabels.forEach((cl, ci) => {
    const t = svgEl('text', { x: ci * cellSize + cellSize / 2, y: gridH + 20, class: 'axis-label', 'text-anchor': 'middle' });
    t.textContent = cl;
    g.appendChild(t);
  });

  const axisCaptionX = svgEl('text', { x: gridW / 2, y: gridH + 36, class: 'axis-label', 'text-anchor': 'middle', 'font-weight': '700' });
  axisCaptionX.textContent = colCaption;
  g.appendChild(axisCaptionX);

  container.appendChild(svg);
  container.appendChild(tipEl);
}

/* =========================================================
   Horizontal bar chart: single series, sequential color
   ========================================================= */
function drawBarChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.style.position = 'relative';

  const width = container.clientWidth || 560;
  const rowH = 42;
  const margin = { top: 8, right: 70, bottom: 8, left: 130 };
  const barAreaW = width - margin.left - margin.right;
  const height = opts.data.length * rowH + margin.top + margin.bottom;

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'viz-root' });
  const g = svgEl('g', { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(g);

  const maxV = Math.max(...opts.data.map(d => d.value));
  const tipEl = document.createElement('div');
  tipEl.className = 'tooltip';
  const tooltip = makeTooltipOn(tipEl);

  opts.data.forEach((d, i) => {
    const y = i * rowH;
    const barW = (d.value / maxV) * barAreaW;
    const t = 0.35 + 0.55 * (d.value / maxV);

    const label = svgEl('text', { x: -12, y: y + rowH / 2 + 4, class: 'value-label', 'text-anchor': 'end', 'font-weight': '600' });
    label.textContent = d.label;
    g.appendChild(label);

    const track = svgEl('rect', { x: 0, y: y + 8, width: barAreaW, height: rowH - 16, rx: 6, fill: 'var(--bg-alt)' });
    g.appendChild(track);

    const bar = svgEl('rect', {
      x: 0, y: y + 8, width: Math.max(barW, 2), height: rowH - 16, rx: 6,
      fill: seqColor(t), class: 'bar-rect'
    });
    bar.addEventListener('mouseenter', () => {
      tooltip.show(margin.left + barW / 2, margin.top + y, `<strong>${d.label}</strong><br>${d.detail || d.value}`);
    });
    bar.addEventListener('mouseleave', () => tooltip.hide());
    g.appendChild(bar);

    const valLabel = svgEl('text', { x: barW + 10, y: y + rowH / 2 + 4, class: 'value-label', 'font-weight': '700' });
    valLabel.textContent = d.valueLabel || d.value;
    g.appendChild(valLabel);
  });

  container.appendChild(svg);
  container.appendChild(tipEl);
}

/* =========================================================
   Stacked horizontal bar (part-to-whole, 2 categories)
   ========================================================= */
function drawStackedBar(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.style.position = 'relative';

  const width = container.clientWidth || 560;
  const height = 74;
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const barW = width - margin.left - margin.right;
  const barH = 34;

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'viz-root' });
  const g = svgEl('g', { transform: `translate(${margin.left},${margin.top})` });
  svg.appendChild(g);

  const tipEl = document.createElement('div');
  tipEl.className = 'tooltip';
  const tooltip = makeTooltipOn(tipEl);

  let x = 0;
  const total = opts.segments.reduce((a, s) => a + s.value, 0);
  opts.segments.forEach((s) => {
    const segW = (s.value / total) * barW;
    const rect = svgEl('rect', { x: x + 1, y: 0, width: Math.max(segW - 2, 0), height: barH, rx: 6, fill: s.color, class: 'bar-rect' });
    rect.addEventListener('mouseenter', () => {
      tooltip.show(margin.left + x + segW / 2, margin.top, `<strong>${s.label}</strong><br>${fmtPct(s.value / total)} — ${s.detail}`);
    });
    rect.addEventListener('mouseleave', () => tooltip.hide());
    g.appendChild(rect);

    if (segW > 60) {
      const label = svgEl('text', { x: x + segW / 2, y: barH / 2 + 5, class: 'value-label', 'text-anchor': 'middle', style: 'fill:#ffffff', 'font-weight': '700' });
      label.textContent = s.label + ' ' + fmtPct(s.value / total, 0);
      g.appendChild(label);
    }
    x += segW;
  });

  container.appendChild(svg);
  container.appendChild(tipEl);
}
