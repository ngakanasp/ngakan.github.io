document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("bg");
  if (!canvas) return; // Safety check
  const ctx = canvas.getContext("2d");

  let particles = [];
  let mouse = { x: null, y: null };
  let time = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init(); // Re-initialize particles on resize
  }

  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  class Particle {
    constructor(layer) {
      this.layer = layer;
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * (1.5 * this.layer) + 0.3;
    }

    update() {
      time += 0.0001;
      // Drift movement
      this.x += Math.sin(time * this.layer + this.y) * 0.15;
      this.y += Math.cos(time * this.layer + this.x) * 0.15;

      if (mouse.x !== null) {
        let dx = this.x - mouse.x;
        let dy = this.y - mouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          let force = (140 - dist) / 140;
          this.x += dx * force * 0.03 * this.layer;
          this.y += dy * force * 0.03 * this.layer;
        }
      }

      // Screen wrap
      if (this.x < 0) this.x = canvas.width;
      if (this.x > canvas.width) this.x = 0;
      if (this.y < 0) this.y = canvas.height;
      if (this.y > canvas.height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.fillStyle = `rgba(0,0,0,${0.2 * this.layer})`;
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function init() {
    particles = [];
    for (let i = 0; i < 60; i++) particles.push(new Particle(0.5));
    for (let i = 0; i < 40; i++) particles.push(new Particle(1.2));
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  resize();
  animate();
});