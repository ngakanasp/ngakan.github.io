(function () {
  const $ = (id) => document.getElementById(id);
  const sim = () => window.appInstance;
  const CFG = window.SAVANA_CONFIG;

  const app = $('app');
  const hud = $('hud');
  const SPEEDS = [0.5, 1, 2];
  const HISTORY = 90;      // sparkline points
  const SAMPLE_MS = 500;   // one sample per half second
  const history = [];

  // ---------- Controls ----------

  function setPaused(p) {
    sim().paused = p;
    $('btn-pause').setAttribute('aria-pressed', String(p));
  }

  function setApocalyptic(on, originEl) {
    const overlay = document.querySelector('.apocalypse-overlay');
    const el = originEl || $('switch-apoc');
    const r = el.getBoundingClientRect();

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
    updateCapReadout();
  }

  function setCollapsed(c) {
    hud.classList.toggle('collapsed', c);
    if (c) $('pill').focus({ preventScroll: true }); else $('fold').focus({ preventScroll: true });
  }

  function updateCapReadout() {
    const s = sim();
    $('cap-readout').textContent = s.apocalyptic
      ? `cap ${s.effectiveCap} · scarcity`
      : `cap ${s.effectiveCap}`;
  }

  function wire() {
    $('btn-pause').addEventListener('click', () => setPaused(!sim().paused));
    $('btn-reset').addEventListener('click', () => { sim().reset(); history.length = 0; });

    $('btn-speed').addEventListener('click', (e) => {
      const i = (SPEEDS.indexOf(sim().speed) + 1) % SPEEDS.length;
      sim().speed = SPEEDS[i];
      e.currentTarget.textContent = `${SPEEDS[i]}×`;
    });

    const slider = $('slider-max-pop');
    slider.addEventListener('input', () => {
      CFG.maxPopulation = parseInt(slider.value, 10);
      $('val-max-pop').textContent = slider.value;
      updateCapReadout();
    });

    $('switch-apoc').addEventListener('click', (e) => {
      setApocalyptic(!app.classList.contains('apocalyptic'), e.currentTarget);
    });

    $('fold').addEventListener('click', () => setCollapsed(true));
    $('pill').addEventListener('click', () => setCollapsed(false));

    // Small screens: the census shows its headline; tap to expand.
    $('census-toggle').addEventListener('click', () => {
      const open = $('census').classList.toggle('open');
      $('census-toggle').setAttribute('aria-expanded', String(open));
    });

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' && e.target.type !== 'range') return;
      if (e.code === 'Space' && tag !== 'button' && tag !== 'a') {
        e.preventDefault();
        setPaused(!sim().paused);
      } else if (e.key === 'a' || e.key === 'A') {
        setApocalyptic(!app.classList.contains('apocalyptic'));
      } else if (e.key === 'h' || e.key === 'H') {
        setCollapsed(!hud.classList.contains('collapsed'));
      }
    });
  }

  // ---------- Census rendering ----------

  function renderTrait(prefix, data) {
    $(`count-${prefix}`).textContent = data.total;
    $(`lg-${prefix}`).textContent =
      `neonate ${data.neonate} · juvenile ${data.juvenile} · mature ${data.mature}`;
    [data.neonate, data.juvenile, data.mature].forEach((n, i) => {
      $(`st-${prefix}-${i}`).style.flexGrow = Math.max(n, 0.001);
    });
  }

  function renderSpark(cap) {
    if (history.length < 2) return;
    const W = 240, H = 44, pad = 4;
    const max = Math.max(cap, ...history) * 1.05;
    const x = (i) => (i / (HISTORY - 1)) * W + (W - ((history.length - 1) / (HISTORY - 1)) * W);
    const y = (v) => H - pad - (v / max) * (H - pad * 2);
    const pts = history.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    $('spark-line').setAttribute('d', 'M' + pts.join('L'));
    $('spark-area').setAttribute('d', `M${x(0).toFixed(1)},${H}L${pts.join('L')}L${x(history.length - 1).toFixed(1)},${H}Z`);
    const cy = y(cap).toFixed(1);
    const capLine = $('spark-cap');
    capLine.setAttribute('y1', cy);
    capLine.setAttribute('y2', cy);
  }

  function render() {
    const s = sim();
    if (!s || !s.stats) return;
    const { INTERDEPENDENT: a, INDIVIDUAL: b } = s.stats;
    const total = a.total + b.total;

    $('total').textContent = total;
    $('pill-total').textContent = total;
    renderTrait('inter', a);
    renderTrait('indiv', b);
    $('mix-inter').style.width = total ? `${(a.total / total) * 100}%` : '50%';
    $('mix-indiv').style.width = total ? `${(b.total / total) * 100}%` : '50%';
    updateCapReadout();
  }

  function sample() {
    const s = sim();
    if (!s || !s.stats || s.paused) return;
    history.push(s.boids.length);
    if (history.length > HISTORY) history.shift();
    renderSpark(s.effectiveCap);
  }

  function start() {
    if (!sim()) return requestAnimationFrame(start);
    wire();
    // Render the HUD at a relaxed ~10 fps; the simulation runs on its own loop.
    setInterval(render, 100);
    setInterval(sample, SAMPLE_MS);
    render();
  }

  start();
})();
