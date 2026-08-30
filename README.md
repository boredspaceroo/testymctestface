# Starcloud-1 — Live Orbital Tracker

A cinematic, real-time 3D visualization of **Starcloud-1** — the Starcloud
satellite carrying the first data-center-class GPU (an NVIDIA H100) ever
flown in orbit. Built with [three.js](https://threejs.org) and
[Tone.js](https://tonejs.github.io), as a single static site with no build
step, ready for GitHub Pages.

## What it does

- Renders a real-time 3D Earth (day/night terminator, cloud layer,
  atmosphere glow) with a starfield, a distant Sun, and the Moon.
- Propagates Starcloud-1's actual orbit from its two-line element set (TLE)
  using a two-body + J2 perturbation model — the same mean elements
  published by Space-Track/CelesTrak, computed live in the browser. On load
  it tries to fetch the freshest TLE from CelesTrak; if that's unreachable
  (offline, or blocked by the browser) it falls back to a recent baked-in
  TLE and says so in the HUD.
- Shows altitude, ground speed, latitude/longitude, and orbital period,
  updating continuously, plus an "orbit clock" ring showing progress
  through the current ~95-minute revolution.
- Lets you drag to orbit the camera, scroll to zoom, click the satellite
  (or the crosshair button) to lock the camera to it, and speed up
  simulated time (1× / 120× / 1800×) to actually see it move — real time
  is too slow to watch.
- Opens into a cinematic camera flight-in with a screen burst, and plays a
  generative ambient score synthesized entirely in-browser (no audio
  files) once you enter.
- Includes a "Mission Data" drawer with the full research: spacecraft
  specs, current orbital elements, mission milestones, and company
  background.

## Deploying to GitHub Pages

1. Create a new GitHub repository and add these files at the repo root,
   keeping the folder structure:
   ```
   index.html
   css/style.css
   js/data.js
   js/orbit.js
   js/audio.js
   js/main.js
   README.md
   ```
2. Commit and push to the `main` branch.
3. In the repo, go to **Settings → Pages**, set **Source** to `main`
   branch, `/ (root)`, and save.
4. Your tracker will be live at
   `https://<your-username>.github.io/<repo-name>/` within a minute or two.

No build tools, bundlers, or API keys are required — everything loads from
CDNs at runtime.

## Notes on accuracy

This is a visualization, not an operational tracking tool. Position comes
from a simplified propagator (two-body motion plus the dominant J2 secular
drift terms for nodal regression and apsidal precession), not a full SGP4
implementation — accurate to within the normal drift of any TLE-based
model over the days-to-weeks around its epoch, but not mission-grade.
Earth's rotation is rendered at the real sidereal rate; the Moon is placed
at a stylized, compressed distance so it reads clearly on screen rather
than at true 1:400,000-ish scale.

## Attributions

- **three.js** (r128) — 3D rendering. Earth/cloud/specular textures are the
  standard `examples/textures/planets` assets from the three.js repository.
- **Tone.js** — in-browser generative audio synthesis.
- Mission and company data compiled from Starcloud, NVIDIA, GeekWire, Data
  Center Dynamics, SpaceNews, TechCrunch, Gunter's Space Page, and SatNOGS
  DB (August 2026).
- Orbital elements: Space-Track.org, via SatNOGS DB / CelesTrak.
