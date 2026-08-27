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

**Answer: not established. This is the one gate question still open.**

Every source used here was model-generated, so the result carries the same caveat the
plan raised: the model may simply find its own output easy to reproduce.

The closest available proxy did pass. A deliberately "candid" source -- a bearded man
in a mustard sweater in a cluttered kitchen, tungsten-lit, non-studio framing --
carried face, beard and knitwear texture intact onto the beach at two seeds. That is
evidence that identity survives messy, uncontrolled source conditions, which is the
hard part of real-photo transfer. It is **not** evidence that it survives a real
camera's noise, optics and a real person's face.

Answering this properly needs actual photographs. Two ways to get them, both needing
your call:

- Photographs you own or have rights to (the most representative test -- real people
  you can judge the likeness of).
- Public-domain / CC portraits from Wikimedia Commons, which means downloading files;
  worth doing only if you would rather not use personal photos.

Until this is answered the feature's value is unproven, exactly as the plan said.

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
- **Still open:** real-photograph identity (Q2) -- the plan's own gate on whether this
  is a fun tool or a useful one.

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
