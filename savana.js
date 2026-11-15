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

  class Boid {
    constructor(world, traitType = null, parent = null, initialAge = 0) {
      this.world = world;
      this.traitType = traitType || (Math.random() > 0.6 ? 'INTERDEPENDENT' : 'INDIVIDUAL');
      this.trait = CONFIG.traits[this.traitType];
      this.color = this.trait.colors[Math.floor(Math.random() * this.trait.colors.length)];
      this.herdId = parent ? parent.herdId : (this.traitType === 'INTERDEPENDENT' ? nextHerdId : 0);

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
      this.wrap();

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

    draw(ctx) {
      const size = 5.5 * this.scale;
      ctx.save();
      ctx.translate(this.position.x, this.position.y);
      ctx.rotate(this.heading);

      ctx.fillStyle = this.color;
      ctx.globalAlpha = 0.82;

      ctx.beginPath();
      ctx.moveTo(size * 2.3, 0);
      ctx.lineTo(-size, size * 0.85);
      ctx.lineTo(-size * 0.35, 0);
      ctx.lineTo(-size, -size * 0.85);
      ctx.closePath();
      ctx.fill();

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
      this.grid = new SpatialGrid(CONFIG.gridCell);
      this.scratch = [];
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

    get effectiveCap() {
      return Math.round(CONFIG.maxPopulation * (this.apocalyptic ? CONFIG.apocalypse.capFactor : 1));
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
        const deathChance = (baseDeath * mortalityFactor * (1 - Math.min(0.6, abundanceFactor))) + (overpopFactor * 0.005);

        if (Math.random() < deathChance || b.age > 20000) {
          this.boids.splice(i, 1);
        }
      }

      this.boids.push(...newBoids);
      this.manageHerds();
    }

    render() {
      this.ctx.clearRect(0, 0, this.world.width, this.world.height);
      for (const b of this.boids) b.draw(this.ctx);
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

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!window.appInstance) new App();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.appInstance) new App();
    });
  }
})();
