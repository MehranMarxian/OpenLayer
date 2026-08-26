# Exchange Listing Demo — Shooting Script

Short, purpose-specific demo for the Adobe Exchange listing and reviewer notes — **not** a
replacement for `docs/video-01-intro-shooting-script.md`, which is the longer proof-of-concept
video for Reddit/community launch. This one has a narrower job: give a reviewer (or a browsing
Exchange visitor) the shape of the product in under 30 seconds, no narration required. Silent,
captioned, screen-capture only.

**Status:** draft. Target run time **20–25 seconds**, four cuts, one continuous document.

## Why this shape

Straight from the "killer demo" idea in the business-strategy review this was drafted alongside:
show the chain, not a feature list. Four tools, one document, no cuts to a different image between
them, so it reads as one coherent editing session rather than four separate demos stitched
together.

## Shot list

Use whatever local models you already have installed — this is recorded once by you, not run live
by a reviewer, so there's no reason to use the reviewer notes' "smallest ungated model" constraint
here. Use whichever preset currently gives the most visually striking result.

| # | Screen | Action | On-screen caption | Target length |
|---|---|---|---|---|
| 1 | Photoshop, blank canvas | Draw a rough sketch (a motorcycle, or whatever reads clearly at low res) | *"Sketch to Image"* | 3s |
| 2 | OpenLayer panel, Sketch to Image | Type a short prompt, click Generate, result lands as a layer | *(prompt text appears as it's typed)* | 6s |
| 3 | Same document, Inpaint or the instruction-editing preset | Select a region, type a short instruction ("make it red"), Generate | *(instruction text appears)* | 6s |
| 4 | Same document, Outpaint | Extend the canvas, Generate | *"Outpaint"* | 5s |
| 5 | Same document, Upscale | One click, result | *"Upscale — done."* | 3s |

Cut on the moment each result lands as a layer, not before — the "it actually became a layer in my
document" beat is the entire point, more than the generation itself.

## Text card, last half-second

```
OpenLayer
Local AI layers for Photoshop.
No cloud. Your GPU.
```

Matches the landing page's own framing (`docs/index.html` hero copy) — don't invent new positioning
language here, reuse what's already been written and tested.

## Brand spec

Reuse `docs/video-01-intro-shooting-script.md` section 1 (colours, type) rather than duplicating it
here — background `#000000`, gold `#ffc629` for any on-screen text, `JetBrains Mono`.

## Where this gets used

1. Attached to `docs/exchange-reviewer-notes.md` once recorded (currently a placeholder link there).
2. The Exchange listing's own video field, once you're filling that in (`docs/exchange-portal-registration.md`, Step 2).
3. Optionally the landing page hero, if it reads well at that length out of context.
