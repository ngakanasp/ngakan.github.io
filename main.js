document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let particles = [];
  let mouse = { x: null, y: null };
  let time = 0;

  // Viridis Palette
  const viridis = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init(); // Fix: Re-init particles on resize
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  class Particle {
    constructor(layer) {
      this.layer = layer;
      this.color = viridis[Math.floor(Math.random() * viridis.length)];

      // Fixed characteristics
      this.offset = Math.random() * Math.PI * 2;
      this.phase = Math.random() * 1000;
      this.baseSpeed = 0.4 + Math.random() * 1.2;
      this.orbitRadius = 50 + Math.random() * 150;
      this.orbitSpeed = (Math.random() - 0.5) * 0.02;

      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * (1.2 * this.layer) + 0.8;
      this.width = this.size * 4;
      this.height = this.size * 1.5;
      this.vx = 0;
      this.vy = 0;
      this.angle = 0;

      // Behavior state: 0-3 corners, 4 center
      this.targetState = Math.floor(Math.random() * 5);
      this.stateTimer = Math.random() * 300 + 200; // Frames before switching
    }

    update() {
      const now = Date.now() * 0.001;
      this.stateTimer--;

      if (this.stateTimer <= 0) {
        // Occasionally move to center, otherwise rotate through corners
        if (Math.random() > 0.85) {
          this.targetState = 4;
        } else {
          this.targetState = (this.targetState + 1) % 4;
        }
        this.stateTimer = Math.random() * 400 + 300;
      }

      // 1. Calculate Target Point
      let tx, ty;
      if (this.targetState === 4) {
        // Center: Bee nest effect
        const tRange = 0.15;
        const pulse = 1 + Math.sin(now * 0.5) * 0.2;
        tx = canvas.width * 0.5 + Math.cos(now * 0.8 + this.offset) * (this.orbitRadius * pulse);
        ty = canvas.height * 0.5 + Math.sin(now * 0.8 + this.offset) * (this.orbitRadius * pulse);
      } else {
        // Corners: Orbit regions
        const cx = (this.targetState === 1 || this.targetState === 2) ? 0.9 : 0.1;
        const cy = (this.targetState === 2 || this.targetState === 3) ? 0.9 : 0.1;
        const timeFactor = now * this.orbitSpeed;
        tx = canvas.width * cx + Math.cos(timeFactor + this.offset) * this.orbitRadius;
        ty = canvas.height * cy + Math.sin(timeFactor + this.offset) * this.orbitRadius;
      }

      // 2. Steering & Flow
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Soft attraction
      const attraction = 0.00025 * this.layer * (this.targetState === 4 ? 1.5 : 1);
      this.vx += (dx / Math.max(dist, 1)) * attraction * dist;
      this.vy += (dy / Math.max(dist, 1)) * attraction * dist;

      // 3. Global Flow (Noise-like) - No Math.random here
      const flowScale = 0.005;
      const flowTime = now * 0.3;
      const angle = (Math.sin(this.x * flowScale + flowTime) + Math.cos(this.y * flowScale + flowTime)) * Math.PI;
      this.vx += Math.cos(angle) * 0.15;
      this.vy += Math.sin(angle) * 0.15;

      // 4. Mouse interaction
      if (mouse.x !== null) {
        const mdx = this.x - mouse.x;
        const mdy = this.y - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 200) {
          const power = (200 - mdist) / 200;
          this.vx += (mdx / mdist) * power * 0.8;
          this.vy += (mdy / mdist) * power * 0.8;
        }
      }

      // 5. Final Physics
      this.vx *= 0.97; // Slightly higher friction for fluid look
      this.vy *= 0.97;

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const maxSpeed = this.baseSpeed * (this.targetState === 4 ? 0.8 : 1.2) * this.layer;
      if (speed > maxSpeed) {
        this.vx = (this.vx / speed) * maxSpeed;
        this.vy = (this.vy / speed) * maxSpeed;
      }

      this.x += this.vx;
      this.y += this.vy;
      this.angle = Math.atan2(this.vy, this.vx);

      // Bounce/Wrap gently
      const margin = 100;
      if (this.x < -margin) this.x = canvas.width + margin;
      if (this.x > canvas.width + margin) this.x = -margin;
      if (this.y < -margin) this.y = canvas.height + margin;
      if (this.y > canvas.height + margin) this.y = -margin;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Dynamic opacity based on speed
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const opacity = 0.15 + (speed * 0.15);

      ctx.beginPath();
      ctx.globalAlpha = opacity * this.layer;
      ctx.fillStyle = this.color;

      const r = this.height / 2;
      ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, r);
      ctx.fill();

      ctx.restore();
    }
  }

  function init() {
    particles = [];
    // Balanced distribution
    for (let i = 0; i < 200; i++) particles.push(new Particle(1.0));
    for (let i = 0; i < 150; i++) particles.push(new Particle(0.6));
    for (let i = 0; i < 100; i++) particles.push(new Particle(0.3));
  }

  function animate() {
    // Subtle trail effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(animate);
  }

  resize();
  animate();
});