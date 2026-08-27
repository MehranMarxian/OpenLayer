# Multi-Reference Composition: Gate Findings

Live results for the four questions [`multi-reference-composition.md`](multi-reference-composition.md)
put in front of the UI work. Run 2026-08-27 against ComfyUI 0.30.0 on 127.0.0.1:8190,
RTX 4070 Ti 12 GB, FLUX.2 Klein 4B fp8 + `qwen_3_4b` + `flux2-vae`, 4 steps, CFG 1,
`er_sde`/`simple`, shift 3 -- the stack already shipped for `edit-flux2-klein`.

Every question was run as a control/variant pair, and every claim below that says
"reproducible" was checked on more than one seed. Nothing here needed a new download
or a custom node.

**Two of the four answers overturn assumptions the plan document was built on.**
Read Q3 and Q4 before writing any UI.

---

## Q1 -- How many references before it degrades?

**Answer: identity never degraded. There is no reference count to cap the UI at.**
Human identity held at 3, 4, 5 and 6 references. What breaks is the *placement* of
secondary objects, and it is content-dependent, not count-dependent.

| Refs | Composition | Result |
| --- | --- | --- |
| 3 | bg + man + woman | clean |
| 4 | + dog | clean on 4/4 seeds (777, 101, 202, 303) |
| 4 | bg + man + woman + **bicycle** | **bicycle broken on 3/3 seeds** |
| 5 | + dog + bicycle | **dog duplicated on 4/4 seeds** |
| 5 | + dog + hat | clean |
| 5 | + bicycle + dog (reordered) | clean on 3/3 seeds |
| 6 | + dog + bicycle + hat | dog duplicated; faces smaller but still correct |

The bicycle is the whole story. On its own at **four** references it renders as two
bicycles (seed 101) or one impossibly elongated bicycle (seeds 202, 303). Added
alongside the dog it does not break itself -- it makes the *dog* duplicate. Swap the
chain order so the bicycle comes before the dog and everything resolves cleanly.

The pattern is not "the fifth reference fails" and not "the last reference fails" --
both are contradicted by runs above. What correlates is the kind of object: a wide,
thin, structurally continuous thing that has to sit *behind* the two people is where
composition fails. Compact subjects that sit beside them (the dog) and worn items
(the hat, which the woman correctly ends up wearing) are reliable.

**Cost:** roughly +4 s per added reference -- 20 s at 3 refs, 32 s at 6, on a 4070 Ti.

**For the UI:** do not hard-cap the list at four. Reference *order* is a real quality
lever and the panel must let an artist reorder -- but for object coherence, not for
the reason the plan gave (see Q3).

## Q2 -- Does identity hold on real photographs?

**Answer: no -- not the way it holds on generated sources. Everything about a person
transfers except their face.** This is the one result that should change how v0.19 is
described.

Tested against four real photographs from Wikimedia Commons (licences and attribution
in `real_manifest.json`): a modern CC0 studio portrait of a young man, a modern CC0
outdoor candid of a deeply weathered elderly man, and two archival Wellcome
Collection photographic portraits (CC BY 4.0, both sepia).

The control makes the reference's contribution unambiguous. Control is the background
reference **alone** with "a person is standing on the beach"; the variant adds the
person reference and changes nothing else. The control produced a generic woman in a
white t-shirt, so everything below is the reference doing the work.

| Source | What transferred | What did not |
| --- | --- | --- |
| Modern studio portrait, young man | cream crewneck sweater exactly, dark cropped hair, stubble, build, age | **the face** -- narrower, longer nose, different smile; a similar-looking man, not the same one |
| Modern candid, weathered elderly man | red striped garment with its white piping, wispy grey hair, warm skin | **the weathering** -- deep-set wrinkles smoothed away, reads 15-20 years younger |
| Archival sepia, walrus moustache | tweed three-piece, collar and tie, the moustache, swept-back greying hair | **the face** -- different eyes and nose; an actor in the costume |
| Archival sepia, hooded man with prayer wheel | pointed hood, wrapped robes, chevron shawl, prayer wheel, beads, goatee | **the face** -- drifted from East Asian toward European features |

Consistent at both seeds tested, and consistent across all four subjects. A two-person
run composed correctly -- both men side by side, correct wardrobe each, coherent
sunset light -- with the same caveat: right people-shaped placeholders, wrong faces.

The cleanest source is the most damning. The modern studio portrait is square,
frontal, evenly lit and sharp -- as close to an ideal input as an artist could supply
-- and its face still came back re-imagined. So this is not a framing, crop or
resolution problem that better inputs would fix.

Worth noting for anything user-facing: **the model silently colourises monochrome
sources.** Both sepia portraits came back in full colour, matched to the scene.

### What this means

Compare against the generated sources in Q1, where the blond man's face and the
curly-haired woman's face came back crisply the same across dozens of runs. That gap
is exactly the one the plan worried about, and it is real: the model reproduces its
own output far more faithfully than it reproduces a photograph.

So the honest framing for v0.19 is **composition and wardrobe transfer, not "put these
people in a scene."** Hand it three layers and it will build a coherent picture with
the right clothes, props, setting and lighting -- and faces that are plausible rather
than particular. Anyone expecting to place a specific person, a client, a family
member, themselves, will be disappointed, and the UI copy has to say so before they
find out the hard way.

This does not kill the feature. It does mean the subtitle cannot promise likeness.

## Q3 -- How sensitive is it to prompt phrasing?

**Answer: positional language is decorative. The model binds references by what they
are, not by their slot number.** This contradicts the plan document.

Same three references, same seed 777, only the wording changed:

| Variant | Prompt | Result |
| --- | --- | --- |
| A (control) | "the man from the **second** image ... the woman from the **third**" | correct |
| B | "A man is hugging a woman on the beach at sunset" -- **no positional language at all** | correct, identities intact |
| C | attribute-based: "the blond man in the light blue button-up ... the curly-haired woman in the racing jacket" | correct |
| D | positions **deliberately swapped**: "the man from the third image ... the woman from the second" | **still correct** -- no misassignment |
| E | "Use the **third** image as the background" (the third is the woman on a grey studio backdrop) | **still the beach** -- the grey backdrop was ignored |

D and E are the decisive ones. If slot binding were real, D would have produced a
scrambled result and E a grey studio background. Both came out matching the control.
The model type-matches: a man-shaped reference fills the man in the prompt.

Slot 1 is still special, but only mechanically -- `GetImageSize` on the first
reference drives `EmptyFlux2LatentImage`, so reference 1 sets the output canvas.

**For the UI:** the plan's requirement that *"the panel must number the reference slots
visibly and say so"* because *"the prompt refers to them positionally"* is not needed
for correctness. Numbering is fine as an affordance; it is not load-bearing. Artists
can write plain prose and it will work.

## Q4 -- Does a masked or cut-out reference beat a full photo?

**Answer: no, and the premise is false. Klein already isolates the subject.** This is
the biggest scope saving in the gate.

The worry was that a full photo drags its own background along. It does not. Same
seed, same other two references, three ways of handing over a man photographed in a
cluttered kitchen:

| Variant | Result |
| --- | --- |
| a. Full cluttered photo (control) | identity carried; **no kitchen anywhere**; background is the beach |
| b. Background removed (RMBG-1.4 cut-out on a white plate) | indistinguishable from (a) |
| c. Full photo + "take only the person, ignore its background entirely" | indistinguishable from (a) |

Checked at seeds 777 and 101. Not one run leaked a jar, the red kettle, a houseplant
or the tungsten cast. Cutting out is neither necessary nor harmful -- it simply makes
no difference.

**Partial extraction by prompt does work.** Asked for "the man from the second image
... wearing the racing jacket from the third image ... there is no woman in the
picture", the model produced exactly that: the blond man in the woman's jacket, alone.
A reference can contribute a garment without its wearer.

**For the UI:** v0.19 needs no cut-out, masking or region-scoping tooling. Artists can
hand over whole layers. That removes an entire subsystem from the plan.

---

## What this changes in the plan

- **Drop** visible slot numbering as a correctness requirement (Q3).
- **Drop** any masking / cut-out / region-scoping work (Q4).
- **Keep** reorder, but justify it by canvas size and object coherence (Q1), not by
  prompt binding.
- **Do not** cap the reference list at a fixed small number (Q1).
- **Rename and re-describe the feature** (Q2). "Multi-reference composition" is
  accurate; anything implying likeness is not. The tool composes a scene from several
  layers and carries wardrobe, props and setting -- it does not place a specific
  person. That belongs in the subtitle, not in a support thread six months from now.
- **Decide whether that is still the v0.19 headline.** The plan gated the UI work on
  this question, and the answer came back weaker than hoped. The feature is real and
  worth shipping, but it is a smaller claim than "the man from the second image."

## Side note for the setup docs

`ImageRemoveBackground+` and `RemBGSession+` (comfyui_essentials) are registered on
this instance but throw `ModuleNotFoundError: No module named 'rembg'`. The cut-out
above had to go through `easy imageRemBg` (RMBG-1.4) instead. Only relevant if a
future preset ever depends on the essentials background removers.

## Reproducing

Harness and all sources are in this session's scratchpad (`gate/mr.py`, `gate/q*.py`).
`mr.build(refs, prompt, seed=...)` builds the chained-`ReferenceLatent` graph for an
arbitrary list of references; `mr.run()` queues it and saves the output. Nothing
touches the ComfyUI queue beyond submitting its own jobs.
