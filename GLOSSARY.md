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

**Remains**:
What a dead Boid becomes for a few seconds: it stops, turns grey and fades away. Remains take no part in the ecosystem, are not counted in the Census and ignore Scatter.
_Avoid_: corpse, ghost, dead boid

**Stage**:
A Boid's life stage: Neonate, Juvenile or Mature. Stage sets its size and top speed.
_Avoid_: phase, age group

**Population Cap**:
The visitor-adjustable limit on how many Boids the ecosystem sustains; above it births are suppressed and mortality rises.
_Avoid_: max population, capacity

**Leader**:
The Trait with more living Boids in the Census at a given moment. The lead changes hands when the two counts cross.
_Avoid_: winner, dominant trait

**Famine**:
A temporary, system-triggered scarcity that lowers the Population Cap the ecosystem feels without touching the visitor's setting. It is separate from Apocalyptic mode, can overlap with it, and does not change the theme.
_Avoid_: drought, crash, reset

**Scatter**:
The visitor's pointer or finger pushing nearby Boids away.
_Avoid_: mouse avoidance, interaction

**Apocalyptic mode**:
A visitor-toggled ecosystem state of scarcity (lower effective Population Cap, higher mortality, stronger flee) shown with an inverted dark theme revealed by a circular wipe from the toggle.
_Avoid_: dark mode, night mode

**HUD**:
The glass overlay of controls above the canvas (the Dock), which can collapse to a single pill. The Census is not part of it.
_Avoid_: legend, bottom bar

**Census**:
The live count of Boids per Trait, shown as the Population History with each Trait's count and Stage bar labelled at the end of its line. It is a non-interactive backdrop behind the canvas so Boids move over it, and it greys out while the HUD is collapsed.
_Avoid_: stats, metrics, legend

**Population History**:
The rolling record of how many Boids of each Trait existed over the last couple of minutes of simulated time, shown as a graph as part of the Census. It has no numeric scale or Population Cap marker, and it glides continuously rather than stepping. Reset clears it.
_Avoid_: chart, timeline, log

**Stage bar**:
A thin bar beside a Trait's count in the Census showing that Trait's share of Neonate, Juvenile and Mature Boids, in three tiers of the Trait's colour.
_Avoid_: stage chart, breakdown

**Dock**:
The HUD's control strip: pause, reset, speed, Population Cap and the Apocalyptic toggle. It is a translucent glass surface that morphs into the pill when collapsed.
_Avoid_: toolbar, bottom bar
