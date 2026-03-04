(function () {
  const VIRIDIS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725', '#b5de2b'];

  const CONFIG = {
    initialCount: 130,
    maxPopulation: 300,
    perception: 130,
    reproductionCooldown: 500,
    groupLimits: { min: 30, max: 40 },
    interactionRange: 150,
    interactionForce: 2.8,
    traits: {
      GROUP: {
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

  let nextGroupId = 1;

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

  class Boid {
    constructor(canvas, traitType = null, parent = null, initialAge = 0) {
      this.canvas = canvas;
      this.traitType = traitType || (Math.random() > 0.6 ? 'GROUP' : 'INDIVIDUAL');
      this.trait = CONFIG.traits[this.traitType];
      this.color = this.trait.colors[Math.floor(Math.random() * this.trait.colors.length)];
      this.groupId = parent ? parent.groupId : (this.traitType === 'GROUP' ? nextGroupId : 0);
      this.noiseSeed = Math.random() * 1000;

      if (parent) {
        this.position = parent.position.copy();
        this.velocity = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      } else {
        this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
        this.velocity = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      }

      this.acceleration = new Vector();
      this.age = initialAge;
      this.reproCooldown = 0;
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.updateStage();
    }

    updateStage() {
      if (this.age < CONFIG.stages.NEONATE.ageLimit) {
        this.stage = 'NEONATE';
      } else if (this.age < CONFIG.stages.JUVENILE.ageLimit) {
        this.stage = 'JUVENILE';
      } else {
        this.stage = 'MATURE';
      }

      const stageConfig = CONFIG.stages[this.stage];
      this.scale = stageConfig.scale;
      this.maxSpeed = stageConfig.speed;
      this.maxForce = 0.08;
    }

    wrap() {
      if (this.position.x < 0) this.position.x = this.canvas.width;
      if (this.position.x > this.canvas.width) this.position.x = 0;
      if (this.position.y < 0) this.position.y = this.canvas.height;
      if (this.position.y > this.canvas.height) this.position.y = 0;
    }

    flock(boids) {
      let alignment = new Vector();
      let cohesion = new Vector();
      let separation = new Vector();
      let spaceForce = new Vector();

      let perception = CONFIG.perception * this.scale;
      let totalTrait = 0;
      let totalGlobal = 0;

      this.hasPartner = false;

      for (let other of boids) {
        if (other !== this) {
          const d = Vector.dist(this.position, other.position);
          if (d < perception) {
            // Group logic: Cohesion/Alignment only for same group
            if (this.traitType === 'GROUP' && other.groupId === this.groupId) {
              alignment.add(other.velocity);
              cohesion.add(other.position);
              totalTrait++;

              // Check for reproduction partner (same trait, both mature)
              if (d < perception * 0.6 && other.stage === 'MATURE') {
                this.hasPartner = true;
              }
            } else if (this.traitType === 'INDIVIDUAL' && other.traitType === 'INDIVIDUAL') {
              // Individuals still have some mild clustering logic if solitary
              alignment.add(other.velocity);
              cohesion.add(other.position);
              totalTrait++;

              // Individuals harder to pair (closer proximity required)
              if (d < perception * 0.45 && other.stage === 'MATURE') {
                this.hasPartner = true;
              }
            }

            // Separation is GLOBAL (respect personal space of everyone)
            if (d < 25 * this.scale) {
              let diff = this.position.copy().sub(other.position);
              diff.div(d * d || 1);
              separation.add(diff);
            }
            totalGlobal++;
          }
        }
      }

      if (totalTrait > 0) {
        alignment.div(totalTrait).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce);
        cohesion.div(totalTrait).sub(this.position).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce);
      }
      if (totalGlobal > 0) {
        separation.div(totalGlobal).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce);
      }

      // Space Hunger: Perfectly smooth angular wander (no spatial jitter)
      this.wanderAngle += (Math.random() - 0.5) * 0.15;
      const wander = new Vector(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle));

      const densityForce = totalGlobal > 5 ? separation.copy().mult(1.0) : new Vector();
      spaceForce.add(wander).add(densityForce).limit(this.maxForce);

      this.acceleration.add(alignment.mult(this.trait.alignment));
      this.acceleration.add(cohesion.mult(this.trait.cohesion));
      this.acceleration.add(separation.mult(this.trait.separation));
      this.acceleration.add(spaceForce.mult(this.trait.spaceHunger * 12));

      // Interaction Avoidance (Mouse/Touch)
      if (window.appInstance && window.appInstance.interactionPos) {
        let d = Vector.dist(this.position, window.appInstance.interactionPos);
        if (d < CONFIG.interactionRange) {
          let flee = this.position.copy().sub(window.appInstance.interactionPos);
          flee.setMag(this.maxSpeed * 3).limit(this.maxForce * CONFIG.interactionForce);
          this.acceleration.add(flee);
        }
      }

      // Slow pull towards screen visible area
      const center = new Vector(this.canvas.width / 2, this.canvas.height / 2);
      let centerPull = center.sub(this.position).setMag(0.012);
      this.acceleration.add(centerPull);
    }

    update(overpopFactor = 0) {
      this.age++;
      if (this.reproCooldown > 0) this.reproCooldown--;
      this.updateStage();

      // Dynamic Trait Transitions: Recalibrated for better balance
      if (this.stage === 'JUVENILE' && this.traitType === 'GROUP' && Math.random() < 0.00045) {
        this.switchTrait('INDIVIDUAL');
      } else if (this.stage === 'MATURE' && this.traitType === 'INDIVIDUAL' && Math.random() < 0.00025) {
        this.switchTrait('GROUP');
      }

      this.velocity.add(this.acceleration);

      // Lethargy: Boids slow down when resources are scarce
      const dynamicMaxSpeed = this.maxSpeed * (1 - Math.min(0.4, overpopFactor * 0.15));
      this.velocity.limit(dynamicMaxSpeed);

      this.position.add(this.velocity);
      this.acceleration.mult(0);
      this.wrap();
    }

    switchTrait(newTraitType) {
      this.traitType = newTraitType;
      this.trait = CONFIG.traits[this.traitType];
      this.color = this.trait.colors[Math.floor(Math.random() * this.trait.colors.length)];

      if (this.traitType === 'GROUP') {
        // Find nearest group or get a new ID from app if possible
        this.groupId = window.appInstance ? (Math.floor(Math.random() * 5) + 1) : 1;
      } else {
        this.groupId = 0;
      }
    }

    canReproduce(abundanceFactor = 0, overpopFactor = 0) {
      let reproChance = this.trait.reproChance * (1 + abundanceFactor * 2.5);

      // Scarcity: Suppress birth rates when over capacity
      if (overpopFactor > 0) {
        reproChance *= (1 / (1 + overpopFactor * 2.5));
      }

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
      const trait = Math.random() < 0.08 ? (this.traitType === 'GROUP' ? 'INDIVIDUAL' : 'GROUP') : this.traitType;
      return new Boid(this.canvas, trait, this);
    }

    draw(ctx) {
      const size = 5.5 * this.scale;
      ctx.save();
      ctx.translate(this.position.x, this.position.y);
      ctx.rotate(Math.atan2(this.velocity.y, this.velocity.x));

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
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.boids = [];
      this.isActive = true;
      this.interactionPos = null;

      this.init();
      this.setupInteraction();
      this.setupSlider();
      window.addEventListener('resize', () => this.resize());
      this.animate();
    }

    setupInteraction() {
      const update = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        this.interactionPos = new Vector(t.clientX - rect.left, t.clientY - rect.top);
      };
      const clear = () => this.interactionPos = null;

      this.canvas.addEventListener('mousemove', update);
      this.canvas.addEventListener('mouseleave', clear);
      this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); update(e); }, { passive: false });
      this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); update(e); }, { passive: false });
      this.canvas.addEventListener('touchend', clear);
    }

    init() {
      this.resize();
      this.boids = [];
      nextGroupId = 1;

      const total = CONFIG.initialCount;
      // 50% Neonate, 40% Juvenile, 10% Mature
      const counts = { NEONATE: total * 0.5, JUVENILE: total * 0.4, MATURE: total * 0.1 };

      Object.entries(counts).forEach(([stage, count]) => {
        for (let i = 0; i < count; i++) {
          let age = 0;
          if (stage === 'NEONATE') age = Math.random() * CONFIG.stages.NEONATE.ageLimit;
          else if (stage === 'JUVENILE') age = CONFIG.stages.NEONATE.ageLimit + Math.random() * (CONFIG.stages.JUVENILE.ageLimit - CONFIG.stages.NEONATE.ageLimit);
          else age = CONFIG.stages.JUVENILE.ageLimit + Math.random() * 500;

          this.boids.push(new Boid(this.canvas, null, null, age));
        }
      });
    }

    manageGroups() {
      const groups = {};
      this.boids.forEach(b => {
        if (b.traitType === 'GROUP') {
          if (!groups[b.groupId]) groups[b.groupId] = [];
          groups[b.groupId].push(b);
        }
      });

      Object.entries(groups).forEach(([id, members]) => {
        if (members.length > CONFIG.groupLimits.max) {
          // Split group
          nextGroupId++;
          const toShift = members.slice(0, Math.floor(members.length / 2));
          toShift.forEach(m => m.groupId = nextGroupId);
        }
      });
    }

    stop() { this.isActive = false; }
    start() {
      if (this.isActive) return;
      this.isActive = true;
      this.animate();
    }

    setupInteraction() {
      const updatePos = (x, y) => {
        const rect = this.canvas.getBoundingClientRect();
        this.interactionPos = new Vector(x - rect.left, y - rect.top);
      };

      window.addEventListener('mousemove', (e) => updatePos(e.clientX, e.clientY));
      window.addEventListener('mouseleave', () => this.interactionPos = null);

      window.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          updatePos(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: false });

      window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          updatePos(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: false });

      window.addEventListener('touchend', () => this.interactionPos = null);
    }

    setupSlider() {
      const slider = document.getElementById('slider-max-pop');
      const valDisplay = document.getElementById('val-max-pop');
      if (slider && valDisplay) {
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value);
          CONFIG.maxPopulation = val;
          valDisplay.textContent = val;
        });
      }
    }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    animate() {
      if (!this.isActive) return;

      const isApocalyptic = document.querySelector('.app')?.classList.contains('apocalyptic');
      this.ctx.fillStyle = isApocalyptic ? '#f2f2f2' : '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const newBoids = [];
      const diff = this.boids.length - CONFIG.maxPopulation;
      const overpopFactor = Math.max(0, diff / 30); // Softer correction
      const abundanceFactor = Math.max(0, -diff / 100);

      for (let i = this.boids.length - 1; i >= 0; i--) {
        const b = this.boids[i];
        b.flock(this.boids);
        b.update(overpopFactor);
        b.draw(this.ctx);

        if (b.canReproduce(abundanceFactor, overpopFactor) && this.boids.length < CONFIG.maxPopulation) {
          newBoids.push(b.reproduce());
        }

        // Natural death cycle: Higher for Interdependent (Group), lower for Individuals
        const isAdult = b.stage === 'MATURE' && b.age > CONFIG.stages.MATURE.reproductionAge;
        const baseDeath = isAdult ? b.trait.mortality : 0.00005;
        // Softer overpopulation mortality
        const deathChance = (baseDeath * (1 - Math.min(0.6, abundanceFactor))) + (overpopFactor * 0.005);

        if (Math.random() < deathChance || b.age > 20000) {
          this.boids.splice(i, 1);
        }
      }

      this.boids.push(...newBoids);
      this.manageGroups();

      this.updateStats();
      requestAnimationFrame(() => this.animate());
    }

    updateStats() {
      const groupEl = document.getElementById('count-group');
      const indivEl = document.getElementById('count-individual');

      const stats = {
        GROUP: { total: 0, neonate: 0, juvenile: 0, mature: 0 },
        INDIVIDUAL: { total: 0, neonate: 0, juvenile: 0, mature: 0 }
      };

      this.boids.forEach(b => {
        const t = stats[b.traitType];
        t.total++;
        if (b.stage === 'NEONATE') t.neonate++;
        else if (b.stage === 'JUVENILE') t.juvenile++;
        else {
          // Adult boids are MATURE stage and passed reproductionAge
          if (b.age > CONFIG.stages.MATURE.reproductionAge) t.mature++;
          else t.juvenile++;
        }
      });

      if (groupEl) groupEl.textContent = stats.GROUP.total;
      if (indivEl) indivEl.textContent = stats.INDIVIDUAL.total;

      // Update sub-metrics
      const setSub = (prefix, data) => {
        const n = document.getElementById(`${prefix}-neonate`);
        const j = document.getElementById(`${prefix}-juvenile`);
        const m = document.getElementById(`${prefix}-mature`);
        if (n) n.textContent = data.neonate;
        if (j) j.textContent = data.juvenile;
        if (m) m.textContent = data.mature;
      };

      setSub('group', stats.GROUP);
      setSub('indiv', stats.INDIVIDUAL);
    }
  }

  window.App = App;

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!window.appInstance) new App();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.appInstance) new App();
    });
  }
})();