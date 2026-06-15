# Conversion notes — Celestial-Equatorial (RA/Dec) Demonstrator

## Behaviour model (one paragraph)

The sim shows a 3-D **celestial sphere** with a small tilted **Earth** at its
centre. The user looks at the sphere and can **drag anywhere to rotate their view**
of it (changing the sphere's `theta`/azimuth and `phi`/tilt). A single **star** sits
on the sphere; the user can **drag the star** (when it is on the near side) or set
its position with the **RA** (0–24 h) and **dec** (−90…+90°) sliders/fields. As the
star moves, green/blue **RA and dec arcs** and guide circles update to show how the
equatorial coordinates locate it, and the numeric **RA/dec read-outs** (e.g.
`4.0ʰ`, `+60.0°`) ride next to the star. A **Labels** panel toggles seven on-sphere
labels (Earth poles, equator, celestial poles, celestial equator, 0-hour circle,
ecliptic, east arrow) individually or all at once. The original is a generic
`CelestialSphere` engine (prototype-based AS1) wired by the demo controller; this
port keeps that engine's exact projection math.

## Source of truth

Behaviour was taken from the decompiled ActionScript under `scripts/`:
`Celestial Equatorial Demo.as` (controller), `CelestialSphere.as` +
`2…11 CS *.as` (the engine: geometry, mouse, horizon plane, shading, objects,
circles, lines, declination trails, shaded bands), `Globe Component v2.as`
(central Earth + shoreline data), `Draggable Star.as`, `DCS Label.as`,
`CSGradientDisk.as`, `toFixed.as`, and the per-instance `on(initialize)` handlers
that wire the controls. Constants, colours, tilts, formulas, label text and number
formatting are copied **verbatim**.

## AS → HTML5 mapping

| ActionScript | HTML5 port |
|---|---|
| `Object.registerClass` prototype classes | plain JS constructors (`Sphere`, `Circle`, `Line`, `SphereObject`) |
| `onEnterFrame` / MovieClip redraw | one `requestAnimationFrame` `render()` that redraws the canvas from state |
| `createEmptyMovieClip` + `lineStyle`/`moveTo`/`curveTo`/`drawArc` | canvas 2-D paths with the **same** coordinates/radii/colours; `drawArc` reproduced with `quadraticCurveTo` and the identical `cRad = 1/cos(halfStep)` control points |
| `doA`/`doM`/`doB` matrices, `WtoSz`/`CtoSz`/`CtoW`/`WtoC`/`StoMH`/`MHtoC`/`CtoMH` | ported method-for-method onto the `Sphere` prototype |
| great-circle front/back occlusion (`8 CS Circles.as`) | `Circle.computeArcs()` returns `front`/`back` arc lists; drawn in the front/back canvas layers |
| line segment occlusion (`9 CS Lines.as`) | `Line.computeSegments()` returns segments tagged `bE/fE/bI/aI` |
| object placement + `setOrientationType("absolute")` | `SphereObject.update()` computes screen pos + rotation + signed y-scale; reused art is `drawImage`'d with that transform |
| AS colour ints (decimal RGB) + alpha 0–100 | `css(int, alpha)` helper → `rgba()` |
| `Number.prototype.toFixed` polyfill | `asFixed()` reproduces it (`Math.round(x·10^d)`, zero-padded) so read-outs match |
| simple-drag mouse + `getMouseRaDec` | Pointer Events; `screenToRaDec()` = `StoMH`→`MHtoC`; pointer coords mapped back through the canvas scale |
| Flash `_root`/`_parent` chains, `trace()` | explicit refs; `trace` dropped |
| `FUIComponent`/`FPushButton`/`FCheckBox`/`Standard Slider v6` | **not** ported; reproduced as native `<input type="range">`, `<input>`, `<button>`, `<input type="checkbox">` |
| Title Bar + About/Help symbols | the shared `<kl-unl-masthead>` (Reset/About; Help suppressed) |

The constant-fixed parts of the original demo are preserved exactly: observer
**latitude = 90°** and **sidereal time = 0** (set in `init()` and never changed by
this demo's controls), so the celestial→world transform is constant; the
declination-trail and shaded-band subsystems are present in the engine but the demo
adds none, so they render nothing (matching the original).

## Reused exported assets vs. code-drawn

**Reused as-is** (copied to `assets/`, never redrawn):
- `assets/east-arrow.svg` (shape 148 — the East arrow), `assets/rotation-arrow.svg`
  (shape 88 — Earth's-rotation arrow near the NCP), `assets/marker.svg` (shape 83),
  `assets/star.svg` / `assets/star-hi.svg` (shapes 81/80 — the draggable star, normal
  and roll-over highlight), `assets/globe-water.svg` (shape 110, reference art).
  The four SVGs that are composited onto the canvas had a `viewBox="0 0 w h"` added
  (matching their existing `width`/`height`) — a metadata-only change, no path or
  visual edit — so `drawImage` rasterises and scales them consistently across
  browsers (Safari in particular). The art itself is untouched.
- `assets/fonts/Verdana.ttf` (the sim's interface font, `2_Verdana.ttf`).
- `assets/mathjax/` — local MathJax build (no CDN).

**Code-drawn** (no exported file exists — these are built at runtime in the AS, so
they are reproduced with canvas 2-D math): all great circles / arcs / guide circles,
the pole-axis extension lines, the radial sphere shading (gradient disks + edge
vignette), the celestial-pole markers, and the central **Earth** (blue water disk +
front-facing continents from the verbatim `_shoreData`, plus the rotation axis).

## contents.json entry added

The only edited foundation file is `foundation/contents.json`; this entry was added
(alphabetically), help content left `""` so the masthead shows no Help button (the
original `helpLinkageName` was empty):

```json
"celestialEquatorial": {
  "meta": { "title": "Celestial-Equatorial (RA/Dec) Demonstrator", "version": "2.0 (Accessible HTML5)" },
  "masthead": {
    "help":  { "title": "Help and Instructions", "content": "" },
    "about": { "title": "About this Demonstrator", "content": "…verbatim NAAP boilerplate (texts 3/8/9) + astro.unl.edu + version…" }
  }
}
```

## Deviations from the original (Goal A vs. Goal B)

1. **On-sphere text labels are drawn upright.** In the AS, the eight text labels use
   the default object-orientation transform, which (with their zero offset vector)
   computes a +90° shell rotation; the original label symbols evidently counter-rotate
   their text internally (that internal rotation is not recoverable from the exported
   assets). Rather than risk rendering the labels sideways/unreadable, they are drawn
   **upright** at the same projected screen position. Legibility (WCAG) is preferred
   over reproducing the orientation transform. Their *physics/positions* are unchanged.
2. **Label glyph text** was recovered verbatim from `texts/*.txt`
   (`North Pole`, `South Pole`, `North Celestial Pole`, `South Celestial Pole`,
   `Equator`, `Celestial Equator`, `Ecliptic`, `East`). The small zero-hour label is
   shown as `0h`; the source stores only the checkbox string `0h Circle`, so if the
   on-sphere glyph differed it should be corrected in `LBL.zeroHours`'s text.
3. **Sphere depth-shading is approximated** with canvas radial gradients (the AS uses
   masked gradient-disk MovieClips for the same visual depth cue). This is cosmetic
   only and uses no color-as-information.
4. **Reduced motion:** this demo has no autonomous animation — nothing moves unless
   the user drags or adjusts a control — so there is no continuous motion to pause and
   no `prefers-reduced-motion` end-state to substitute. A Pause button is therefore
   not needed.
5. The Flash slider was one widget (bar + numeric field). It is reproduced as a native
   range **plus** a numeric field, both editing the same state, for full keyboard and
   direct-entry parity.

No physics, constant, formula, or educational/label text was changed to satisfy
accessibility — only presentation (orientation, colour-supplementing, controls).
