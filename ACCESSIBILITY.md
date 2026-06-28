# Accessibility notes — Celestial-Equatorial (RA/Dec) Demonstrator

Target: WCAG 2.1 AA (AAA where reasonable). Built on the KL-UNL foundation, which
supplies the palette custom properties, `:focus-visible` ring, `.sr-only`, and the
responsive grid.

## Structure & landmarks
- One `<h1>` (the sim title) is rendered by the `<kl-unl-masthead>` component; the
  page does not add a competing `<h1>`. Panels use non-skipping `<h2>` headings
  ("The Celestial Sphere", "Star Position", "Labels").
- `<main>` wraps the content; each panel is a `<section aria-labelledby>`. A
  skip-link jumps to the controls. `<html lang="en">`.

## Text alternatives (1.1.1)
- The canvas has `role="img"` + `aria-label` and an `aria-describedby` pointing at a
  visually-hidden, `aria-live="polite"` description region.
- A global `aria-live="polite"` status region announces meaningful state changes on
  **commit** (slider release / field change / checkbox toggle / view-rotation end /
  reset) — not on every drag tick — e.g. *"Star at right ascension 4.0 hours,
  declination 60.0 degrees."*, *"Ecliptic labels shown."*, *"View rotated. Azimuth …"*.

## Equations / math (MathJax)
- The slider labels (`RA:`, `dec:`), the unit symbols (`ʰ`, `°`), the `0ʰ` in the
  "0ʰ Circle" checkbox, and a dynamic star-coordinate read-out
  (`RA = 4.0ʰ, dec = +60.0°`) are all typeset by **MathJax** via the foundation
  helper (`klunlShowEquation` / `klunlInitEqn`), paired with spoken screen-reader
  strings. Right-clicking any of this math opens MathJax's own menu ("Show Math As →
  TeX / MathML"); the menu is left enabled.
- **Canvas-baked text caveat (1.1.1 / 1.4.4):** the labels and numeric read-outs that
  ride *on the rotating 3-D sphere* (`North Pole`, `Ecliptic`, the `4.0ʰ`/`60.0°`
  values, etc.) are painted on the `<canvas>` and therefore cannot expose the MathJax
  menu and do not scale with browser font size. They are intrinsic to the 3-D diagram
  and cannot move to flowed HTML without losing the projection. Equivalents that **do**
  meet those requirements are provided in HTML: the MathJax star read-out and the
  live-region announcements carry the same RA/dec information, and the checkbox labels
  name every toggle. Human screen-reader QA is still recommended for the diagram.

## Colour & contrast (1.4.1 / 1.4.3 / 1.4.11)
- UI text/controls use the KL-UNL palette variables (≥ 4.5:1). Colour is never the
  only signal: the green/blue RA and red dec arcs are always accompanied by the
  textual `RA = …ʰ` / `dec = …°` read-out and on-sphere value labels, and every label
  layer has a text name. The physically-meaningful arc colours are kept but
  supplemented.

## Keyboard (2.1.1 / 2.1.2 / 2.4.7)
- Everything is keyboard-operable in a logical tab order with a visible focus ring.
- **Sliders** are native `<input type="range">` — Left/Down decrement, Right/Up
  increment, Page keys for large steps, Home/End for min/max — each with an
  `aria-label` (quantity name) and `aria-valuetext` ("4.0 hours" / "minus 30.0
  degrees"); see the AUDIO / SCREEN-READER PASS section below. A numeric field mirrors
  each slider for direct entry. Both paths mutate the same state. Tab moves away
  cleanly; no traps.
- The **canvas is focusable** (`tabindex="0"`) and also **takes focus on click**, so
  the arrow keys work immediately after a pointer interaction (no separate Tab needed).
- On the focused canvas the arrow keys control **either the view or the star**:
  - default mode rotates the view (Shift + arrows = larger steps);
  - **Enter** (or **M**) toggles to "move the star" mode, where arrows change the star's
    RA/dec (Shift + arrows = finer steps); the change is announced;
  - clicking the **star** vs. the **sphere** also sets which one the arrows control.
- The star therefore has two keyboard paths: the RA/dec sliders/fields, and the canvas
  arrow keys in star mode — both mutate the same state. The current mode is stated in the
  canvas's `aria-describedby` description.
- The masthead's modal manages its own focus trap/restore and Escape; the sim does
  not fight it.

## Pointer & touch (2.5 / responsive)
- Mouse and touch share one Pointer-Events path. The canvas sets `touch-action:none`
  so dragging the sphere/star doesn't scroll the page. Pointer coordinates are mapped
  back through the live canvas scale so hit-testing and the star-drag math operate in
  the original Flash stage coordinates at any display size. No hover-only affordances
  (hover only adds a non-essential star highlight). Buttons/controls meet the ≥ 44 px
  (2.75 rem) target size from the foundation.

## Timing / motion (2.2.2 / 2.3.3)
- No autonomous animation: the scene only changes in response to user input, so there
  is no >5 s motion to stop and nothing flashes. `prefers-reduced-motion` therefore
  needs no special end-state, and no Pause control is required.

## Zoom / reflow (1.4.4 / 1.4.10)
- Body text is ≥ 1.125 rem and all sizing is in rem/em, so it tracks the browser font
  setting. The layout reflows from the desktop/iPad two-column grid to a single
  stacked column (diagram → Star Position → Labels) at narrow / phone-portrait widths
  and at 200% zoom, with no horizontal scrolling or clipping; the canvas scales by CSS
  while keeping its internal coordinate system and aspect ratio.

## Still requires human QA
Automated review cannot replace testing with real assistive technology. A screen-reader
pass (NVDA/JAWS/VoiceOver) over the diagram description, the live announcements, and the
MathJax read-outs is recommended.

---

## AUDIO / SCREEN-READER PASS

A dedicated, behaviour-preserving pass to make the sim usable by audio alone (NVDA on
Windows; VoiceOver on macOS). No simulation behaviour, layout, visuals, physics, or
on-screen text was changed — only ARIA, `.sr-only` text, and narration strings. The
KL-UNL foundation files are untouched.

### Values made units-complete (quantity name + number + unit, spoken)
Every value with a unit now exposes the full spoken phrase to the accessibility tree;
the visible display is unchanged. A shared `spokenNum()` helper renders a leading
minus as the **word** "minus" (a bare "-" glyph is routinely dropped by readers).

| Where | Mechanism | Spoken string (examples) |
|---|---|---|
| Right-ascension slider | `aria-label` = name, `aria-valuetext` = value+unit | "Right ascension" … "4.0 hours" |
| Declination slider | `aria-label` = name, `aria-valuetext` = value+unit | "Declination" … "60.0 degrees" / "minus 30.0 degrees" |
| RA / Dec entry fields | `<input>` `aria-label` includes the unit | "Right ascension, hours"; "Declination, degrees" (value read literally) |
| Star coordinate read-out (the MathJax line) | visible math is `aria-hidden`; a `.sr-only` twin carries words | "Star position: right ascension 4.0 hours, declination minus 30.0 degrees." |
| Canvas state (azimuth / tilt / RA / Dec) | canvas `aria-describedby` description, updated from state | "…viewed at azimuth 217 degrees and tilt 32 degrees. A star is plotted at right ascension 4.0 hours, declination 60.0 degrees…" |
| "0ʰ Circle" checkbox | `.sr-only` twin replaces the glyph | accessible name "zero hour Circle" |

The sliders previously had no spoken name (their visible `RA:` / `dec:` labels are
MathJax and `aria-hidden`), which is the likely cause of the original "read as plain
numbers" failure; each now has an explicit `aria-label` plus `aria-valuetext`.

### Unit-word mappings applied (symbol shown, words spoken)
- degree glyph `°`  → "degrees"
- hours `ʰ`         → "hours"
- leading `-`       → "minus"

(The simulator only displays decimal hours and decimal degrees — to one decimal place,
matching its on-screen precision — so no arcminute/arcsecond/eV/etc. mappings apply.)

### Live status region (announcements)
- `#sr-status` is `aria-live="polite"`. It is updated only on **commit** — slider
  `change`, drag release, field commit, checkbox toggle, show-all/hide-all, Reset, and
  each keyboard view-rotation step — never on every intermediate drag tick, so the user
  is not flooded. Wording is units-complete and includes "minus" for negatives, e.g.
  *"View rotated. Azimuth 232 degrees, tilt 32 degrees. Star at right ascension 4.0
  hours, declination minus 30.0 degrees."*
- To avoid double-speaking, the canvas description (`#sky-desc`) is **not** a live
  region; it is read on demand via the canvas's `aria-describedby`.

### Canvas description approach
- The `<canvas role="img">` has a stable `aria-label` ("Celestial sphere diagram") and
  an `aria-describedby` pointing at a `.sr-only` paragraph that is rebuilt from state at
  every commit. It states the current view orientation, the star's RA/Dec (with units
  and "minus"), which labels are shown, and a one-line hint that the arrow keys rotate
  the view (Shift for larger steps). Decorative canvas art is conveyed only through this
  text equivalent; no informative value is canvas-only.

### Keyboard / controls
- Unchanged from the main build: native range sliders (arrows / PageUp-Down / Home-End),
  mirrored numeric fields, native checkboxes and buttons, and the focusable canvas with
  arrow-key rotation. Each control now announces a clear name + value + unit.

### Standard ARIA only (NVDA *and* VoiceOver)
- Only standard roles/properties are used (`aria-label`, `aria-valuetext`, `aria-live`,
  `aria-describedby`, `aria-hidden`, native form semantics) — no reader-specific hacks —
  so the same markup serves both NVDA and VoiceOver.

### Not yet human-verified
This pass reasons about the accessibility tree; it is **not** a substitute for a real
listening test. Final screen-reader compatibility must be confirmed by a human on
**NVDA (Windows; Chrome and Firefox)** and **VoiceOver (macOS; Chrome and Safari)**.
