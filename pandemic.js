/**
 * System: Pandemic Simulator (Simplified)
 * Logic: Susceptible, Infected, Recovered (SIR Model)
 * Theme: Viridis State Palette
 */

(function () {
    const COLORS = {
        HEALTHY: '#21918c',   // Viridis Teal
        INFECTED: '#440154',  // Viridis Deep Purple
        RECOVERED: '#fde725', // Viridis Yellow
        ACCENT: '#3b528b'     // Viridis Blue
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

    class Agent {
        constructor(canvas) {
            this.canvas = canvas;
            this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
            this.velocity = new Vector((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
            this.acceleration = new Vector();

            this.state = 'HEALTHY'; // HEALTHY, INFECTED, RECOVERED
            this.size = 2.5;
            this.maxSpeed = 1.2;
            this.infectionTime = 0;
            this.recoveryDuration = 300 + Math.random() * 200; // frames

            // Social behavior
            this.socialDistance = 25;
            this.compliance = Math.random(); // How likely they are to distance
        }

        update(agents) {
            // 1. Social Distancing (Avoidance)
            if (this.compliance > 0.3) {
                let separation = new Vector();
                let total = 0;
                agents.forEach(other => {
                    let d = Vector.dist(this.position, other.position);
                    if (other !== this && d < this.socialDistance) {
                        let diff = this.position.copy().sub(other.position);
                        diff.div(d);
                        separation.add(diff);
                        total++;
                    }
                });
                if (total > 0) {
                    separation.div(total).setMag(this.maxSpeed).sub(this.velocity).limit(0.05);
                    this.acceleration.add(separation);
                }
            }

            // 2. Random Walk
            this.acceleration.add(new Vector((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1));

            // 3. Infection Logic
            if (this.state === 'HEALTHY') {
                agents.forEach(other => {
                    if (other.state === 'INFECTED') {
                        let d = Vector.dist(this.position, other.position);
                        if (d < 12 && Math.random() < 0.05) { // Infection radius and probability
                            this.state = 'INFECTED';
                            this.infectionTime = 0;
                        }
                    }
                });
            } else if (this.state === 'INFECTED') {
                this.infectionTime++;
                if (this.infectionTime > this.recoveryDuration) {
                    this.state = 'RECOVERED';
                }
            }

            // Physics
            this.velocity.add(this.acceleration);
            this.velocity.limit(this.maxSpeed);
            this.position.add(this.velocity);
            this.acceleration.mult(0);

            // Boundaries (Smooth turn-back)
            const margin = 20;
            if (this.position.x < margin) this.velocity.x += 0.1;
            if (this.position.x > this.canvas.width - margin) this.velocity.x -= 0.1;
            if (this.position.y < margin) this.velocity.y += 0.1;
            if (this.position.y > this.canvas.height - margin) this.velocity.y -= 0.1;
        }

        draw(ctx) {
            // Glow effect for infected
            if (this.state === 'INFECTED') {
                ctx.shadowBlur = 8;
                ctx.shadowColor = COLORS.INFECTED;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fillStyle = COLORS[this.state];
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
        }
    }

    class PandemicApp {
        constructor() {
            this.canvas = document.getElementById('bg');
            this.ctx = this.canvas.getContext('2d');
            this.agents = [];
            this.isActive = true;
            this.init();
            this.animate();
        }

        init() {
            this.agents = [];
            const count = 180;
            for (let i = 0; i < count; i++) {
                let a = new Agent(this.canvas);
                if (i < 3) a.state = 'INFECTED'; // Initial patient zero
                this.agents.push(a);
            }
        }

        stop() {
            this.isActive = false;
        }

        start() {
            if (this.isActive) return;
            this.isActive = true;
            this.animate();
        }

        animate() {
            if (!this.isActive) return;

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.agents.forEach(a => {
                a.update(this.agents);
                a.draw(this.ctx);
            });

            requestAnimationFrame(() => this.animate());
        }
    }

    window.PandemicApp = PandemicApp;
})();
