/**
 * System: Advanced Savanna Pandemic Simulator
 * Logic: SIRD Model with Herd Immunity, Paramedics, and Mortality
 * Theme: Viridis States + Savanna Steering
 */

(function () {
    const COLORS = {
        HEALTHY: '#ffffff',     // Pure White
        INFECTED: '#440154',    // Viridis Purple
        RECOVERED: '#fde725',   // Viridis Yellow
        DEAD: '#222222',        // Rotting Dark
        PARAMEDIC: '#21918c',   // Viridis Teal
        STROKE: 'rgba(0, 0, 0, 0.1)'
    };

    const CONFIG = {
        agent: {
            count: 240,
            size: 2.8,
            maxSpeed: 2.0,
            maxForce: 0.05, // Significantly lower for creamy smoothness
            perception: 130,
            separationDist: 28, // Smaller for 'touching' behavior
            groupLimit: 35,
            mortalityRate: 0.35, // 35% mortality for very clear impact
            recoveryTime: 500,
            rotTime: 800, // Stay on screen longer
        },
        paramedic: {
            minCount: 3,
            maxSpeed: 4.5, // Rushing
            perception: 250,
            immunity: 500, // High but not invincible
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
        constructor(canvas, isParamedic = false) {
            this.canvas = canvas;
            this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
            this.velocity = new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
            this.acceleration = new Vector();

            this.state = 'HEALTHY'; // HEALTHY, INFECTED, RECOVERED, DEAD
            this.isParamedic = isParamedic;
            this.isDiagnosed = false;

            this.size = CONFIG.agent.size;
            this.maxSpeed = isParamedic ? CONFIG.paramedic.maxSpeed : CONFIG.agent.maxSpeed;
            this.maxForce = CONFIG.agent.maxForce;

            this.immunity = isParamedic ? CONFIG.paramedic.immunity : (30 + Math.random() * 80);
            this.lifespan = 300 + Math.random() * 200; // Infection cycle is twice as fast now
            this.rotTimer = CONFIG.agent.rotTime; // Only for dead
            this.recoveryTimer = 0; // For immune period

            this.targetPatient = null; // For paramedics
        }

        boundaries() {
            const center = new Vector(this.canvas.width / 2, this.canvas.height / 2);
            const dist = Vector.dist(this.position, center);

            // Tighten visible arena to 35% of the shortest axis
            const maxDist = Math.min(this.canvas.width, this.canvas.height) * 0.35;

            if (dist > maxDist) {
                let pullCenter = center.copy().sub(this.position);
                // Aggressive pull back to center
                const pullStrength = 0.25 * (dist / maxDist);
                pullCenter.setMag(pullStrength);
                this.acceleration.add(pullCenter);
            }

            // Hard clamp safety net
            const pad = 20;
            if (this.position.x < pad) this.position.x = pad;
            if (this.position.x > this.canvas.width - pad) this.position.x = this.canvas.width - pad;
            if (this.position.y < pad) this.position.y = pad;
            if (this.position.y > this.canvas.height - pad) this.position.y = this.canvas.height - pad;
        }

        applyFlocking(agents) {
            let alignment = new Vector();
            let cohesion = new Vector();
            let separation = new Vector();
            let deadAvoidance = new Vector();
            let total = 0;
            let groupCount = 0;

            const perception = CONFIG.agent.perception;

            agents.forEach(other => {
                if (other === this) return;
                const d = Vector.dist(this.position, other.position);

                if (d < perception && other.state !== 'DEAD') {
                    alignment.add(other.velocity);
                    cohesion.add(other.position);
                    total++;
                    groupCount++;
                }

                if (d < CONFIG.agent.separationDist) {
                    let diff = this.position.copy().sub(other.position);
                    // Weight separation by distance squared for "personal space"
                    diff.div(d * d || 1);
                    separation.add(diff);

                    // Touch Logic: Prevent overlap but allow proximity (touching)
                    if (d < this.size * 1.5) {
                        let push = this.position.copy().sub(other.position);
                        push.setMag(this.maxSpeed * 0.25);
                        this.acceleration.add(push);
                    }
                }

                // Avoid clusters
                if (groupCount > CONFIG.agent.groupLimit) {
                    let clusterRepel = this.position.copy().sub(other.position);
                    clusterRepel.setMag(this.maxSpeed * 0.8);
                    separation.add(clusterRepel);
                }

                // Avoid Dead Boids
                if (other.state === 'DEAD' && d < 60 && !this.isParamedic) {
                    let diff = this.position.copy().sub(other.position);
                    diff.setMag(this.maxSpeed * 2);
                    deadAvoidance.add(diff);
                }
            });

            if (total > 0) {
                alignment.div(total).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce);
                cohesion.div(total).sub(this.position).setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce * 0.8);
                separation.setMag(this.maxSpeed).sub(this.velocity).limit(this.maxForce * 1.8);
            }

            this.acceleration.add(alignment.mult(1.0));
            this.acceleration.add(cohesion.mult(1.2)); // Boosted for group feel
            this.acceleration.add(separation.mult(2.0));
            this.acceleration.add(deadAvoidance.limit(this.maxForce * 4));

            // Organic Wander
            const wanderForce = new Vector(Math.cos(Date.now() * 0.002 + this.position.x * 0.05), Math.sin(Date.now() * 0.002 + this.position.y * 0.05));
            this.acceleration.add(wanderForce.mult(0.06));

            // Centering Bias: Constant gentle pull to the center
            const center = new Vector(this.canvas.width / 2, this.canvas.height / 2);
            let centerPull = center.sub(this.position).setMag(0.06);
            this.acceleration.add(centerPull);
        }

        handleImmunity(agents) {
            if (this.state === 'DEAD') return;

            let localDensity = 0;
            const densityRadius = 60; // How many neighbors around me?

            // First pass: Calculate density
            agents.forEach(other => {
                if (other === this || other.state === 'DEAD') return;
                const d = Vector.dist(this.position, other.position);
                if (d < densityRadius) {
                    localDensity++;
                }
            });

            // Density Multiplier: Crowds (density > 10) have exponential viral load
            const crowdEffect = localDensity > 10 ? 2.5 : 1 + (localDensity / 10);

            // Herd Immunity: Only works if strictly healthy and isolated enough
            if (this.state === 'HEALTHY' || this.state === 'RECOVERED') {
                agents.forEach(other => {
                    if (other === this) return;
                    if (other.state === 'HEALTHY' || other.state === 'RECOVERED') {
                        const d = Vector.dist(this.position, other.position);
                        if (d < 50) {
                            // Immunity gain is weaker in high density (viral load overwhelms)
                            this.immunity += (1 / (d + 1)) * (0.05 / crowdEffect);
                        }
                    }
                });
            }

            // Infection Spread: Greatly amplified by local density (viral load)
            agents.forEach(other => {
                if (other === this) return;
                if (other.state === 'INFECTED' || other.state === 'DEAD') {
                    const d = Vector.dist(this.position, other.position);
                    // Range also scales slightly with density
                    const effectiveRange = 65 + (localDensity * 0.5);

                    if (d < effectiveRange) {
                        const baseDrain = other.state === 'DEAD' ? 3.0 : 2.5;
                        this.immunity -= (1 / (d + 1)) * baseDrain * crowdEffect;
                    }
                }
            });

            if (this.immunity <= 0 && this.state === 'HEALTHY') {
                this.state = 'INFECTED';
            }

            this.immunity = Math.min(this.immunity, 1000);
        }

        update(agents, diagnosedList) {
            if (this.state === 'DEAD') {
                this.rotTimer--;
                return;
            }

            if (this.isParamedic) {
                this.updateParamedic(agents, diagnosedList);
            } else {
                this.applyFlocking(agents);
            }

            this.handleImmunity(agents);

            if (this.state === 'INFECTED') {
                this.lifespan--;
                // Small chance to be diagnosed
                if (Math.random() < 0.001) this.isDiagnosed = true;

                if (this.lifespan <= 0) {
                    if (Math.random() < CONFIG.agent.mortalityRate) {
                        this.state = 'DEAD';
                        this.velocity.mult(0);
                    } else {
                        this.state = 'RECOVERED';
                        this.isDiagnosed = false;
                        this.immunity = 1000; // Long immunity
                    }
                }
            }

            this.boundaries();

            // Smoothing: Low-pass filter for acceleration
            this.velocity.add(this.acceleration);
            this.velocity.limit(this.maxSpeed);

            // Movement smoothing
            const speed = this.velocity.mag();
            if (speed > 0.1) {
                this.position.add(this.velocity);
            }
            this.acceleration.mult(0.1); // Damp acceleration to reduce jitter
        }

        updateParamedic(agents, diagnosedList) {
            if (this.targetPatient && (!this.targetPatient.isDiagnosed || this.targetPatient.state !== 'INFECTED')) {
                this.targetPatient = null;
            }

            if (!this.targetPatient && diagnosedList.length > 0) {
                this.targetPatient = diagnosedList[Math.floor(Math.random() * diagnosedList.length)];
            }

            if (this.targetPatient) {
                // Emergency State: Siren & Rush
                const d = Vector.dist(this.position, this.targetPatient.position);
                let desired = this.targetPatient.position.copy().sub(this.position);

                if (d < 10) {
                    // Close contact: curing
                    this.velocity.mult(0.5);
                    this.targetPatient.lifespan -= 10; // Speed up recovery/death cycle (treatment)
                    if (this.targetPatient.lifespan < 10) {
                        this.targetPatient.state = 'RECOVERED';
                        this.targetPatient.isDiagnosed = false;
                        this.targetPatient = null;
                        this.triggerPop();
                    }
                } else {
                    // Faster acceleration based on distance
                    const speed = Math.min(this.maxSpeed, d * 0.1);
                    desired.setMag(speed);
                    let steer = desired.sub(this.velocity).limit(this.maxForce * 5);
                    this.acceleration.add(steer);
                }
            } else {
                this.applyFlocking(agents);
            }
        }

        triggerPop() {
            this.popSize = 0;
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(this.velocity.mag() > 0.1 ? Math.atan2(this.velocity.y, this.velocity.x) : 0);

            if (this.state === 'DEAD') {
                ctx.fillStyle = COLORS.DEAD;
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'; // Thin white outline for dark corpses
                ctx.lineWidth = 1;
                ctx.globalAlpha = Math.max(0.1, this.rotTimer / CONFIG.agent.rotTime);
            } else {
                ctx.fillStyle = this.isParamedic ? COLORS.PARAMEDIC : COLORS[this.state];
            }

            // Siren for paramedics in emergency mode
            if (this.isParamedic && this.targetPatient) {
                const pulse = Math.sin(Date.now() * 0.02) * 5 + 5;
                ctx.strokeStyle = Math.sin(Date.now() * 0.02) > 0 ? 'rgba(255,0,0,0.3)' : 'rgba(0,0,255,0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, 0, this.size + pulse, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Glow for infected
            if (this.state === 'INFECTED') {
                ctx.shadowBlur = 10;
                ctx.shadowColor = COLORS.INFECTED;
            }

            // Draw Body (Arrow Shape)
            ctx.beginPath();
            ctx.moveTo(this.size * 2, 0);
            ctx.lineTo(-this.size, this.size);
            ctx.lineTo(-this.size, -this.size);
            ctx.closePath();
            ctx.fill();
            if (this.state === 'DEAD') ctx.stroke(); // Outline for visibility

            // Stroke for visibility against light background
            if (this.state === 'HEALTHY' || this.state === 'RECOVERED') {
                ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            ctx.restore();

            // Pop effect (rendered world-space)
            if (this.popSize !== undefined && this.popSize < 20) {
                this.popSize += 2;
                ctx.save();
                ctx.translate(this.position.x, this.position.y);
                ctx.strokeStyle = COLORS.PARAMEDIC;
                ctx.beginPath();
                ctx.arc(0, 0, this.popSize, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    class PandemicApp {
        constructor() {
            this.canvas = document.getElementById('bg');
            this.ctx = this.canvas.getContext('2d');
            this.agents = [];
            this.isActive = true;
            this.init();
            window.addEventListener('resize', () => this.resize());
            this.animate();
        }

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.agents.forEach(a => {
                if (a.position.x > this.canvas.width) a.position.x = this.canvas.width;
                if (a.position.y > this.canvas.height) a.position.y = this.canvas.height;
            });
        }

        init() {
            this.resize();
            this.agents = [];
            for (let i = 0; i < CONFIG.agent.count; i++) {
                this.agents.push(new Boid(this.canvas));
            }
            // Start with an initial cluster of infected
            for (let i = 0; i < 8; i++) {
                this.agents[i].state = 'INFECTED';
                this.agents[i].immunity = 0;
                if (i === 0) this.agents[i].isDiagnosed = true;
            }

            // Paramedics (initial 3)
            for (let i = 0; i < CONFIG.paramedic.minCount; i++) {
                this.agents.push(new Boid(this.canvas, true));
            }
        }

        updateParamedicCount() {
            const infected = this.agents.filter(a => a.state === 'INFECTED').length;
            const currentParamedics = this.agents.filter(a => a.isParamedic).length;

            // Scalable paramedic calling
            const required = Math.max(CONFIG.paramedic.minCount, Math.floor(infected / 10));

            if (currentParamedics < required) {
                this.agents.push(new Boid(this.canvas, true));
            } else if (currentParamedics > required && currentParamedics > CONFIG.paramedic.minCount) {
                // Remove one healthy paramedic
                const idx = this.agents.findIndex(a => a.isParamedic && !a.targetPatient);
                if (idx !== -1) this.agents.splice(idx, 1);
            }
        }

        animate() {
            if (!this.isActive) return;

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            const diagnosedList = this.agents.filter(a => a.isDiagnosed && a.state === 'INFECTED');

            this.updateParamedicCount();

            for (let i = this.agents.length - 1; i >= 0; i--) {
                const a = this.agents[i];
                a.update(this.agents, diagnosedList);
                a.draw(this.ctx);

                // If dead and rot timer finished, replace with new healthy member
                if (a.state === 'DEAD' && a.rotTimer <= 0) {
                    this.agents.splice(i, 1);
                    this.agents.push(new Boid(this.canvas));
                }
            }

            // Ensure infection never dies out
            const infectedTotal = this.agents.filter(a => a.state === 'INFECTED').length;
            if (infectedTotal === 0 && Math.random() < 0.02) {
                const healthyOnes = this.agents.filter(a => a.state === 'HEALTHY');
                if (healthyOnes.length > 0) {
                    const patientZero = healthyOnes[Math.floor(Math.random() * healthyOnes.length)];
                    patientZero.state = 'INFECTED';
                    patientZero.immunity = 0;
                }
            }

            // Periodic new member
            if (this.agents.length < CONFIG.agent.count && Math.random() < 0.01) {
                this.agents.push(new Boid(this.canvas));
            }

            this.drawStats();

            requestAnimationFrame(() => this.animate());
        }

        drawStats() {
            const stats = {
                HEALTHY: 0,
                INFECTED: 0,
                RECOVERED: 0,
                DEAD: 0,
                PARAMEDIC: 0
            };

            this.agents.forEach(a => {
                if (a.isParamedic) stats.PARAMEDIC++;
                else stats[a.state]++;
            });

            // Update HTML Legend if elements exist
            Object.entries(stats).forEach(([key, count]) => {
                const el = document.getElementById(`count-${key}`);
                if (el) el.textContent = count;
            });
        }

        stop() {
            this.isActive = false;
        }

        start() {
            if (this.isActive) return;
            this.isActive = true;
            this.animate();
        }
    }

    window.PandemicApp = PandemicApp;
})();
