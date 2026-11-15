(function () {
  const $ = (id) => document.getElementById(id);
  const sim = () => window.appInstance;
  const CFG = window.SAVANA_CONFIG;

  const app = $('app');
  const hud = $('hud');
  const SPEEDS = [0.5, 1, 2];

  // ---------- Controls ----------

  function setPaused(paused) {
    sim().paused = paused;
    const btn = $('btn-pause');
    btn.setAttribute('aria-pressed', String(paused));
    btn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    btn.title = paused ? 'Resume (Space)' : 'Pause (Space)';
  }

  function setSpeed(speed) {
    sim().speed = speed;
    $('btn-speed').textContent = `${speed}×`;
  }

  // The reveal grows from whichever toggle is actually visible: the switch
  // when the HUD is open, the pill when it is collapsed.
  function revealOrigin() {
    return hud.classList.contains('collapsed') ? pill : $('switch-apoc');
  }

  function setApocalyptic(on) {
    const overlay = document.querySelector('.apocalypse-overlay');
    const r = revealOrigin().getBoundingClientRect();

    // Moving the origin changes the overlay's computed clip-path, which the
    // transition would animate (the circle drifts in from 50% 50%). Apply the
    // new origin with transitions off, flush styles, then re-enable.
    overlay.style.transition = 'none';
    document.documentElement.style.setProperty('--spawn-x', `${r.left + r.width / 2}px`);
    document.documentElement.style.setProperty('--spawn-y', `${r.top + r.height / 2}px`);
    void overlay.offsetWidth;
    overlay.style.transition = '';

    app.classList.toggle('apocalyptic', on);
    $('switch-apoc').setAttribute('aria-checked', String(on));
    sim().setApocalyptic(on);
  }

  const isApocalyptic = () => app.classList.contains('apocalyptic');

  // The dock is one glass surface that morphs between its full size and the
  // pill. We measure both natural sizes, then animate explicit width/height.
  const dock = $('dock');
  const dockFull = $('dock-full');
  const pill = $('pill');
  let sizes = null;

  function measure() {
    const avail = window.innerWidth - (window.innerWidth <= 920 ? 24 : 32);
    dock.classList.add('measuring');
    dockFull.style.cssText = `position:relative;left:auto;top:auto;translate:none;width:max-content;max-width:${avail}px`;
    const full = { w: Math.ceil(dockFull.offsetWidth), h: Math.ceil(dockFull.offsetHeight) };
    dockFull.style.cssText = '';
    pill.style.cssText = 'position:relative;inset:auto;width:max-content;padding:0 18px;height:40px';
    const small = { w: Math.ceil(pill.offsetWidth), h: 40 };
    pill.style.cssText = '';
    dock.style.setProperty('--full-w', `${full.w}px`);
    sizes = { full, small };
    return sizes;
  }

  function applySize(collapsed, animate) {
    const { full, small } = sizes || measure();
    const t = collapsed ? small : full;
    if (!animate) dock.classList.add('measuring');
    dock.style.width = `${t.w}px`;
    dock.style.height = `${t.h}px`;
    if (!animate) {
      void dock.offsetWidth;
      dock.classList.remove('measuring');
    }
  }

  function relayout() {
    measure();
    applySize(hud.classList.contains('collapsed'), false);
  }

  // Collapsed controls are visually hidden, so also take them out of the tab
  // order and the accessibility tree.
  function setCollapsed(collapsed, { moveFocus = false } = {}) {
    hud.classList.toggle('collapsed', collapsed);
    dockFull.inert = collapsed;
    pill.inert = !collapsed;
    applySize(collapsed, true);
    if (moveFocus) (collapsed ? pill : $('fold')).focus({ preventScroll: true });
  }

  function reset() {
    sim().reset();
    setPaused(false);
    setSpeed(1);
  }

  function wire() {
    $('btn-pause').addEventListener('click', () => setPaused(!sim().paused));
    $('btn-reset').addEventListener('click', reset);
    $('btn-speed').addEventListener('click', () => {
      setSpeed(SPEEDS[(SPEEDS.indexOf(sim().speed) + 1) % SPEEDS.length]);
    });

    const slider = $('slider-max-pop');
    slider.addEventListener('input', () => {
      CFG.maxPopulation = parseInt(slider.value, 10);
      $('val-max-pop').textContent = slider.value;
      });

    $('switch-apoc').addEventListener('click', () => setApocalyptic(!isApocalyptic()));

    $('fold').addEventListener('click', () => setCollapsed(true, { moveFocus: true }));
    $('pill').addEventListener('click', () => setCollapsed(false, { moveFocus: true }));

    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' && e.target.type !== 'range') return;
      if (e.code === 'Space' && tag !== 'button' && tag !== 'a') {
        e.preventDefault();
        setPaused(!sim().paused);
      } else if (e.key === 'a' || e.key === 'A') {
        setApocalyptic(!isApocalyptic());
      } else if (e.key === 'h' || e.key === 'H') {
        setCollapsed(!hud.classList.contains('collapsed'));
      }
    });

    window.addEventListener('resize', relayout);
  }

  // ---------- Population History ----------
  // Two lines on a shared scale that starts at 0. Each line ends in its Trait's
  // Boid shape, with the count beside it: the numbers lead, the lines recede.

  const historyCanvas = $('history');
  const GREY = 'rgba(128, 128, 128, 0.55)';
  const SCALE_STEPS = [20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000];
  const FONT = '"Google Sans Flex", system-ui, sans-serif';
  const SHAPES = window.SAVANA_SHAPES;
  const TRAITS = [
    { key: 'inter', name: 'Interdependent', shape: SHAPES.DART, round: false },
    { key: 'indiv', name: 'Individual', shape: SHAPES.SEED, round: true }
  ];
  const GUTTER_LEFT = 28;
  const GUTTER_RIGHT = 84;
  const MARKER = 4.5; // Boid-shape size at the end of each line

  // Size a canvas to its CSS box at device resolution; returns a ready 2d ctx.
  function prepare(canvas) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return null;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function palette() {
    if (hud.classList.contains('collapsed')) {
      return { inter: GREY, indiv: GREY, dim: GREY, fg: GREY, band: 'rgba(128, 128, 128, 0.12)' };
    }
    const cs = getComputedStyle(app);
    return {
      inter: cs.getPropertyValue('--interdependent').trim(),
      indiv: cs.getPropertyValue('--individual').trim(),
      dim: cs.getPropertyValue('--fg-dim').trim(),
      fg: cs.getPropertyValue('--fg').trim(),
      band: 'rgba(128, 128, 128, 0.16)'
    };
  }

  // Smallest round number that fits, so the scale is stable and starts at 0.
  function niceMax(needed) {
    return SCALE_STEPS.find((s) => s >= needed) || Math.ceil(needed / 500) * 500;
  }

  // The same silhouette as the Boid, pointing along the line (to the right).
  function drawMarker(ctx, trait, color, cx, cy) {
    const pts = trait.shape;
    const xs = pts.map((p) => p[0]);
    const mid = (Math.max(...xs) + Math.min(...xs)) / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = trait.round ? MARKER * 0.7 : 0;
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const x = cx + (px - mid) * MARKER;
      const y = cy + py * MARKER;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    if (trait.round) ctx.stroke();
  }

  function drawHistory() {
    const s = sim();
    if (!s || !s.history || s.history.length === 0) return;
    const data = s.history;
    const c = prepare(historyCanvas);
    if (!c) return;
    const { ctx, w, h } = c;
    const p = palette();

    const top = 8;
    const bottom = 6;
    const plotW = w - GUTTER_LEFT - GUTTER_RIGHT;
    const span = CFG.historySamples - 1;
    const x = (i) => GUTTER_LEFT + (plotW * i) / span;

    // Shared scale across both Traits; it always starts at 0.
    const peak = Math.max(...data.map((d) => Math.max(d.inter, d.indiv)));
    const capMax = Math.max(...data.map((d) => d.cap));
    const showCap = capMax <= peak * 1.8;
    const max = niceMax(Math.max(peak * 1.1, showCap ? capMax * 1.05 : 0));
    const y = (v) => h - bottom - (v / max) * (h - top - bottom);

    // Apocalyptic bands
    ctx.fillStyle = p.band;
    let start = -1;
    const flush = (end) => {
      if (start < 0) return;
      ctx.fillRect(x(start), 0, Math.max(2, x(end) - x(start)), h);
      start = -1;
    };
    data.forEach((d, i) => { if (d.apoc) { if (start < 0) start = i; } else flush(i); });
    flush(data.length - 1);

    // Baseline at 0, with the 0 and top-of-scale labels in the left gutter.
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.dim;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(GUTTER_LEFT, y(0) + 0.5);
    ctx.lineTo(w - GUTTER_RIGHT, y(0) + 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.dim;
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', GUTTER_LEFT - 5, y(0) - 4);
    ctx.fillText(String(max), GUTTER_LEFT - 5, top);

    // Cap line, labelled
    if (showCap) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = p.dim;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      data.forEach((d, i) => { if (i === 0) ctx.moveTo(x(i), y(d.cap)); else ctx.lineTo(x(i), y(d.cap)); });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.dim;
      ctx.font = `9px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('cap', GUTTER_LEFT + 3, y(data[0].cap) - 2);
    }

    // Trait switches: ticks rising from the baseline
    ctx.strokeStyle = p.dim;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    data.forEach((d, i) => {
      if (!d.switches) return;
      ctx.moveTo(x(i), y(0));
      ctx.lineTo(x(i), y(0) - Math.min(8, 2 + d.switches));
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Lines recede; the end shapes and labels are at full strength.
    const last = data[data.length - 1];
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.25;
    TRAITS.forEach((t) => {
      if (data.length > 1) {
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = p[t.key];
        ctx.beginPath();
        data.forEach((d, i) => { if (i === 0) ctx.moveTo(x(i), y(d[t.key])); else ctx.lineTo(x(i), y(d[t.key])); });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawMarker(ctx, t, p[t.key], x(data.length - 1), y(last[t.key]));
    });

    // Direct labels beside the line ends: count first, name quiet beneath.
    const lx = x(data.length - 1) + 12;
    const ys = TRAITS.map((t) => y(last[t.key]));
    const gap = 28;
    const order = ys.map((v, i) => i).sort((a, b) => ys[a] - ys[b]);
    for (let i = 1; i < order.length; i++) {
      if (ys[order[i]] - ys[order[i - 1]] < gap) ys[order[i]] = ys[order[i - 1]] + gap;
    }
    TRAITS.forEach((t, i) => {
      const cy = Math.min(h - 14, Math.max(10, ys[i]));
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.fg;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(String(last[t.key]), lx, cy - 5);
      ctx.fillStyle = p.dim;
      ctx.font = `400 9px ${FONT}`;
      ctx.fillText(t.name, lx, cy + 8);
    });
  }

  function render() {
    const s = sim();
    if (!s || !s.census) return;
    const { INTERDEPENDENT: interdependent, INDIVIDUAL: individual } = s.census;
    $('pill-total').textContent = interdependent.total + individual.total;
    drawHistory();
  }

  function start() {
    if (!sim()) return requestAnimationFrame(start);
    wire();
    measure();
    setCollapsed(false);
    applySize(false, false);
    if (document.fonts) document.fonts.ready.then(relayout);
    // Render the HUD at a relaxed ~10 fps; the simulation runs on its own loop.
    setInterval(render, 100);
    render();
  }

  start();
})();
