# Celestial-Equatorial (RA/Dec) Demonstrator — HTML5

An accessible HTML5 rebuild of the legacy Adobe Flash sim
`celestialEquatorialDemo008` (22 July 2009), built on the shared KL-UNL
foundation.

## This sim must be served over HTTP — it will **not** run from a double-clicked `file://` path

**Why:** the KL-UNL masthead component (`foundation/kl-unl-masthead.js`) loads its
title / About / Help text with `fetch('foundation/contents.json')`. Browsers block
`fetch()` of local files under the `file://` protocol (same-origin policy), so
opening `index.html` directly shows a broken/empty masthead and the sim never
initialises. Served over HTTP the fetch succeeds and everything loads.

## How to run locally

From **inside this `html5/` folder**, start any static server:

```bash
# Python 3
python3 -m http.server 8123
#   then open  http://localhost:8123/

# Node
npx serve
#   (or: npx http-server)
```

Or use the **VS Code “Live Server”** extension.

Because you are serving from inside `html5/`, the sim is at the **server root**, so
the URL is `http://localhost:8123/` — *not* `.../html5/index.html`.

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works; the
`file://` limitation only affects local double-clicking.

## What's here

```
index.html          KL-UNL shell + <kl-unl-masthead> + the three panels
foundation/         KL-UNL foundation, copied in UNCHANGED
                      kl-unl-masthead.js, kl-unl.css, kl-unl.js,
                      contents.json (with this sim's entry added),
                      assets are vendored under assets/ (see below)
styles/styles.css   sim-specific styles only (foundation is never edited)
simulation.js       the whole sim (3-D celestial-sphere engine + controller)
assets/             reused exported art (star, arrows, marker SVGs),
                      Verdana font, and a local MathJax build (no CDN)
README.md           this file
CONVERSION_NOTES.md behaviour model, AS→HTML5 mapping, deviations
ACCESSIBILITY.md    WCAG affordances and the canvas-text caveat
```

No build step, no bundler, no framework, no CDN. The only runtime fetches are
local: `foundation/contents.json` and the vendored MathJax. Nothing leaves the host.

## Browser / OS compatibility

Works on current **Chrome, Edge, Firefox, and Safari** across **Windows, macOS,
Linux, iOS, and Android**. The code is plain ES5-compatible JavaScript (no
optional chaining / nullish syntax), uses Pointer Events (so mouse, trackpad and
touch share one path), and `touch-action: none` so dragging the sphere/star never
scrolls the page on touch devices.

Notes for maximum compatibility:
- The canvas-composited SVGs carry an explicit `viewBox` + `width`/`height`, and the
  drawing code falls back to known intrinsic sizes — this works around Safari
  reporting `naturalWidth === 0` for some SVGs.
- The square canvas is preserved with `width:100%; height:auto` (intrinsic ratio),
  so it stays square even on browsers that predate the CSS `aspect-ratio` property.
- The shared KL-UNL masthead's About dialog uses the native `<dialog>` element, which
  requires **Safari ≥ 15.4** (2022). This is a property of the foundation (unchanged
  here) and is the same for every sim built on it; the simulation itself works on
  older engines.
