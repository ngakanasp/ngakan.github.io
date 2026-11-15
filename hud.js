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

  // ---------- Census rendering ----------

  function renderTrait(prefix, data) {
    $(`count-${prefix}`).textContent = data.total;
    $(`cs-${prefix}`).textContent =
      `neonate ${data.neonate} · juvenile ${data.juvenile} · mature ${data.mature}`;
    [data.neonate, data.juvenile, data.mature].forEach((n, i) => {
      $(`st-${prefix}-${i}`).style.flexGrow = Math.max(n, 0.001);
    });
  }

  function render() {
    const s = sim();
    if (!s || !s.census) return;
    const { INTERDEPENDENT: interdependent, INDIVIDUAL: individual } = s.census;
    const total = interdependent.total + individual.total;

    $('pill-total').textContent = total;
    renderTrait('inter', interdependent);
    renderTrait('indiv', individual);
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
