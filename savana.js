(function () {
  const CONFIG = {
    initialCount: 130,
    maxPopulation: 300,
    perception: 130,
    reproductionCooldown: 500,
    herdLimits: { min: 30, max: 40 },
    interactionRange: 150,
    interactionForce: 2.8,
    step: 1 / 60, // fixed simulation timestep (seconds)
    maxStepsPerFrame: 3,
    gridCell: 100,
    apocalypse: { capFactor: 0.6, mortalityFactor: 2.5, fleeFactor: 1.6 },
    wrapMargin: 20,
    capEasePerSecond: 0.05, // fraction of the gap the working cap closes each second
    maxOverpopDeathsPerSecond: 1.5,
    remains: { steps: 180, max: 150, greyBy: 0.3 }, // ~3s at 60 steps/s
    trail: { points: 8, every: 2 },
    herdLinkRange: 70,
    morphSteps: 60,
    historySamples: 120, // Population History: one sample per simulated second
    traits: {
      INTERDEPENDENT: {
        cohesion: 2.2,
        alignment: 1.6,
        separation: 2.2,
        spaceHunger: 0.1,
        colors: ['#440154', '#3b528b', '#21918c'],
        reproChance: 0.008,
        mortality: 0.0006
      },
      INDIVIDUAL: {
        cohesion: 0.3,
        alignment: 0.5,
        separation: 4.5,
        spaceHunger: 0.7,
        colors: ['#5ec962', '#fde725', '#b5de2b'],
        reproChance: 0.004,
        mortality: 0.0003
      }
    },
    stages: {
      NEONATE: { scale: 0.25, speed: 3.2, ageLimit: 500 },
      JUVENILE: { scale: 0.45, speed: 2.2, ageLimit: 1200 },
      MATURE: { scale: 0.75, speed: 1.4, reproductionAge: 1400 }
    }
  };

  let nextHerdId = 1;

  class Vector {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(n) { this.x *= n; this.y *= n; return this; }
    div(n) { this.x /= n; this.y /= n; return this; }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    setMag(n) {
      const m = this.mag();
      if (m !== 0) { this.mult(n / m); }
      return this;
    }
    limit(n) {
      const m = this.mag();
      if (m > n) { this.setMag(n); }
      return this;
    }
    static dist(v1, v2) {
      return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
    }
    copy() { return new Vector(this.x, this.y); }
  }

  // Uniform grid so neighbour lookups are O(n) instead of O(n^2).
  class SpatialGrid {
    constructor(cell) {
      this.cell = cell;
      this.cells = new Map();
    }
    key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
    rebuild(boids) {
      this.cells.clear();
      for (const b of boids) {
        const k = this.key(Math.floor(b.position.x / this.cell), Math.floor(b.position.y / this.cell));
        const bucket = this.cells.get(k);
        if (bucket) bucket.push(b); else this.cells.set(k, [b]);
      }
    }
    near(b, out) {
      out.length = 0;
      const cx = Math.floor(b.position.x / this.cell);
      const cy = Math.floor(b.position.y / this.cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = this.cells.get(this.key(cx + dx, cy + dy));
          if (bucket) for (const o of bucket) out.push(o);
        }
      }
      return out;
    }
  }

  const TAU = Math.PI * 2;
  const smoothstep = (t) => t * t * (3 - 2 * t);

  const DART = [[2.3, 0], [-1, 0.85], [-0.35, 0], [-1, -0.85]];
  const SEED = [[1.7, 0], [0.1, 0.9], [-1.1, 0], [0.1, -0.9]];
  const REMAINS_GREY = '#8c8c8c';
  let nextBoidId = 0;

  // Silhouette between a seed (m = 0, Individual) and a dart (m = 1, Interdependent).
  function traceShape(ctx, size, m) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = (SEED[i][0] + (DART[i][0] - SEED[i][0]) * m) * size;
      const y = (SEED[i][1] + (DART[i][1] - SEED[i][1]) * m) * size;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Filled body; the Individual end of the morph gets a rounded outline.
  function paintBody(ctx, size, m, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.7 * (1 - m);
    traceShape(ctx, size, m);
    ctx.fill();
    if (m < 0.98) ctx.stroke();
  }

  class Boid {
    constructor(world, traitType = null, parent = null, initialAge = 0) {
      this.world = world;
      this.id = nextBoidId++;
      this.traitType = traitType || (Math.random() > 0.6 ? 'INTERDEPENDENT' : 'INDIVIDUAL');
      this.trait = CONFIG.traits[this.traitType];
      this.color = this.trait.colors[Math.floor(Math.random() * this.trait.colors.length)];
      this.herdId = parent ? parent.herdId : (this.traitType === 'INTERDEPENDENT' ? nextHerdId : 0);
      this.shape = this.traitType === 'INTERDEPENDENT' ? 1 : 0; // silhouette morph
      this.pulse = 0; // trait-switch ring, 1 -> 0
      this.pulseColor = this.color;
      this.trail = [];
      this.trailTick = 0;

      if (parent) {
        // Offset from the parent so separation never sees d = 0.
        const a = Math.random() * TAU;
        this.position = new Vector(parent.position.x + Math.cos(a) * 8, parent.position.y + Math.sin(a) * 8);
        this.velocity = parent.velocity.copy().mult(0.5);
      } else {
        this.position = new Vector(Math.random() * world.width, Math.random() * world.height);
        this.velocity = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      }

      this.acceleration = new Vector();
      this.age = initialAge;
      this.reproCooldown = 0;
      this.wanderAngle = Math.random() * TAU;
      this.maxForce = 0.08;
      this.hasPartner = false;
      this.updateStage(true);
      this.heading = Math.atan2(this.velocity.y, this.velocity.x);
    }

    updateStage(snap = false) {
      if (this.age < CONFIG.stages.NEONATE.ageLimit) {
        this.stage = 'NEONATE';
      } else if (this.age < CONFIG.stages.JUVENILE.ageLimit) {
        this.stage = 'JUVENILE';
      } else {
        this.stage = 'MATURE';
      }

      const stageConfig = CONFIG.stages[this.stage];
      // Ease size and speed toward the stage target so stage changes don't pop.
      if (snap || this.scale === undefined) {
        this.scale = stageConfig.scale;
        this.maxSpeed = stageConfig.speed;
      } else {
        this.scale += (stageConfig.scale - this.scale) * 0.02;
        this.maxSpeed += (stageConfig.speed - this.maxSpeed) * 0.02;
      }
    }

    wrap() {
      const m = CONFIG.wrapMargin;
      const { width, height } = this.world;
      if (this.position.x < -m) this.position.x = width + m;
      else if (this.position.x > width + m) this.position.x = -m;
      if (this.position.y < -m) this.position.y = height + m;
      else if (this.position.y > height + m) this.position.y = -m;
    }

    steer(neighbours, pointer, fleeFactor = 1) {
      const alignment = new Vector();
      const cohesion = new Vector();
      const separation = new Vector();

      const perception = CONFIG.perception * this.scale;
      const personalSpace = 25 * this.scale;
      let totalTrait = 0;
      let totalGlobal = 0;
      let totalSeparating = 0;

      this.hasPartner = false;

      for (const other of neighbours) {
        if (other === this) continue;
        const d = Vector.dist(this.position, other.position);
        if (d >= perception) continue;

        if (this.traitType === 'INTERDEPENDENT' && other.herdId === this.herdId) {
          alignment.add(other.velocity);
          cohesion.add(other.position);
          totalTrait++;
          if (d < perception * 0.6 && other.stage === 'MATURE') this.hasPartner = true;
        } else if (this.traitType === 'INDIVIDUAL' && other.traitType === 'INDIVIDUAL') {
          alignment.add(other.velocity);
          cohesion.add(other.position);
          totalTrait++;
          if (d < perception * 0.45 && other.stage === 'MATURE') this.hasPartner = true;
        }

        // Separation is global. Weight falls off linearly and is bounded, so
        // two boids on top of each other cannot produce a force spike.
        if (d < personalSpace) {
          const dd = Math.max(d, 1);
          const w = (1 - dd / personalSpace);
          let dx = this.position.x - other.position.x;
          let dy = this.position.y - other.position.y;
          if (d < 0.001) { const a = Math.random() * TAU; dx = Math.cos(a); dy = Math.sin(a); }
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          separation.x += (dx / len) * w;
          separation.y += (dy / len) * w;
          totalSeparating++;
        }
        totalGlobal++;
      }

      if (totalTrait > 0) {
        alignment.div(totalTrait).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce);
        cohesion.div(totalTrait).sub(this.position).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce);
      }
      if (totalSeparating > 0) {
        separation.div(totalSeparating).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce);
      }

      // Space hunger: smooth angular wander plus crowding relief.
      this.wanderAngle += (Math.random() - 0.5) * 0.15;
      const wander = new Vector(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle));
      const spaceForce = wander.add(totalGlobal > 5 ? separation.copy() : new Vector()).limit(this.maxForce);

      this.acceleration.add(alignment.mult(this.trait.alignment));
      this.acceleration.add(cohesion.mult(this.trait.cohesion));
      this.acceleration.add(separation.mult(this.trait.separation));
      this.acceleration.add(spaceForce.mult(this.trait.spaceHunger * 12));

      // Scatter: strength eases in smoothly with proximity (no on/off edge).
      if (pointer) {
        const d = Vector.dist(this.position, pointer);
        if (d < CONFIG.interactionRange) {
          const t = smoothstep(1 - d / CONFIG.interactionRange);
          const flee = this.position.copy().sub(pointer);
          if (flee.mag() < 0.001) flee.x = 1;
          flee.setMag(this.maxForce * CONFIG.interactionForce * fleeFactor * t);
          this.acceleration.add(flee);
        }
      }

      // Slow pull toward the visible area.
      const center = new Vector(this.world.width / 2, this.world.height / 2);
      this.acceleration.add(center.sub(this.position).setMag(0.012));
    }

    update(overpopFactor = 0) {
      this.age++;
      if (this.reproCooldown > 0) this.reproCooldown--;
      this.updateStage();

      if (this.stage === 'JUVENILE' && this.traitType === 'INTERDEPENDENT' && Math.random() < 0.00045) {
        this.switchTrait('INDIVIDUAL');
      }
      // (Mature Individual -> Interdependent is handled by the App, which knows the herds.)

      this.velocity.add(this.acceleration);

      // Lethargy: boids slow down when resources are scarce.
      const dynamicMaxSpeed = this.maxSpeed * (1 - Math.min(0.4, overpopFactor * 0.15));
      this.velocity.limit(dynamicMaxSpeed);

      this.position.add(this.velocity);
      this.acceleration.mult(0);
      const px = this.position.x;
      const py = this.position.y;
      this.wrap();
      if (this.position.x !== px || this.position.y !== py) this.trail.length = 0;
      else if (++this.trailTick >= CONFIG.trail.every) {
        this.trailTick = 0;
        this.trail.push(px, py);
        if (this.trail.length > CONFIG.trail.points * 2) this.trail.splice(0, 2);
      }

      const target = this.traitType === 'INTERDEPENDENT' ? 1 : 0;
      const dm = 1 / CONFIG.morphSteps;
      if (this.shape < target) this.shape = Math.min(target, this.shape + dm);
      else if (this.shape > target) this.shape = Math.max(target, this.shape - dm);
      if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dm);

      // Smooth heading; keep the last heading when nearly stationary.
      if (this.velocity.mag() > 0.05) {
        const target = Math.atan2(this.velocity.y, this.velocity.x);
        let diff = target - this.heading;
        diff = ((diff + Math.PI) % TAU + TAU) % TAU - Math.PI;
        this.heading += diff * 0.25;
      }
    }

    switchTrait(newTraitType, herdId = null) {
      this.traitType = newTraitType;
      this.trait = CONFIG.traits[this.traitType];
      this.color = this.trait.colors[Math.floor(Math.random() * this.trait.colors.length)];
      this.herdId = this.traitType === 'INTERDEPENDENT' ? (herdId ?? ++nextHerdId) : 0;
      this.pulse = 1;
      this.pulseColor = this.color;
      this.world.switches = (this.world.switches || 0) + 1;
    }

    canReproduce(abundanceFactor = 0, overpopFactor = 0) {
      let reproChance = this.trait.reproChance * (1 + abundanceFactor * 2.5);
      if (overpopFactor > 0) reproChance *= 1 / (1 + overpopFactor * 2.5);

      return (
        this.stage === 'MATURE' &&
        this.age > CONFIG.stages.MATURE.reproductionAge &&
        this.reproCooldown === 0 &&
        this.hasPartner &&
        Math.random() < reproChance
      );
    }

    reproduce() {
      this.reproCooldown = CONFIG.reproductionCooldown;
      const trait = Math.random() < 0.08 ? (this.traitType === 'INTERDEPENDENT' ? 'INDIVIDUAL' : 'INTERDEPENDENT') : this.traitType;
      return new Boid(this.world, trait, this);
    }

    drawTrail(ctx) {
      const t = this.trail;
      const n = t.length / 2;
      if (n < 1) return;
      const size = 5.5 * this.scale;
      ctx.strokeStyle = this.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.8, size * 0.35);
      let lx = t[0];
      let ly = t[1];
      for (let i = 1; i <= n; i++) {
        const x = i < n ? t[i * 2] : this.position.x;
        const y = i < n ? t[i * 2 + 1] : this.position.y;
        ctx.globalAlpha = 0.28 * (i / n);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(x, y);
        ctx.stroke();
        lx = x;
        ly = y;
      }
    }

    draw(ctx) {
      const size = 5.5 * this.scale;
      this.drawTrail(ctx);

      ctx.save();
      ctx.translate(this.position.x, this.position.y);

      if (this.pulse > 0) {
        ctx.globalAlpha = this.pulse * 0.7;
        ctx.strokeStyle = this.pulseColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, size * (2 + (1 - this.pulse) * 5), 0, TAU);
        ctx.stroke();
      }

      ctx.rotate(this.heading);
      ctx.globalAlpha = 0.82;
      paintBody(ctx, size, smoothstep(this.shape), this.color);
      ctx.restore();
    }
  }

  // What a dead Boid leaves behind: stops, greys out, fades.
  class Remains {
    constructor(b) {
      this.x = b.position.x;
      this.y = b.position.y;
      this.vx = b.velocity.x;
      this.vy = b.velocity.y;
      this.heading = b.heading;
      this.size = 5.5 * b.scale;
      this.shape = b.shape;
      this.color = b.color;
      this.age = 0;
    }

    update() {
      this.age++;
      this.vx *= 0.9;
      this.vy *= 0.9;
      this.x += this.vx;
      this.y += this.vy;
      return this.age < CONFIG.remains.steps;
    }

    draw(ctx) {
      const t = this.age / CONFIG.remains.steps;
      const grey = Math.min(1, t / CONFIG.remains.greyBy);
      const m = smoothstep(this.shape);
      const size = this.size * (1 - 0.4 * t);
      const alpha = 0.82 * (1 - t) * (1 - t);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.heading);
      if (grey < 1) {
        ctx.globalAlpha = alpha * (1 - grey);
        paintBody(ctx, size, m, this.color);
      }
      ctx.globalAlpha = alpha * grey;
      paintBody(ctx, size, m, REMAINS_GREY);
      ctx.restore();
    }
  }

  class App {
    constructor() {
      window.appInstance = this;
      this.canvas = document.getElementById('bg');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.world = { width: 0, height: 0 };
      this.boids = [];
      this.remains = [];
      this.grid = new SpatialGrid(CONFIG.gridCell);
      this.scratch = [];
      this.linkScratch = [];
      this.cullBudget = 0;
      this.workingCap = null;
      this.history = [];
      this.historyTick = 0;
      this.isActive = true;
      this.paused = false;
      this.speed = 1;
      this.interactionPos = null;
      this.apocalyptic = false;
      this.accumulator = 0;
      this.lastTime = performance.now();

      this.init();
      this.setupInteraction();
      window.addEventListener('resize', () => this.resize());
      requestAnimationFrame((t) => this.frame(t));
    }

    setupInteraction() {
      const updatePos = (x, y) => {
        const rect = this.canvas.getBoundingClientRect();
        this.interactionPos = new Vector(x - rect.left, y - rect.top);
      };
      const clear = () => { this.interactionPos = null; };

      window.addEventListener('mousemove', (e) => updatePos(e.clientX, e.clientY));
      document.documentElement.addEventListener('mouseleave', clear);
      // Touches that land on the HUD operate it; they must not scatter boids.
      const onHud = (e) => e.target.closest && e.target.closest('.glass');
      window.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0 && !onHud(e)) updatePos(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0 && !onHud(e)) updatePos(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });
      window.addEventListener('touchend', clear);
    }

    init() {
      this.resize();
      this.boids = [];
      this.remains = [];
      this.cullBudget = 0;
      this.workingCap = this.targetCap;
      this.history = [];
      this.historyTick = 0;
      this.world.switches = 0;
      nextHerdId = 1;

      const total = CONFIG.initialCount;
      // 50% Neonate, 40% Juvenile, 10% Mature
      const counts = { NEONATE: total * 0.5, JUVENILE: total * 0.4, MATURE: total * 0.1 };

      Object.entries(counts).forEach(([stage, count]) => {
        for (let i = 0; i < count; i++) {
          let age = 0;
          if (stage === 'NEONATE') age = Math.random() * CONFIG.stages.NEONATE.ageLimit;
          else if (stage === 'JUVENILE') age = CONFIG.stages.NEONATE.ageLimit + Math.random() * (CONFIG.stages.JUVENILE.ageLimit - CONFIG.stages.NEONATE.ageLimit);
          else age = CONFIG.stages.JUVENILE.ageLimit + Math.random() * 500;

          this.boids.push(new Boid(this.world, null, null, age));
        }
      });
    }

    reset() { this.init(); }

    manageHerds() {
      const herds = {};
      this.boids.forEach(b => {
        if (b.traitType === 'INTERDEPENDENT') {
          (herds[b.herdId] = herds[b.herdId] || []).push(b);
        }
      });

      Object.values(herds).forEach((members) => {
        if (members.length > CONFIG.herdLimits.max) {
          nextHerdId++;
          members.slice(0, Math.floor(members.length / 2)).forEach(m => { m.herdId = nextHerdId; });
        }
      });
    }

    nearestHerd(boid) {
      let best = null;
      let bestD = Infinity;
      for (const o of this.boids) {
        if (o.traitType !== 'INTERDEPENDENT') continue;
        const d = Vector.dist(boid.position, o.position);
        if (d < bestD) { bestD = d; best = o.herdId; }
      }
      return best;
    }

    get targetCap() {
      return CONFIG.maxPopulation * (this.apocalyptic ? CONFIG.apocalypse.capFactor : 1);
    }

    // The cap the ecosystem actually feels: it eases toward the target so a
    // lowered slider produces a decline, not a cliff.
    get effectiveCap() {
      return Math.round(this.workingCap ?? this.targetCap);
    }

    easeCap() {
      const target = this.targetCap;
      if (this.workingCap === null) this.workingCap = target;
      const gap = target - this.workingCap;
      if (Math.abs(gap) < 0.5) this.workingCap = target;
      else this.workingCap += gap * CONFIG.capEasePerSecond * CONFIG.step;
    }

    // Overpopulation victims: favour Mature/old and isolated Boids, spare Neonates.
    pickVictim() {
      let total = 0;
      const weights = this.boids.map((b) => {
        let w = b.stage === 'NEONATE' ? 0 : b.stage === 'JUVENILE' ? 0.3 : 1 + Math.min(2, b.age / 5000);
        if (!b.hasPartner) w *= 1.5;
        total += w;
        return w;
      });
      if (total <= 0) return -1;
      let r = Math.random() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
      }
      return weights.length - 1;
    }

    kill(index) {
      const [b] = this.boids.splice(index, 1);
      this.remains.push(new Remains(b));
      if (this.remains.length > CONFIG.remains.max) this.remains.shift();
    }

    setApocalyptic(on) { this.apocalyptic = !!on; }

    stop() { this.isActive = false; }
    start() {
      if (this.isActive) return;
      this.isActive = true;
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.world.width = window.innerWidth;
      this.world.height = window.innerHeight;
      this.canvas.width = Math.round(this.world.width * dpr);
      this.canvas.height = Math.round(this.world.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    frame(now) {
      if (!this.isActive) return;

      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;

      if (!this.paused) {
        this.accumulator += dt * this.speed;
        let steps = 0;
        while (this.accumulator >= CONFIG.step && steps < CONFIG.maxStepsPerFrame) {
          this.step();
          this.accumulator -= CONFIG.step;
          steps++;
        }
        if (steps === CONFIG.maxStepsPerFrame) this.accumulator = 0; // drop backlog
      }

      this.render();
      this.updateCensus();
      requestAnimationFrame((t) => this.frame(t));
    }

    step() {
      this.easeCap();
      const cap = this.effectiveCap;
      const diff = this.boids.length - cap;
      const overpopFactor = Math.max(0, diff / 30);
      const abundanceFactor = Math.max(0, -diff / 100);

      const fleeFactor = this.apocalyptic ? CONFIG.apocalypse.fleeFactor : 1;
      const mortalityFactor = this.apocalyptic ? CONFIG.apocalypse.mortalityFactor : 1;

      // Phase 1: every boid reads the same snapshot of positions.
      this.grid.rebuild(this.boids);
      for (const b of this.boids) {
        b.steer(this.grid.near(b, this.scratch), this.interactionPos, fleeFactor);
      }

      // Phase 2: integrate, reproduce, die.
      const newBoids = [];
      for (let i = this.boids.length - 1; i >= 0; i--) {
        const b = this.boids[i];
        b.update(overpopFactor);

        if (b.stage === 'MATURE' && b.traitType === 'INDIVIDUAL' && Math.random() < 0.00025) {
          const herd = this.nearestHerd(b);
          b.switchTrait('INTERDEPENDENT', herd);
        }

        if (b.canReproduce(abundanceFactor, overpopFactor) && this.boids.length + newBoids.length < cap) {
          newBoids.push(b.reproduce());
        }

        const isAdult = b.stage === 'MATURE' && b.age > CONFIG.stages.MATURE.reproductionAge;
        const baseDeath = isAdult ? b.trait.mortality : 0.00005;
        const deathChance = baseDeath * mortalityFactor * (1 - Math.min(0.6, abundanceFactor));

        if (Math.random() < deathChance || b.age > 20000) {
          this.kill(i);
        }
      }

      // Overpopulation culls are rationed so a lower cap is a gradual decline.
      if (diff > 0) {
        this.cullBudget = Math.min(2, this.cullBudget + CONFIG.maxOverpopDeathsPerSecond * CONFIG.step);
        if (this.cullBudget >= 1) {
          const v = this.pickVictim();
          if (v >= 0) { this.kill(v); this.cullBudget -= 1; }
        }
      } else {
        this.cullBudget = 0;
      }

      for (let i = this.remains.length - 1; i >= 0; i--) {
        if (!this.remains[i].update()) this.remains.splice(i, 1);
      }

      this.boids.push(...newBoids);
      this.manageHerds();
      this.recordHistory();
    }

    // Population History: one sample per simulated second, last two minutes.
    recordHistory() {
      if (++this.historyTick < Math.round(1 / CONFIG.step)) return;
      this.historyTick = 0;
      let inter = 0;
      for (const b of this.boids) if (b.traitType === 'INTERDEPENDENT') inter++;
      this.history.push({
        inter,
        indiv: this.boids.length - inter,
        cap: this.workingCap,
        apoc: this.apocalyptic ? 1 : 0,
        switches: this.world.switches
      });
      this.world.switches = 0;
      if (this.history.length > CONFIG.historySamples) this.history.shift();
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.world.width, this.world.height);
      for (const r of this.remains) r.draw(ctx);
      this.drawHerdLinks(ctx);
      for (const b of this.boids) b.draw(ctx);
      ctx.globalAlpha = 1;
    }

    // Faint lines between nearby members of the same Herd.
    drawHerdLinks(ctx) {
      this.grid.rebuild(this.boids);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = CONFIG.traits.INTERDEPENDENT.colors[1];
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const b of this.boids) {
        if (b.traitType !== 'INTERDEPENDENT') continue;
        for (const o of this.grid.near(b, this.linkScratch)) {
          if (o.id <= b.id || o.traitType !== 'INTERDEPENDENT' || o.herdId !== b.herdId) continue;
          if (Vector.dist(b.position, o.position) < CONFIG.herdLinkRange) {
            ctx.moveTo(b.position.x, b.position.y);
            ctx.lineTo(o.position.x, o.position.y);
          }
        }
      }
      ctx.stroke();
    }

    updateCensus() {
      const stats = {
        INTERDEPENDENT: { total: 0, neonate: 0, juvenile: 0, mature: 0 },
        INDIVIDUAL: { total: 0, neonate: 0, juvenile: 0, mature: 0 }
      };

      for (const b of this.boids) {
        const t = stats[b.traitType];
        t.total++;
        if (b.stage === 'NEONATE') t.neonate++;
        else if (b.stage === 'JUVENILE') t.juvenile++;
        else t.mature++;
      }

      this.census = stats;
    }
  }

  window.App = App;
  window.SAVANA_CONFIG = CONFIG;
  window.SAVANA_SHAPES = { DART, SEED };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!window.appInstance) new App();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.appInstance) new App();
    });
  }
})();
