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
      // Assign random Viridis color
      this.color = viridis[Math.floor(Math.random() * viridis.length)];
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * (1.5 * this.layer) + 0.6;
    }

    update() {
      time += 0.0003;
      this.x += Math.sin(time * this.layer + this.y) * 0.15;
      this.y += Math.cos(time * this.layer + this.x) * 0.15;

      if (mouse.x !== null) {
        let dx = this.x - mouse.x;
        let dy = this.y - mouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        let radius = 140;

        if (dist < radius) {
          let force = (radius - dist) / radius;
          this.x += dx * force * 0.03 * this.layer;
          this.y += dy * force * 0.03 * this.layer;
        }
      }

      if (this.x < 0) this.x = canvas.width;
      if (this.x > canvas.width) this.x = 0;
      if (this.y < 0) this.y = canvas.height;
      if (this.y > canvas.height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      // Use layer for depth-based transparency
      ctx.globalAlpha = 0.4 * this.layer;
      ctx.fillStyle = this.color;
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  function init() {
    particles = [];
    // Increased particle counts
    for (let i = 0; i < 240; i++) particles.push(new Particle(0.5));
    for (let i = 0; i < 180; i++) particles.push(new Particle(0.8));
    for (let i = 0; i < 120; i++) particles.push(new Particle(1.2));
  }

  // function drawMouseGlow() {
  //   if (mouse.x === null) return;
  //   let gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 500);
  //   // gradient.addColorStop(0, "rgba(0,0,0,0.08)");
  //   // gradient.addColorStop(1, "rgba(0,0,0,0)");
  //   ctx.fillStyle = gradient;
  //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  // }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    // drawMouseGlow();
    requestAnimationFrame(animate);
  }

  resize();
  animate();
});