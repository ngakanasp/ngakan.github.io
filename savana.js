(function () {
  const VIRIDIS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];

  const CONFIG = {
    boids: {
      count: 140,
      maxSpeed: 3.0,
      maxForce: 0.05,
      perception: 180,
      separationDist: 25,
      cohesionStrength: 1.8,
      alignmentStrength: 1.2,
      boundaryMargin: 100,
    },
    layers: [
      { scale: 1.0, count: 0.4, alpha: 0.8 }, // Close
      { scale: 0.6, count: 0.4, alpha: 0.4 }, // Mid
      { scale: 0.3, count: 0.2, alpha: 0.15 }, // Far
    ],
    predator: {
      count: 2,
      size: 3.5,
      speed: 2.4,
      stalkSpeed: 0.8,
      perception: 280,
      maxEnergy: 2000,
      boundaryMargin: 100,
    }
  };

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
    constructor(canvas, layer) {
      this.canvas = canvas;
      this.layer = layer;
      this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
      this.velocity = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
      this.acceleration = new Vector();

      this.size = 2.4 * layer.scale;
      this.alpha = layer.alpha;
      this.color = VIRIDIS[Math.floor(Math.random() * VIRIDIS.length)];
      this.maxSpeed = CONFIG.boids.maxSpeed * (0.5 + 0.5 * layer.scale);
    }

    boundaries() {
      const center = new Vector(this.canvas.width / 2, this.canvas.height / 2);
      const dist = Vector.dist(this.position, center);
      const maxDist = Math.max(this.canvas.width, this.canvas.height) * 0.42;

      if (dist > maxDist) {
        let pullCenter = center.copy().sub(this.position);
        pullCenter.setMag(0.12 * (dist / maxDist));
        this.acceleration.add(pullCenter);
      }

      if (this.position.x < 0) this.position.x = 2;
      if (this.position.x > this.canvas.width) this.position.x = this.canvas.width - 2;
      if (this.position.y < 0) this.position.y = 2;
      if (this.position.y > this.canvas.height) this.position.y = this.canvas.height - 2;
    }

    flock(boids, nearestPredator, mouse) {
      let alignment = new Vector();
      let cohesion = new Vector();
      let separation = new Vector();
      let flee = new Vector();

      const perception = CONFIG.boids.perception * this.layer.scale;
      let total = 0;

      for (let other of boids) {
        if (other !== this) {
          const d = Vector.dist(this.position, other.position);
          if (d < perception) {
            alignment.add(other.velocity);
            cohesion.add(other.position);

            if (d < CONFIG.boids.separationDist * this.layer.scale) {
              let diff = this.position.copy().sub(other.position);
              diff.div(d * d || 1);
              separation.add(diff);
            }
            total++;
          }
        }
      }

      if (total > 0) {
        alignment.div(total).setMag(this.maxSpeed).sub(this.velocity).limit(CONFIG.boids.maxForce);
        cohesion.div(total).sub(this.position).setMag(this.maxSpeed).sub(this.velocity).limit(CONFIG.boids.maxForce);
        separation.div(total).setMag(this.maxSpeed).sub(this.velocity).limit(CONFIG.boids.maxForce);
      }

      if (nearestPredator && !nearestPredator.isRecharging) {
        const d = Vector.dist(this.position, nearestPredator.position);
        if (d < CONFIG.predator.perception * this.layer.scale) {
          let diff = this.position.copy().sub(nearestPredator.position);
          diff.setMag(this.maxSpeed * 3).sub(this.velocity).limit(CONFIG.boids.maxForce * 3);
          flee.add(diff);
        }
      }

      if (mouse.x !== null) {
        const d = Vector.dist(this.position, new Vector(mouse.x, mouse.y));
        if (d < 150) {
          let diff = this.position.copy().sub(new Vector(mouse.x, mouse.y));
          diff.setMag(this.maxSpeed * 2.5).sub(this.velocity).limit(CONFIG.boids.maxForce * 5);
          flee.add(diff);
        }
      }

      this.acceleration.add(alignment.mult(CONFIG.boids.alignmentStrength));
      this.acceleration.add(cohesion.mult(CONFIG.boids.cohesionStrength));
      this.acceleration.add(separation.mult(2.5));
      this.acceleration.add(flee.mult(4.5));

      const wanderForce = new Vector(Math.cos(Date.now() * 0.001 + this.position.x * 0.01), Math.sin(Date.now() * 0.001 + this.position.y * 0.01));
      this.acceleration.add(wanderForce.mult(0.05));

      const center = new Vector(this.canvas.width / 2, this.canvas.height / 2);
      let centerPull = center.sub(this.position).setMag(0.02);
      this.acceleration.add(centerPull);
    }

    update() {
      this.boundaries();
      this.velocity.add(this.acceleration);
      this.velocity.limit(this.maxSpeed);
      this.position.add(this.velocity);
      this.acceleration.mult(0);
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.position.x, this.position.y);
      ctx.rotate(Math.atan2(this.velocity.y, this.velocity.x));
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.size * 2.5, 0);
      ctx.lineTo(-this.size, this.size * 0.8);
      ctx.lineTo(-this.size, -this.size * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  class Predator {
    constructor(canvas, initialEnergyOffset = 0) {
      this.canvas = canvas;
      this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
      this.velocity = new Vector((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      this.acceleration = new Vector();
      this.angle = Math.random() * Math.PI * 2;
      this.energy = CONFIG.predator.maxEnergy - initialEnergyOffset;
      this.isRecharging = false;
      this.mode = 'stalk';
    }

    boundaries() {
      const margin = Math.min(120, Math.min(this.canvas.width, this.canvas.height) * 0.2);
      const force = 0.15;
      if (this.position.x < margin) this.acceleration.x += force * (1 - this.position.x / margin);
      if (this.position.x > this.canvas.width - margin) this.acceleration.x -= force * (1 - (this.canvas.width - this.position.x) / margin);
      if (this.position.y < margin) this.acceleration.y += force * (1 - this.position.y / margin);
      if (this.position.y > this.canvas.height - margin) this.acceleration.y -= force * (1 - (this.canvas.height - this.position.y) / margin);

      if (this.position.x < 0) this.position.x = 2;
      if (this.position.x > this.canvas.width) this.position.x = this.canvas.width - 2;
      if (this.position.y < 0) this.position.y = 2;
      if (this.position.y > this.canvas.height) this.position.y = this.canvas.height - 2;
    }

    update(boids, otherPredators) {
      if (this.isRecharging) {
        this.mode = 'recharge';
        this.energy += 3;
        this.velocity.mult(0.92);
        if (this.energy >= CONFIG.predator.maxEnergy) {
          this.isRecharging = false;
          this.mode = 'stalk';
        }
      } else {
        otherPredators.forEach(other => {
          if (other !== this) {
            const d = Vector.dist(this.position, other.position);
            if (d < 200) {
              let repel = this.position.copy().sub(other.position).setMag(this.velocity.mag()).limit(0.1);
              this.acceleration.add(repel);
              if (other.isRecharging && this.energy < 300) this.energy += 0.5;
            }
          }
        });

        let target = this.findTarget(boids);
        const isTargetClose = target && Vector.dist(this.position, target) < 200;
        this.mode = isTargetClose ? 'hunt' : 'stalk';
        const speed = this.mode === 'hunt' ? CONFIG.predator.speed : CONFIG.predator.stalkSpeed;

        if (target) {
          let steer = target.copy().sub(this.position).setMag(speed).sub(this.velocity).limit(0.06);
          this.acceleration.add(steer);
          this.energy -= (this.mode === 'hunt' ? 1.5 : 0.2);
        }

        this.angle += (Math.random() - 0.5) * 0.15;
        this.acceleration.add(new Vector(Math.cos(this.angle) * 0.05, Math.sin(this.angle) * 0.05));
        if (this.energy <= 0) this.isRecharging = true;
      }

      this.boundaries();
      this.velocity.add(this.acceleration);
      this.velocity.limit(this.mode === 'recharge' ? 0.3 : CONFIG.predator.speed);
      this.position.add(this.velocity);
      this.acceleration.mult(0);
    }

    findTarget(boids) {
      let bestBoid = null;
      let maxNeighbors = -1;
      const step = 8;
      for (let i = 0; i < boids.length; i += step) {
        let b = boids[i];
        let neighbors = 0;
        for (let j = 0; j < boids.length; j += step * 2) {
          if (Vector.dist(b.position, boids[j].position) < 80) neighbors++;
        }
        if (neighbors > maxNeighbors) {
          maxNeighbors = neighbors;
          bestBoid = b;
        }
      }
      return bestBoid ? bestBoid.position : null;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.position.x, this.position.y);
      const energyRatio = Math.max(0, this.energy / CONFIG.predator.maxEnergy);
      const pulse = Math.sin(Date.now() * 0.005) * 3;
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.05 + energyRatio * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, CONFIG.predator.size + 10 + (pulse * energyRatio), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = this.isRecharging ? 0.2 : 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, CONFIG.predator.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class App {
    constructor() {
      window.appInstance = this;
      this.canvas = document.getElementById('bg');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.boids = [];
      this.predators = [];
      this.mouse = { x: null, y: null };
      this.isActive = true;

      this.init();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('pointermove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
      window.addEventListener('pointerleave', () => { this.mouse.x = null; this.mouse.y = null; });
      this.animate();
    }

    stop() { this.isActive = false; }
    start() { if (this.isActive) return; this.isActive = true; this.animate(); }

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      [...this.boids, ...this.predators].forEach(e => {
        if (e.position.x > this.canvas.width) e.position.x = this.canvas.width;
        if (e.position.y > this.canvas.height) e.position.y = this.canvas.height;
      });
    }

    init() {
      this.resize();
      this.boids = [];
      CONFIG.layers.forEach(l => {
        const count = Math.floor(CONFIG.boids.count * l.count);
        for (let i = 0; i < count; i++) this.boids.push(new Boid(this.canvas, l));
      });
      this.predators = [];
      for (let i = 0; i < CONFIG.predator.count; i++) {
        this.predators.push(new Predator(this.canvas, i * 800));
      }
    }

    animate() {
      if (!this.isActive) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.predators.forEach(p => {
        p.update(this.boids, this.predators);
        p.draw(this.ctx);
      });
      this.boids.forEach(b => {
        let activePredators = this.predators.filter(p => !p.isRecharging);
        let nearest = activePredators.length > 0 ? activePredators.reduce((prev, curr) =>
          Vector.dist(b.position, prev.position) < Vector.dist(b.position, curr.position) ? prev : curr) : null;
        b.flock(this.boids, nearest, this.mouse);
        b.update();
        b.draw(this.ctx);
      });
      this.drawStats();
      requestAnimationFrame(() => this.animate());
    }

    drawStats() {
      const popEl = document.getElementById('count-population');
      const predEl = document.getElementById('count-predator');
      if (popEl) popEl.textContent = this.boids.length;
      if (predEl) predEl.textContent = this.predators.length;
    }
  }

  window.App = App;

  // Create instance if it doesn't exist
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!window.appInstance) new App();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.appInstance) new App();
    });
  }
})();