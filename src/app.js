// ============================================================
// algos-lab — six algorithm visualizers.
// ============================================================

const ACCENT = '#059669';
const RULE = '#E5E5EA';
const INK  = '#15151A';
const INK_S = '#4B4B55';
const MUTED = '#8A8A92';
const GOOD = '#16A34A';
const BLUE = '#2563EB';
const PURPLE = '#7C3AED';
const RED  = '#DC2626';
const ORANGE = '#EA580C';

function fitCv(cv, hAttr) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = cv.getBoundingClientRect();
  const h = hAttr ?? +cv.getAttribute('height');
  cv.width  = Math.floor(rect.width * dpr);
  cv.height = Math.floor(h * dpr);
  cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = '11px Inter, sans-serif';
  return { ctx, w: rect.width, h };
}

// =============================================================
// 1) Sorting race — coroutines via generators
// =============================================================
(function sorting() {
  const cv = document.getElementById('cv-sort');
  const nE = document.getElementById('sort-n'); const nV = document.getElementById('sort-nv');
  const sE = document.getElementById('sort-s'); const sV = document.getElementById('sort-sv');
  const go = document.getElementById('sort-go');
  const sh = document.getElementById('sort-shuffle');
  const cE = [0, 1, 2, 3].map(i => document.getElementById(`sort-c${i}`));
  const NAMES = ['bubble', 'insertion', 'quick', 'merge'];
  const COLORS = [GOOD, BLUE, PURPLE, RED];

  let base = []; let lanes = []; let running = false; let timer = null; let counts = [0, 0, 0, 0]; let frame = 0;

  function shuffle(n) {
    base = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = n - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [base[i], base[j]] = [base[j], base[i]];
    }
  }
  function clone() { return base.slice(); }

  // Each algorithm is a generator that yields { arr, hot: [i, j], sorted: Set }
  function* bubble(a) {
    const n = a.length, sorted = new Set();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        yield { arr: a, hot: [j, j + 1], sorted };
        if (a[j] > a[j + 1]) [a[j], a[j + 1]] = [a[j + 1], a[j]];
      }
      sorted.add(n - i - 1);
    }
    for (let i = 0; i < n; i++) sorted.add(i);
    yield { arr: a, hot: [-1, -1], sorted };
  }
  function* insertion(a) {
    const n = a.length, sorted = new Set([0]);
    for (let i = 1; i < n; i++) {
      let j = i;
      while (j > 0 && a[j - 1] > a[j]) {
        yield { arr: a, hot: [j - 1, j], sorted };
        [a[j - 1], a[j]] = [a[j], a[j - 1]];
        j--;
      }
      sorted.add(i);
      yield { arr: a, hot: [-1, -1], sorted };
    }
  }
  function* quick(a, lo = 0, hi = a.length - 1, sorted = new Set()) {
    if (lo >= hi) { if (lo === hi) sorted.add(lo); return; }
    const pivot = a[hi];
    let i = lo - 1;
    for (let j = lo; j < hi; j++) {
      yield { arr: a, hot: [j, hi], sorted };
      if (a[j] <= pivot) { i++; [a[i], a[j]] = [a[j], a[i]]; }
    }
    [a[i + 1], a[hi]] = [a[hi], a[i + 1]];
    sorted.add(i + 1);
    yield { arr: a, hot: [i + 1, -1], sorted };
    yield* quick(a, lo, i, sorted);
    yield* quick(a, i + 2, hi, sorted);
  }
  function* merge(a, l = 0, r = a.length - 1, sorted = new Set()) {
    if (l >= r) { if (l === r) sorted.add(l); return; }
    const m = (l + r) >> 1;
    yield* merge(a, l, m, sorted);
    yield* merge(a, m + 1, r, sorted);
    // merge step
    const tmp = []; let i = l, j = m + 1;
    while (i <= m && j <= r) {
      yield { arr: a, hot: [i, j], sorted };
      if (a[i] <= a[j]) tmp.push(a[i++]); else tmp.push(a[j++]);
    }
    while (i <= m) tmp.push(a[i++]);
    while (j <= r) tmp.push(a[j++]);
    for (let k = 0; k < tmp.length; k++) {
      a[l + k] = tmp[k];
      yield { arr: a, hot: [l + k, -1], sorted };
    }
    for (let k = l; k <= r; k++) sorted.add(k);
  }

  function reset() {
    if (timer) cancelAnimationFrame(timer);
    running = false;
    counts = [0, 0, 0, 0];
    frame = 0;
    const a0 = clone(), a1 = clone(), a2 = clone(), a3 = clone();
    lanes = [
      { name: 'bubble',    gen: bubble(a0),    arr: a0, hot: [-1, -1], sorted: new Set(), done: false },
      { name: 'insertion', gen: insertion(a1), arr: a1, hot: [-1, -1], sorted: new Set(), done: false },
      { name: 'quick',     gen: quick(a2),     arr: a2, hot: [-1, -1], sorted: new Set(), done: false },
      { name: 'merge',     gen: merge(a3),     arr: a3, hot: [-1, -1], sorted: new Set(), done: false },
    ];
  }

  function draw() {
    const { ctx, w, h } = fitCv(cv);
    ctx.clearRect(0, 0, w, h);
    const laneH = h / 4;
    const n = base.length;
    const bw = (w - 16) / n;
    for (let L = 0; L < 4; L++) {
      const top = L * laneH + 6;
      const lane = lanes[L];
      // label
      ctx.fillStyle = COLORS[L]; ctx.textAlign = 'left'; ctx.font = '11px JetBrains Mono';
      ctx.fillText(`${NAMES[L]}`, 4, top + 10);
      // bars
      for (let i = 0; i < n; i++) {
        const v = lane.arr[i];
        const x = 8 + i * bw;
        const bh = (v / n) * (laneH - 18);
        const y = top + (laneH - 18) - bh;
        let color = '#CCCCD0';
        if (lane.sorted.has(i)) color = COLORS[L];
        if (lane.hot.includes(i)) color = '#111';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, Math.max(1, bw - 0.6), bh);
      }
    }
  }

  function tick() {
    if (!running) return;
    const speed = +sE.value; sV.textContent = speed;
    for (let s = 0; s < speed; s++) {
      let allDone = true;
      for (let L = 0; L < 4; L++) {
        const lane = lanes[L]; if (lane.done) continue;
        allDone = false;
        const r = lane.gen.next();
        if (r.done) { lane.done = true; lane.hot = [-1, -1]; }
        else { lane.arr = r.value.arr; lane.hot = r.value.hot; lane.sorted = r.value.sorted; counts[L]++; }
      }
      if (allDone) { running = false; break; }
    }
    for (let i = 0; i < 4; i++) cE[i].textContent = counts[i];
    draw();
    if (running) timer = requestAnimationFrame(tick);
  }

  function start() {
    if (!base.length) shuffle(+nE.value);
    reset();
    nV.textContent = base.length;
    running = true; timer = requestAnimationFrame(tick);
  }

  nE.addEventListener('input', () => { nV.textContent = nE.value; shuffle(+nE.value); reset(); draw(); });
  sh.addEventListener('click', () => { shuffle(+nE.value); reset(); draw(); });
  go.addEventListener('click', start);
  window.addEventListener('resize', draw);
  shuffle(+nE.value); reset();
  setTimeout(draw, 0);
})();

// =============================================================
// 2) Pathfinding (BFS / Dijkstra / A*) on a 30x18 grid
// =============================================================
(function pathfinding() {
  const cv = document.getElementById('cv-path');
  const alg = document.getElementById('path-alg');
  const run = document.getElementById('path-run');
  const clr = document.getElementById('path-clear');
  const mz  = document.getElementById('path-maze');
  const vE  = document.getElementById('path-v');
  const lE  = document.getElementById('path-l');

  const COLS = 40, ROWS = 22;
  // 0 = empty, 1 = wall, 2 = visited, 3 = frontier, 4 = path
  let grid = Array.from({ length: ROWS }, () => new Int8Array(COLS));
  let start = { r: 4, c: 4 };
  let goal  = { r: ROWS - 5, c: COLS - 5 };
  let running = false, frame = null;

  // Random maze: 30% walls then carve
  function randomMaze() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      grid[r][c] = Math.random() < 0.28 ? 1 : 0;
    }
    grid[start.r][start.c] = 0;
    grid[goal.r][goal.c]   = 0;
    draw();
  }
  function clearAll() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = 0;
    draw();
  }
  // Clear only "visited / frontier / path" but keep walls
  function clearViz() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] >= 2) grid[r][c] = 0;
  }

  function draw() {
    const { ctx, w, h } = fitCv(cv);
    ctx.clearRect(0, 0, w, h);
    const cw = w / COLS, ch = h / ROWS;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      let color = '#fff';
      if (grid[r][c] === 1) color = '#15151A';
      else if (grid[r][c] === 2) color = '#A7F3D0';
      else if (grid[r][c] === 3) color = '#6EE7B7';
      else if (grid[r][c] === 4) color = ACCENT;
      ctx.fillStyle = color;
      ctx.fillRect(c * cw, r * ch, cw - 0.5, ch - 0.5);
    }
    ctx.fillStyle = GOOD;
    ctx.fillRect(start.c * cw, start.r * ch, cw - 0.5, ch - 0.5);
    ctx.fillStyle = RED;
    ctx.fillRect(goal.c * cw, goal.r * ch, cw - 0.5, ch - 0.5);
  }

  // Min-heap for Dijkstra / A*
  class PQ {
    constructor() { this.h = []; }
    push(x) { this.h.push(x); this._up(this.h.length - 1); }
    pop() {
      const r = this.h[0]; const last = this.h.pop();
      if (this.h.length) { this.h[0] = last; this._down(0); }
      return r;
    }
    _up(i) { while (i > 0) { const p = (i - 1) >> 1; if (this.h[p].pri > this.h[i].pri) { [this.h[p], this.h[i]] = [this.h[i], this.h[p]]; i = p; } else break; } }
    _down(i) { for (;;) { const l = 2*i+1, r = 2*i+2; let s = i; if (l<this.h.length && this.h[l].pri<this.h[s].pri) s=l; if (r<this.h.length && this.h[r].pri<this.h[s].pri) s=r; if (s===i) break; [this.h[s], this.h[i]] = [this.h[i], this.h[s]]; i = s; } }
    get size() { return this.h.length; }
  }

  function neighbors(r, c) {
    const out = [];
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] !== 1) out.push([nr, nc]);
    }
    return out;
  }

  async function runSearch() {
    if (running) return;
    running = true;
    clearViz();
    let visited = 0;
    const came = new Map();
    const key = (r, c) => r * COLS + c;
    const cost = new Map();
    cost.set(key(start.r, start.c), 0);
    const algo = alg.value;
    const pq = new PQ();
    pq.push({ r: start.r, c: start.c, pri: 0 });
    let found = false;
    const stepsPerFrame = 12;
    while (pq.size > 0 && running) {
      for (let s = 0; s < stepsPerFrame && pq.size > 0; s++) {
        const cur = pq.pop();
        if (grid[cur.r][cur.c] === 2) continue;
        if (!(cur.r === start.r && cur.c === start.c) && !(cur.r === goal.r && cur.c === goal.c)) grid[cur.r][cur.c] = 2;
        visited++;
        if (cur.r === goal.r && cur.c === goal.c) {
          // reconstruct
          let k = key(cur.r, cur.c), len = 0;
          while (came.has(k)) {
            const [pr, pc] = came.get(k);
            if (!(pr === start.r && pc === start.c)) grid[pr][pc] = 4;
            k = key(pr, pc); len++;
          }
          lE.textContent = len;
          found = true; break;
        }
        for (const [nr, nc] of neighbors(cur.r, cur.c)) {
          const k = key(nr, nc);
          const ng = (cost.get(key(cur.r, cur.c)) ?? 0) + 1;
          if (ng < (cost.get(k) ?? Infinity)) {
            cost.set(k, ng);
            came.set(k, [cur.r, cur.c]);
            const heuristic = algo === 'astar' ? Math.abs(nr - goal.r) + Math.abs(nc - goal.c) : 0;
            const pri = algo === 'bfs' ? ng : ng + heuristic;
            pq.push({ r: nr, c: nc, pri });
            if (grid[nr][nc] === 0) grid[nr][nc] = 3;
          }
        }
      }
      vE.textContent = visited;
      draw();
      await new Promise(r => requestAnimationFrame(r));
      if (found) break;
    }
    if (!found) lE.textContent = '∅';
    running = false;
  }

  // Mouse interactions
  let drag = null;
  function cellAt(e) {
    const r = cv.getBoundingClientRect();
    const cw = r.width / COLS, ch = parseInt(cv.getAttribute('height'), 10) / ROWS;
    return { r: Math.floor((e.clientY - r.top) / ch), c: Math.floor((e.clientX - r.left) / cw) };
  }
  cv.addEventListener('pointerdown', e => {
    const { r, c } = cellAt(e);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (r === start.r && c === start.c) { drag = 'start'; return; }
    if (r === goal.r  && c === goal.c)  { drag = 'goal';  return; }
    drag = grid[r][c] === 1 ? 'erase' : 'wall';
    grid[r][c] = drag === 'wall' ? 1 : 0; draw();
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const { r, c } = cellAt(e);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (drag === 'start') { start = { r, c }; }
    else if (drag === 'goal') { goal = { r, c }; }
    else if (drag === 'wall' && grid[r][c] !== 1) { grid[r][c] = 1; }
    else if (drag === 'erase' && grid[r][c] === 1) { grid[r][c] = 0; }
    draw();
  });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('pointerleave', () => { drag = null; });

  run.addEventListener('click', runSearch);
  clr.addEventListener('click', clearAll);
  mz.addEventListener('click', randomMaze);
  window.addEventListener('resize', draw);
  draw();
})();

// =============================================================
// 3) Binary search
// =============================================================
(function binSearch() {
  const cv = document.getElementById('cv-bin');
  const nE = document.getElementById('bin-n'); const nV = document.getElementById('bin-nv');
  const tE = document.getElementById('bin-t'); const tV = document.getElementById('bin-tv');
  const sE = document.getElementById('bin-s'); const fE = document.getElementById('bin-f');
  const go = document.getElementById('bin-go');

  let arr = []; let lo = 0, hi = 0, mid = 0; let target = 0; let steps = 0; let found = -1; let done = true;

  function gen() {
    const n = +nE.value;
    arr = Array.from({ length: n }, (_, i) => Math.floor((i + 1) * 100 / n));
    target = +tE.value;
    lo = 0; hi = n - 1; mid = 0; steps = 0; found = -1; done = false;
  }

  function draw() {
    const { ctx, w, h } = fitCv(cv);
    ctx.clearRect(0, 0, w, h);
    const n = arr.length;
    const cw = w / n;
    for (let i = 0; i < n; i++) {
      let color = '#E5E5EA';
      if (i < lo || i > hi) color = '#F5F5F5';
      if (i === mid) color = ACCENT;
      if (i === found) color = GOOD;
      ctx.fillStyle = color;
      const bh = (arr[i] / 100) * (h - 40);
      ctx.fillRect(i * cw + 1, h - 30 - bh, cw - 2, bh);
      // label
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = '9px JetBrains Mono';
      ctx.fillText(arr[i], i * cw + cw / 2, h - 28 - bh - 2);
    }
    // pointers
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = '10px JetBrains Mono';
    if (!done) {
      ctx.fillText('lo', lo * cw + cw / 2, h - 16);
      ctx.fillText('hi', hi * cw + cw / 2, h - 4);
      if (mid >= lo && mid <= hi) {
        ctx.fillStyle = ACCENT;
        ctx.fillText('mid', mid * cw + cw / 2, h - 10);
      }
    }
    nV.textContent = n; tV.textContent = target;
    sE.textContent = steps;
    fE.textContent = found >= 0 ? `index ${found}` : (done ? 'not found' : '—');
  }

  async function search() {
    gen(); draw();
    while (lo <= hi) {
      mid = (lo + hi) >> 1;
      steps++;
      draw();
      await new Promise(r => setTimeout(r, 500));
      if (arr[mid] === target) { found = mid; done = true; draw(); return; }
      else if (arr[mid] < target) lo = mid + 1;
      else hi = mid - 1;
    }
    done = true; mid = -1; draw();
  }

  for (const el of [nE, tE]) el.addEventListener('input', () => { gen(); draw(); });
  go.addEventListener('click', search);
  window.addEventListener('resize', draw);
  gen(); setTimeout(draw, 0);
})();

// =============================================================
// 4) BFS / DFS on a small graph
// =============================================================
(function graphTraversal() {
  const cv = document.getElementById('cv-gr');
  const algE = document.getElementById('gr-alg');
  const go = document.getElementById('gr-run');
  const ordE = document.getElementById('gr-ord');

  // 10-node graph with positions in [0, 1]
  const NODES = [
    { id: 0, x: 0.10, y: 0.5  },
    { id: 1, x: 0.25, y: 0.20 },
    { id: 2, x: 0.25, y: 0.80 },
    { id: 3, x: 0.45, y: 0.50 },
    { id: 4, x: 0.55, y: 0.15 },
    { id: 5, x: 0.55, y: 0.85 },
    { id: 6, x: 0.72, y: 0.30 },
    { id: 7, x: 0.72, y: 0.70 },
    { id: 8, x: 0.90, y: 0.50 },
    { id: 9, x: 0.40, y: 0.30 },
  ];
  const EDGES = [
    [0,1],[0,2],[1,3],[2,3],[1,9],[3,4],[3,5],[4,6],[5,7],[6,8],[7,8],[4,9],[6,7],
  ];
  const ADJ = Array.from({ length: NODES.length }, () => []);
  for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }
  for (const a of ADJ) a.sort((x, y) => x - y);

  let start = 0;
  let visited = new Set();
  let frontier = new Set();
  let order = [];

  async function run() {
    visited = new Set(); frontier = new Set(); order = [];
    const algo = algE.value;
    if (algo === 'bfs') {
      const q = [start]; visited.add(start);
      while (q.length) {
        const u = q.shift(); order.push(u); draw();
        await new Promise(r => setTimeout(r, 450));
        for (const v of ADJ[u]) {
          if (!visited.has(v)) { visited.add(v); q.push(v); frontier.add(v); }
        }
        frontier.delete(u);
      }
    } else {
      const stk = [start];
      while (stk.length) {
        const u = stk.pop();
        if (visited.has(u)) continue;
        visited.add(u); order.push(u); draw();
        await new Promise(r => setTimeout(r, 450));
        for (let i = ADJ[u].length - 1; i >= 0; i--) {
          const v = ADJ[u][i];
          if (!visited.has(v)) stk.push(v);
        }
      }
    }
    frontier.clear(); draw();
  }

  function draw() {
    const { ctx, w, h } = fitCv(cv);
    ctx.clearRect(0, 0, w, h);
    // edges
    ctx.strokeStyle = '#CCCCD0'; ctx.lineWidth = 1.4;
    for (const [a, b] of EDGES) {
      const na = NODES[a], nb = NODES[b];
      ctx.beginPath();
      ctx.moveTo(na.x * w, na.y * h);
      ctx.lineTo(nb.x * w, nb.y * h);
      ctx.stroke();
    }
    // nodes
    for (const n of NODES) {
      let fill = '#FFFFFF';
      if (visited.has(n.id)) fill = ACCENT;
      if (frontier.has(n.id)) fill = '#6EE7B7';
      if (n.id === start) fill = INK;
      ctx.fillStyle = fill;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(n.x * w, n.y * h, 16, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = (n.id === start || visited.has(n.id)) ? '#FFFFFF' : INK;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '11px JetBrains Mono';
      ctx.fillText(n.id, n.x * w, n.y * h);
    }
    ordE.textContent = order.join(' → ') || '—';
  }

  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width;
    const my = (e.clientY - r.top) / parseInt(cv.getAttribute('height'), 10);
    let best = -1, bd = Infinity;
    for (const n of NODES) {
      const d = Math.hypot(n.x - mx, n.y - my);
      if (d < bd) { bd = d; best = n.id; }
    }
    if (bd < 0.06) { start = best; visited.clear(); frontier.clear(); order = []; draw(); }
  });
  go.addEventListener('click', run);
  window.addEventListener('resize', draw);
  setTimeout(draw, 0);
})();

// =============================================================
// 5) Hash table
// =============================================================
(function hashTable() {
  const cv = document.getElementById('cv-h');
  const keyE = document.getElementById('h-key');
  const add  = document.getElementById('h-add');
  const clr  = document.getElementById('h-clr');
  const mE   = document.getElementById('h-m'); const mV = document.getElementById('h-mv');
  const pol  = document.getElementById('h-pol');
  const lfE  = document.getElementById('h-lf');
  const wcE  = document.getElementById('h-wc');

  let M = +mE.value;
  let table; let mode = 'chain';
  function reset() {
    M = +mE.value; mV.textContent = M;
    mode = pol.value;
    table = mode === 'chain' ? Array.from({ length: M }, () => []) : new Array(M).fill(null);
  }
  reset();

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return ((h % M) + M) % M;
  }

  function insert(k) {
    if (mode === 'chain') {
      const i = hash(k);
      if (!table[i].includes(k)) table[i].push(k);
    } else {
      let i = hash(k);
      for (let probe = 0; probe < M; probe++) {
        const j = (i + probe) % M;
        if (table[j] === null) { table[j] = { key: k, home: i }; return; }
        if ((table[j].key || table[j]) === k) return;
      }
    }
  }

  function draw() {
    const { ctx, w, h } = fitCv(cv);
    ctx.clearRect(0, 0, w, h);
    const padL = 36;
    const bucketH = (h - 18) / M;
    const items = mode === 'chain'
      ? table.reduce((s, b) => s + b.length, 0)
      : table.reduce((s, x) => s + (x ? 1 : 0), 0);
    let worst = 0;
    if (mode === 'chain') worst = Math.max(...table.map(b => b.length));
    lfE.textContent = (items / M).toFixed(2);
    wcE.textContent = mode === 'chain' ? worst : '—';

    // bucket boxes
    for (let i = 0; i < M; i++) {
      const y = 6 + i * bucketH;
      ctx.fillStyle = i % 2 === 0 ? '#FAFAFA' : '#fff';
      ctx.fillRect(padL, y, w - padL - 8, bucketH - 2);
      ctx.strokeStyle = RULE;
      ctx.strokeRect(padL + 0.5, y + 0.5, w - padL - 9, bucketH - 3);
      ctx.fillStyle = MUTED; ctx.textAlign = 'right'; ctx.font = '10px JetBrains Mono';
      ctx.fillText(`${i}`, padL - 6, y + bucketH / 2 + 4);
    }

    if (mode === 'chain') {
      for (let i = 0; i < M; i++) {
        const y = 6 + i * bucketH;
        let x = padL + 8;
        for (const k of table[i]) {
          const tw = ctx.measureText(k).width + 14;
          ctx.fillStyle = ACCENT; ctx.fillRect(x, y + 4, tw, bucketH - 10);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '11px JetBrains Mono';
          ctx.fillText(k, x + 7, y + bucketH / 2 + 4);
          x += tw + 10;
          // arrow → next
          if (table[i][table[i].indexOf(k) + 1]) {
            ctx.fillStyle = MUTED; ctx.fillText('→', x - 6, y + bucketH / 2 + 4);
          }
        }
      }
    } else {
      for (let i = 0; i < M; i++) {
        if (!table[i]) continue;
        const y = 6 + i * bucketH;
        const k = table[i].key || table[i];
        const home = table[i].home ?? i;
        const probed = home !== i;
        ctx.fillStyle = probed ? ORANGE : ACCENT;
        ctx.fillRect(padL + 8, y + 4, w - padL - 24, bucketH - 10);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '11px JetBrains Mono';
        ctx.fillText(k, padL + 14, y + bucketH / 2 + 4);
        if (probed) {
          ctx.textAlign = 'right';
          ctx.fillText(`probed from ${home}`, w - 14, y + bucketH / 2 + 4);
        }
      }
    }
  }

  add.addEventListener('click', () => {
    const k = keyE.value.trim(); if (!k) return;
    insert(k); keyE.value = ''; draw();
  });
  keyE.addEventListener('keydown', e => {
    if (e.key === 'Enter') { add.click(); }
  });
  clr.addEventListener('click', () => { reset(); draw(); });
  mE.addEventListener('input', () => { reset(); draw(); });
  pol.addEventListener('change', () => { reset(); draw(); });
  window.addEventListener('resize', draw);
  // pre-fill with a few
  for (const k of ['alice', 'bob', 'carol', 'dave', 'eve', 'frank']) insert(k);
  setTimeout(draw, 0);
})();

// =============================================================
// 6) N-Queens — animated backtracking
// =============================================================
(function nqueens() {
  const cv = document.getElementById('cv-q');
  const nE = document.getElementById('q-n'); const nV = document.getElementById('q-nv');
  const sE = document.getElementById('q-s'); const sV = document.getElementById('q-sv');
  const go = document.getElementById('q-go');
  const trE = document.getElementById('q-tr');
  const fnE = document.getElementById('q-fn');

  let N = 8, board = [], tries = 0, found = 0, running = false;
  function reset() {
    N = +nE.value; nV.textContent = N;
    board = new Array(N).fill(-1);
    tries = 0; found = 0;
    trE.textContent = 0; fnE.textContent = 0;
  }

  function draw(highlight = -1, attacked = []) {
    const { ctx, w, h } = fitCv(cv);
    ctx.clearRect(0, 0, w, h);
    const sz = Math.min(w, h) - 16;
    const ox = (w - sz) / 2, oy = 8;
    const cell = sz / N;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const dark = (r + c) % 2 === 0;
      let color = dark ? '#F3F4F6' : '#FFFFFF';
      if (attacked.some(([rr, cc]) => rr === r && cc === c)) color = '#FECACA';
      if (board[r] === c) color = dark ? '#A7F3D0' : '#D1FAE5';
      ctx.fillStyle = color;
      ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }
    // border
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, sz - 1, sz - 1);
    // queens
    for (let r = 0; r < N; r++) {
      if (board[r] < 0) continue;
      const c = board[r];
      ctx.fillStyle = r === highlight ? ACCENT : INK;
      ctx.beginPath();
      const cx = ox + c * cell + cell / 2;
      const cy = oy + r * cell + cell / 2;
      ctx.arc(cx, cy, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
      // crown ticks
      ctx.fillRect(cx - cell * 0.32, cy + cell * 0.32, cell * 0.64, cell * 0.06);
    }
  }

  function safe(row, col) {
    for (let r = 0; r < row; r++) {
      if (board[r] === col) return false;
      if (Math.abs(board[r] - col) === row - r) return false;
    }
    return true;
  }

  async function solve() {
    if (running) return;
    reset(); draw();
    running = true;
    const speed = () => +sE.value;
    sV.textContent = speed();
    async function rec(row) {
      if (!running) return false;
      if (row === N) { found++; fnE.textContent = found; draw(row - 1); await new Promise(r => setTimeout(r, 600)); return true; }
      for (let c = 0; c < N; c++) {
        tries++;
        if (!safe(row, c)) continue;
        board[row] = c;
        trE.textContent = tries;
        // Pace
        if (tries % Math.max(1, Math.floor(40 / speed())) === 0) {
          draw(row);
          await new Promise(r => requestAnimationFrame(r));
          sV.textContent = speed();
        }
        if (await rec(row + 1)) return true;
      }
      board[row] = -1;
      return false;
    }
    await rec(0);
    running = false;
  }

  nE.addEventListener('input', () => { reset(); draw(); });
  go.addEventListener('click', solve);
  window.addEventListener('resize', () => draw());
  reset(); setTimeout(draw, 0);
})();
