# Ultra Roadbook Vision

## Mission

Ultra Roadbook helps ultra cyclists create the best possible race plan before the race.

It transforms a GPX route into a trusted roadbook through analysis, comparison, and verification — then exports a plan the rider can rely on.

During the race, a separate companion app executes that plan. It does not re-analyse, compare, or verify.

---

## Two Products, One Engine

Both applications share the same analysis engine. They serve different goals, users, and interfaces.

### Planning App (this application)

**Desktop / web · before the race · at a desk**

Workflow: **Understand → Compare → Verify → Plan → Export**

The planning app is not a passive study tool. It helps the rider make better planning decisions before the race — always grounded in facts and reasoning, never in live race context.

Planning decisions the app should support:

- Is this a good place to refill?
- Which stop is the safest?
- Which climb requires preparation?
- Which climbs should I train for?
- Where should my stages end?

These questions belong here because they require analysis, comparison, and judgment — not because the rider is on the bike right now.

Capabilities:

- Upload GPX and analyse the route
- Understand the route, climbs, surface, and resupply landscape
- Compare stops, climbs, and strategic options
- Verify data quality and trustworthiness
- Plan stages and resupply strategy
- Export a trusted roadbook and other planning outputs *(PDF roadbook today; flythrough film and companion sync in backlog)*

---

### Race Companion (future · separate application)

**Mobile · during the race · on the bike**

Workflow: **Navigate → Execute → Stay informed**

The companion does not analyse, compare, or verify. It consumes the planning data that was already created and exported.

Questions the companion answers:

- Next water
- Next food
- Next climb
- Time to next stop
- Am I on schedule?

No complex analysis. No option comparison. Only execution against a plan the rider already trusts.

---

## Page Guardrails

Every page in the planning app has two definitions:

1. **Purpose** — the question the page exists to answer.
2. **Success criterion** — what the rider should know after leaving the page.

If a page contains elements that do not help the rider leave with that knowledge, question whether they belong there — on another page, in advanced/debug, or in the companion app.

| Page | Purpose | Success criterion |
|------|---------|-------------------|
| **Dashboard** | What are the biggest challenges of this race? | I know the biggest challenges of this race. |
| **Route** | Where are those challenges on the route? | I know where everything important happens. |
| **Unsupported** | How do I survive the difficult self-supported sections? | I know which unsupported sections matter and how hard they are. |
| **Stops** | Where should I most likely resupply, and which options do I trust? | I know where I will most likely stop and which alternatives I trust. |
| **Climbs** | Which climbs deserve my preparation and why? | I know which climbs require preparation and why. |
| **Surface** | What terrain should I prepare my equipment for? | I know whether my tyres, bike, or pacing need to change. |
| **Verify** | What information still needs to be checked before I trust this roadbook? | I know what still needs manual verification before I trust the roadbook. |
| **Stages** *(future)* | Where should my race be divided into balanced stages? | I know how I want to divide my race. |

Use these when evaluating new features, copy, and layout. A beautiful component that does not advance the page's success criterion is a candidate for removal or relocation.

---

## Core Principles

Trust over quantity.

Insights over raw data.

Explain every recommendation with facts and reasoning.

Reduce uncertainty during planning — not during the race.

Planning decisions should be informed, not rushed.

Water is usually more important than food.

Advanced analysis stays hidden unless requested.

---

## Design Philosophy (Planning App)

Information-rich is acceptable — the rider is preparing at home, not glancing at a phone.

Every screen answers one clear question and advances one success criterion (see Page Guardrails above).

Insights first; details on demand.

Visual before textual where it aids understanding.

Premium quality over feature quantity.

**Litmus test for every feature:** Does this make race preparation easier?

Not: Would this be useful while riding?

Companion patterns (next water, refill now, minimal glance UI, live position) do not belong in the planning app.

Optional immersive preparation tools (see Backlog) may pass the litmus test without being part of the core planning workflow.

---

## Long-term Goal

The rider plans an entire ultra race using only Ultra Roadbook — without needing several different tools.

The exported roadbook becomes the single source of truth for the race companion.

---

## Backlog

Features deferred until the core planning workflow (Dashboard → Route → Unsupported → Stops → Climbs → Surface) is excellent.

### Route Flythrough *(optional preparation · after core workflow)*

**Category:** Optional **planning output** — not a page in the application. One of the deliverables of a finished race plan, alongside the PDF roadbook and companion sync data: a generated asset stored in the race project.

**Purpose:** After watching the film, the rider feels like they already know the race — landscape, rhythm, and the moments that matter — before arriving on the start line.

**Success criterion:** I have a calm, felt understanding of the route: where it gets hard, where it gets remote, where the terrain changes, and where the important planning moments sit in the story of the ride.

**Aesthetic:** Premium race briefing film — **not** a Google Earth flythrough, **not** YouTube annotations.

- Very minimal. Very calm. Very cinematic.
- The landscape tells the story; the camera does the work.
- Reference tone: Apple keynote titles, Formula 1 intro graphics, a high-end cycling documentary.
- Most of the runtime: nothing on screen except the route and the land.

**Placement:** Lives in **Export** (or equivalent project outputs), not the main tab navigation. Generate, store, replay, or regenerate from the project — same mental model as re-exporting a roadbook.

**Interaction:**

1. Rider clicks **Generate Flythrough** from project exports.
2. Application renders the video once (background job; progress UI).
3. Rendered asset is stored inside the **race project** — opening the project does not re-render.
4. Rider can **regenerate whenever they want** after analysis or planning changes.

**Film structure:**

**Opening title card** — brief, typographic, then fade to route:

```
The Capitals 2026
823 km · 14,800 m climbing
Estimated riding time · …
```

**Main body** — camera follows the route continuously. No persistent HUD. Overlays **fade in only at important moments**, hold briefly, then **fade away** so the landscape returns.

**Overlay examples** (content sourced from existing analysis and planning choices; presentation stays sparse):

*Hardest climb*
```
🏔 Hardest climb
Col du …
18.4 km · +1,210 m · Average 6.6%

Steepest: 50 m · 100 m · 250 m · 500 m · 1 km
Estimated climbing time
Previous resupply · Next reliable water
```

*Longest unsupported section*
```
💧 Longest unsupported section
47 km · +1,280 m · 18 km gravel
Last reliable water · Last reliable food
First reliable stop afterwards
```

*Longest gravel section*
```
🪨 Longest gravel section
12.4 km
Surface · Typical speed reduction
```

*Highest point*
```
🏁 Highest point
2,415 m
```

Overlays are **calm briefings** at story beats — never turn-by-turn navigation, never a constant data layer.

**Visual requirements:**

- Realistic 3D terrain (licensing-permitting provider) rendered with **cinematic** camera work — low enough to read road vs forest track, open mountain vs forest, valleys, exposed ridges, villages, lakes, river crossings.
- Deliberate pacing and framing; the route path is always clear without feeling like a satellite tour.

**Dependencies (build when implementing):** Race projects (asset storage), stable planning anchors (selected stops, verified POIs), export pipeline for overlay cue sheet alongside PDF roadbook and companion sync.

**Explicitly not:** Google Earth–style tourist flythrough, persistent on-screen metrics, a dedicated app page or tab, live 3D viewer, in-race navigation, companion feature, or substitute for Route / Unsupported planning pages.

---

## Success

**Planning:** A rider uploads a GPX. After preparing at their desk, they trust their plan — stops chosen, climbs understood, stages balanced, roadbook exported.

**Companion (future):** During the race, the rider gets quick answers from the plan they already made — never re-deciding what the planning app already resolved.

The rider should never need another application while planning their race.
