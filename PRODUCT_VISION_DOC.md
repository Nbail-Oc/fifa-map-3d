# Stadium Navigator — Product Vision & Technical Doc

## 0. What This Is (read this first)
This is a **hackathon concept demo**, not a shippable product. The prototype proves out the navigation UX and the crowd-intelligence/AI reasoning layer. It intentionally does **not** attempt to solve indoor positioning — that's a hard, well-studied infrastructure problem (see Section 4), and pretending to solve it in a hackathon would be less credible, not more. Our differentiation isn't "we built indoor positioning" — several companies (Mappedin, Pointr, Oriient) already sell that as infrastructure. Our differentiation is the **predictive crowd-intelligence + AI reasoning layer** that sits on top of a positioning system, which none of them currently offer. See Section 9 for how we're different.

## 1. One-Line Pitch
An AI reasoning and crowd-prediction layer for stadiums — plugs into indoor positioning infrastructure to turn fan navigation requests into live operational intelligence for staff.

## 2. Problem
Stadiums are large, repetitive, and confusing. Fans get lost finding seats, food, restrooms. Staff have no live visibility into crowd density, incidents, or where their team is. Indoor wayfinding companies solve the "show me a map" problem. Almost none of them turn that data into predictive operations intelligence.

## 3. Core Insight
**Navigation is the feature. Crowd intelligence is the product.**
Every fan asking "where's the nearest restroom" is a data point. Aggregated across thousands of fans (even a partial sample — see Section 6), it predicts congestion before it happens and lets staff act proactively instead of reactively.

## 4. Indoor Positioning — the Real Plan (not QR codes)

This is infrastructure, not a hackathon-buildable feature. The plan is to **integrate**, not invent:

| Phase | Approach | Why | Cost/effort |
|---|---|---|---|
| Pilot / MVP | **BLE beacons** on a fixed grid (~1 beacon per 15-20m of corridor) | Cheap, well-understood, off-the-shelf hardware (iBeacon/Eddystone), no need for venue Wi-Fi access | ~$20-30/beacon; a single concourse section installable in about a day |
| Fallback / cheaper option | **Wi-Fi RSSI fingerprinting** using the venue's existing access points | No new hardware if venue already has dense Wi-Fi, but requires a calibration walk to build the signal map | Software + a few hours of walking the space with a survey app |
| Outdoor→indoor handoff | Standard GPS until the user crosses a gate threshold (beacon/Wi-Fi signal detected), then switch | Matches how airport/mall indoor-nav apps already do this | Standard SDK pattern, not novel |
| Future upgrade | **UWB** for staff-grade (<1m) accuracy | Needed only where dispatch precision really matters (medical, security) | Higher hardware cost, phased in later, not required for fan navigation |

**Orientation/heading**: read from phone compass/IMU, same as any turn-by-turn app — needed for AR mode specifically, not for the 2D map.

**What the hackathon demo actually shows**: the 2D map, pathfinding, and AI layer running on **simulated position data** standing in for beacon/Wi-Fi pings. The positioning source is intentionally swappable — the pathfinding, AI reasoning, and crowd-prediction code has no idea whether a "position update" came from a beacon, Wi-Fi fingerprint, or a simulator, which is precisely the point: build the intelligence layer now, plug in real positioning hardware later without rewriting the product.

## 5. Stadium Mapping Process

- **Input**: most venues already have CAD/architectural floor plans (required for fire code compliance) — this is the starting point, not a from-scratch survey.
- **Workflow**: an admin tool overlays the floor plan image, and someone (venue ops staff or our onboarding team) traces walkable corridors and drops POI pins (gates, food, restrooms, medical, seat sections) on top — comparable to how existing wayfinding vendors (Mappedin, Pointr) onboard venues.
- **Time estimate**: roughly 1-3 days per level for a mid-size stadium concourse, not weeks — most of the effort is verifying POI accuracy, not drawing corridors.
- **Multi-level**: each level/concourse is a separate map layer; vertical connections (stairs, elevators, ramps) are modeled as special edges between layers in the graph.
- **Updates**: a closed restroom or new food stall is a pin edit in the admin tool, not a remap — this is a live-editable data layer, not a static asset.

## 6. Two Modes, One Map

### Fan Mode
- **2D game-like map** (Gather.town-style top-down pixel/tile map) — primary, fully working navigation surface in the demo; in production this same map/graph is driven by real beacon/Wi-Fi position data instead of simulated input
- Tap a destination (seat, gate, food, restroom, medical) → auto-pathfinding shows the route
- **AI chat layer**: ask in natural language ("I'm hungry", "quietest restroom", "my dad's in a wheelchair") → AI reasons over live map + crowd data, replies with a route and context
- **AR/3D showcase mode** (explicitly a demo/marketing moment, not a core feature): one real hallway captured via Gaussian splat. Honest framing: this has no proven fan demand yet and adds maintenance burden (splats go stale when signage changes) — kept as an optional stretch, not part of the core value proposition

### Staff Mode
- Same underlying map, operations view
- Staff carry a **dedicated low-cost BLE badge device** (not their personal phone) — sidesteps privacy/union concerns since it's an opt-in work device on a known beacon grid, and gives the <5m accuracy staff dispatch actually needs (vs. the fuzzier accuracy that's fine for fan navigation)
- Live dots: self (green), other staff (blue), crowd density zones, alerts (medical/maintenance/security)
- Predictive alerts: "Gate 5 will be crowded in 7 minutes," "nearest medic is 38m away"
- Manager query: "what's happening?" → AI summarizes live state + recommends action

## 7. Crowd Intelligence — Data Sourcing at Realistic Adoption

We do not assume high app adoption. The model:
- Fan app pings are a **sample**, not a census.
- Calibrate that sample against ground truth the venue already has — turnstile counts, existing Wi-Fi association logs, ticketing/seat-occupancy data — to extrapolate total crowd density, the same way traffic apps like Waze produce useful predictions from a fraction of drivers actually using the app.
- This means the system produces useful signal even at <20% adoption, and gets more precise as adoption grows — it degrades gracefully rather than requiring a threshold to work at all.
- Threshold-based alert logic (e.g. "N pings near node X in Y minutes → flag") is what actually powers the "predictive" alerts — simple, reliable, and honestly described as rule-based rather than overclaiming as ML.

## 8. What We're NOT Solving in This Demo
- Real indoor positioning hardware/deployment (explicitly infrastructure to integrate, not build — see Section 4)
- Full-stadium 3D capture — scoped to one splatted hallway, if time allows, and framed as optional
- Production-grade auth/security/scale
- Venue IT integration (Wi-Fi credentials, network access, ticketing API) — noted as a real Year-1 dependency, not solved here

## 9. Competitive Landscape & Moat
- **Google/Apple Maps indoor**: exists for airports/malls but has minimal stadium coverage and no predictive operations layer.
- **Ticketmaster/SeatGeek**: have static seat maps, not live navigation or crowd intelligence.
- **Mappedin, Pointr, Oriient**: legitimate, more mature competitors — they already solve indoor mapping and positioning as infrastructure. We are not trying to out-build their positioning tech.
- **Our actual differentiation**: none of the above currently offer a live AI reasoning layer (natural-language fan queries, AI-generated staff summaries) or a predictive crowd-intelligence engine built from aggregated navigation requests. That layer is venue-agnostic and could realistically sit on top of an existing Mappedin/Pointr deployment rather than replacing it — which is also a more realistic path to market (partner, don't compete on infra) than trying to displace established indoor-positioning vendors.

## 10. Go-to-Market (realistic shape, not "Year 1: many stadiums")
- **Pilot**: one venue, one concourse section, not a full stadium — proves the mapping workflow, positioning integration, and crowd-alert logic at small scale before scaling up.
- **Rough pilot cost/timeline**: BLE beacon hardware + install for one concourse (low hundreds of dollars in beacons, ~1 day install) + 1-3 days of map digitization — a multi-week pilot, not a multi-month one, assuming venue cooperation on floor plans and Wi-Fi/network access.
- **Pricing direction** (to be validated, not finalized): likely a per-venue licensing model, since the value (crowd intelligence, reduced incident response time) accrues to the venue operator, not per-fan.
- **Dependency to flag honestly**: this requires real venue partnership — floor plans, network/Wi-Fi cooperation, possibly ticketing API access for seat data — none of which a hackathon team can secure on its own timeline.

## 11. Technical Architecture

```
Fan App (Phaser 3 tile game) ─┐
                               ├─> Firebase Realtime DB ─> Staff Dashboard (same map, ops view)
Simulated GPS/position pings ─┘         │
                                         ▼
                              Threshold logic (Firebase Functions)
                                         │
                                         ▼
                                  Alerts + AI Layer (Claude API)
```

| Layer | Tech | Why |
|---|---|---|
| Fan map/navigation | **Phaser 3 + Tiled** | Tile-based game engine, built-in collision/pathfinding support, fast to build a Gather.town-style map |
| Pathfinding | **A\*** on tile grid (`pathfinding` npm or hand-rolled) | Simple, fast, well-understood |
| Position input | Simulated pings / QR-checkpoint scan → mapped to tile coords | Real GPS indoors is unreliable; this keeps the demo controllable |
| Real-time sync | **Firebase Realtime DB** (or Supabase) | Instant multi-client updates (fan pings, staff positions, alerts), minimal backend code |
| AI layer | **Claude API** | Natural-language queries, reasoning over live map + crowd JSON context, staff summaries |
| Crowd prediction | Simple threshold rules in Firebase Functions | Reliable on stage; framed as "predictive AI" in the narrative |
| AR/3D showcase | **Luma AI or Polycam** (Gaussian splat), `@lumaai/luma-web` embed | Photoreal "wow" moment for one hallway, no custom renderer needed |
| Staff dashboard | Same Phaser/React map, different data layer | Reuses fan-side map, just changes what's rendered on top |

## 12. Data Model (core objects)
- **Node**: `{id, x, y, type: gate|seat|food|restroom|medical|junction}`
- **Edge**: `{from, to, weight}` — corridor connections for A*
- **Ping**: `{userId(anon), nodeId, timestamp}` — fan or staff position event
- **Alert**: `{type, location, severity, timestamp, assignedStaffId?}`

## 13. Build Priority (hackathon time budget)
1. Tile map + working pathfinding (core, must work live)
2. AI chat query layer (high wow, low effort — mostly prompt engineering)
3. Staff dashboard on simulated fan data (reliable, dramatic crowd-alert demo)
4. AR/splat showcase (only if time remains — scripted, one location)

## 14. Pitch Line for Judges
> "We're not claiming to have solved indoor positioning — that's real infrastructure, and mature vendors already do it. What we've built is the layer none of them have: an AI reasoning and predictive crowd-intelligence engine that turns fan navigation requests into live operational insight for staff. Plug it into any indoor positioning system, and the more people use it, the smarter and safer the venue becomes."