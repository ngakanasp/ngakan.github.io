# Savana

An interactive boids ecosystem shown as the hero of the Ngakan landing page. Boids live, grow, flock and die while the visitor scatters or observes them.

## Language

**Boid**:
A single simulated creature with a trait, a life stage and an age.
_Avoid_: agent, particle, bird

**Trait**:
The social behavior archetype of a Boid, either Interdependent or Individual. A Boid can change trait during its life.
_Avoid_: type, species, personality

**Interdependent**:
The trait of Boids that seek cohesion and alignment with their Herd and reproduce more easily, at the cost of higher mortality.
_Avoid_: group, social, GROUP

**Individual**:
The trait of Boids that prioritise personal space and wander alone, reproduce rarely and live longer.
_Avoid_: solo, loner

**Herd**:
The set of Interdependent Boids sharing one herd identity; it splits when it grows past its size limit.
_Avoid_: flock, group, pack

**Stage**:
A Boid's life stage: Neonate, Juvenile or Mature. Stage sets its size and top speed.
_Avoid_: phase, age group

**Population Cap**:
The visitor-adjustable limit on how many Boids the ecosystem sustains; above it births are suppressed and mortality rises.
_Avoid_: max population, capacity

**Scatter**:
The visitor's pointer or finger pushing nearby Boids away.
_Avoid_: mouse avoidance, interaction

**Apocalyptic mode**:
A visitor-toggled ecosystem state of scarcity (lower effective Population Cap, higher mortality, stronger flee) shown with an inverted dark theme revealed by a circular wipe from the toggle.
_Avoid_: dark mode, night mode

**HUD**:
The overlay of controls and live ecosystem metrics (census, dock) that sits above the canvas and can collapse to a single pill.
_Avoid_: legend, bottom bar

**Census**:
The HUD panel showing live counts of Boids by Trait and Stage and the population trend.
_Avoid_: stats, metrics, legend

**Dock**:
The HUD's control strip: pause, reset, speed, Population Cap and the Apocalyptic toggle.
_Avoid_: toolbar, bottom bar
