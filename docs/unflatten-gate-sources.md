# Unflatten Gate: Sources and Attribution

Provenance for the images used in
[`unflatten-gate-findings.md`](unflatten-gate-findings.md).

None of these files are committed to this repository. They live in `output/gate-sources/`,
which is gitignored, and are recorded here so the runs can be repeated and the licences are
on the record.

## Photographs

Downloaded from Wikimedia Commons on 2026-08-30. **All four are CC0** (Creative Commons
Zero, public domain dedication) and all four report `AttributionRequired: false`. Credit is
recorded anyway, because the findings report is public and reproducing a study is easier
when the sources are named.

| Tag | Commons file | Licence | Credit | Archetype |
| --- | --- | --- | --- | --- |
| P1 | `Domestic shorthair cat portrait in grass.jpg` | CC0 | via pixnio.com | Clean separation |
| P2 | `Hooded man on bench (Unsplash).jpg` | CC0 | James Sutton (via Unsplash) | Contact and occlusion |
| P3 | `Soft Curls (Unsplash).jpg` | CC0 | Roksolana Zasiadko (via Unsplash) | Fine matte |
| P4 | `Street Craftsman in Olinda.jpg` | CC0 | Wilfredor, own work | Monochrome, adversarial |

Working copies are the 2400px-wide Commons renderings rather than the originals. The graph
scales every input to 640px on the long side anyway, so the originals add download weight
and nothing else.

### Why these four

- **P1** was chosen as the easy case -- a single subject, a uniform out-of-focus
  background, sharp and well lit -- on the reasoning that if a photograph fell apart here,
  Q1 was a flat no. **That reasoning was wrong, and usefully so.** P1 is a frame-filling
  close-up, and close-ups are the one composition this model cannot separate at all,
  photographed or generated. It ended up being the case that identified the real variable
  rather than the easy case it was picked to be.
- **P2** is a person seated on a bench, occluding the bench, with a hard cast shadow, a
  puddle, and a bin as a second mid-ground object. The bench slats visible past the
  subject's legs are the hard part. It is also the Q4 crop source.
- **P3** is loose wavy hair with flyaway strands against a soft grey background, chosen to
  re-test the spike's "alpha edge on hair held" claim. It is also a frame-filling close-up,
  so it failed the same way P1 did and the hair matte was never exercised. The claim still
  stands from the spike's own run, which was on a photograph -- correcting the plan, which
  records that source as a generation.
- **P4** is monochrome and heavily occluded -- a man seated on the ground surrounded by
  tools. It tests two things at once: whether the model silently colourises a monochrome
  source, which v0.19 found the Klein family does, and whether heavy occlusion survives.
  The answers were no and yes respectively.

### Q4 crop series

One photograph at three subject fractions, so occlusion fraction is the only variable.
Derived from P2, measured by subject bounding-box area against frame area:

| File | Size | Subject |
| --- | --- | --- |
| `P2-crop-small.jpg` | 3840 x 2560 | 9.2% of frame |
| `P2-crop-medium.jpg` | 1536 x 1485 | 39.6% of frame |
| `P2-crop-large.jpg` | 1152 x 1152 | 68.1% of frame |

The medium crop is the one that doubles as P2's Q1 run.

## Generated counterparts

G1, G2 and G3 are generated locally with Krea-2 Turbo and carry no third-party rights.
Each is matched in composition to its photograph so that **provenance is the only variable
that differs within a pair** -- the plan's original "three photographs against three
generated images of comparable content" would have varied provenance and compositional
separability together, and reported clutter as provenance.

Generated 2026-08-30 at the shipped Krea-2 Turbo defaults (8 steps, CFG 1, euler/simple),
1024 x 680, seed 777. Prompts:

- **G1-cat-closeup** (matched to P1): *close-up portrait of a grey domestic shorthair cat lying in green
  grass, head turned toward the camera, green eyes, long pale whiskers catching the light,
  shallow depth of field, warm low evening sunlight, photographic*
- **G2-bench-contained** (matched to P2): *high angle view of a person in a hooded jacket sitting sideways on
  a wooden park bench at night, looking down at a glowing phone, wet paving stones, a long
  shadow cast across the ground, sodium street lighting, photographic*
- **G3** (matched to P3, not generated -- Q1 was answered before it was needed): *close-up portrait of a young woman with long wavy light brown
  hair, loose flyaway strands lit from behind, soft out-of-focus grey background, shallow
  depth of field, natural window light, photographic*

P4 has no generated counterpart. It is unpaired and adversarial by design.

## A source that was rejected

The two runs behind Q8 used a watermarked commercial stock photograph. Their numbers are
reported in the findings because the result is structural -- output count, ordering and the
compositing identity hold regardless of subject -- but the imagery is not reproduced, and
those runs do not count toward Q1. Every run from R1 onward uses the sources above.
