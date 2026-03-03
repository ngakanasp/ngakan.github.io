# Savana Boids Simulation

A biologically-inspired boids simulation featuring complex social dynamics, life cycles, and interactive behaviors.

## 🧬 Traits & Behaviors

The simulation features two distinct behavioral archetypes that dictate how boids interact with their environment and each other.

### 1. Interdependent (Group Trait)
- **Philosophy**: Strength in numbers, community, and social structure.
- **Behavior**: High **Alignment** and **Cohesion**. These boids actively seek out their specific "herd" (identified by `groupId`) and move in synchronized patterns.
- **Reproduction**: Highly efficient in groups. They have a high base `reproChance` but requires being close to a partner within the herd.
- **Mortality**: Higher natural mortality rate due to competition for resources and group visibility.

### 2. Individual (Solo Trait)
- **Philosophy**: Independence, resilience, and cautious exploration.
- **Behavior**: High **Separation** and **Space Hunger**. They prioritize personal space and spend most of their time wandering solo.
- **Reproduction**: Difficult and slow. Requires a rare chance encounter with another solitary mature boid.
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
| `maxPopulation` | 300 | Maximum ecosystem capacity (breeding stops here). |
| `reproductionCooldown`| 500 | Minimum frames between consecutive births for a boid. |
| `groupLimits.max` | 40 | Maximum size of a single herd before it splits into two. |
| `interactionRange` | 150 | Distance (px) at which boids sense mouse/touch input. |
| `interactionForce` | 2.8 | Strength of the "flee" repulsion when interacted with. |

---

## 🕹️ Interaction & Controls
- **Tactile Avoidance**: Move your mouse or drag your finger on the screen to "scatter" the boids. They will flee from the interaction point and reform their groups once you stop.
- **Live Metrics**: The bottom-left legend tracks real-time population counts for both traits across all life stages.
- **Status Toggle**: The status dot beside the header serves as a visual indicator for future behavioral overrides.
