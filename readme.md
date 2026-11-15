# Savana Boids Simulation

A biologically-inspired boids simulation featuring complex social dynamics, life cycles, and interactive behaviors.

## 🧬 Traits & Behaviors

The simulation features two distinct behavioral archetypes that dictate how boids interact with their environment and each other.

### 1. Interdependent
- **Philosophy**: Strength in numbers, community, and social structure.
- **Behavior**: High **Alignment** and **Cohesion**. These boids actively seek out their specific "herd" (a **Herd**, identified by `herdId`) and move in synchronized patterns.
- **Reproduction**: Highly efficient in herds. They have a high base `reproChance` but requires being close to a partner within the herd.
- **Mortality**: Higher natural mortality rate due to competition for resources and herd visibility.

### 2. Individual
- **Philosophy**: Independence, resilience, and cautious exploration.
- **Behavior**: High **Separation** and **Space Hunger**. They prioritize personal space and spend most of their time wandering alone.
- **Reproduction**: Difficult and slow. Requires a rare chance encounter with another mature Individual.
- **Mortality**: Low natural mortality. Their solitary nature makes them more resilient and longer-lived.

---

## 🐣 Life Cycles (Growth Stages)

Boids progress through three distinct life stages, with their physical size and movement speed updating dynamically.

| Stage | Age Window | scale | speed | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Neonate** | 0 - 500 frames | 0.25 | 3.2 | Fast-moving, tiny "babies" that prioritize exploration. |
| **Juvenile** | 500 - 1200 frames | 0.45 | 2.2 | Adolescents transitioning into their behavioral traits. |
| **Mature**| 1200+ frames | 0.75 | 1.4 | Fully grown adults capable of reproduction (at age 1400+). |

---

## 🔄 Dynamic Trait Conversion

Boids are not fixed to one trait for life. Their behavior can shift based on their current stage:
- **Juvenile Adventure**: Interdependent juveniles have a small chance (`0.00045/frame`) to leave their herd and become solitary **Individuals**.
- **Mature Companionship**: Solitary mature individuals have a small chance (`0.00025/frame`) to seek the safety of an **Interdependent** herd.

---

## 🛠️ Configuration Variables (`savana.js`)

Key global variables that control the ecosystem's balance:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `initialCount` | 130 | Starting population count. |
| `maxPopulation` | 300 | Population Cap (default) (breeding stops here). |
| `reproductionCooldown`| 500 | Minimum frames between consecutive births for a boid. |
| `herdLimits.max` | 40 | Maximum size of a single herd before it splits into two. |
| `interactionRange` | 150 | Distance (px) at which boids sense the Scatter pointer. |
| `interactionForce` | 2.8 | Strength of the "flee" repulsion when interacted with. |

---

## 🕹️ Interaction & Controls
- **Scatter**: Move your mouse or drag your finger to push boids away. The push eases in smoothly with proximity and they reform their herds afterwards.
- **Census** (top-left): live total, Trait mix bar, Stage breakdown per Trait and a population sparkline with the cap as a dashed line. On small screens it shows its headline; tap to expand.
- **Dock** (bottom): pause/play (`Space`), reset, speed (0.5× / 1× / 2×), Population Cap slider and the **Apocalyptic** switch (`A`).
- **Hide interface** (`H`, or the chevron): collapses everything into a single pill.
- **Apocalyptic mode**: a dark theme revealed by a circular wipe from the switch, plus scarcity: effective cap ×0.6, mortality ×2.5, stronger scatter. Tunable in `CONFIG.apocalypse`.

## 🗂️ Files
`index.html` (markup) · `styles.css` · `savana.js` (simulation: fixed 60Hz timestep, spatial grid) · `hud.js` (Census, Dock, shortcuts). See `GLOSSARY.md` for terminology.
