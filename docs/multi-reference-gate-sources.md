# Gate Test Sources and Attribution

Provenance for the images used in
[`multi-reference-gate-findings.md`](multi-reference-gate-findings.md).

None of these files are committed to this repository. They lived in a session
scratchpad for the duration of the test and are recorded here so the run can be
repeated and the licences are on the record.

## Q2 -- real photographs

Downloaded from Wikimedia Commons on 2026-08-27 for the real-photograph identity
test. Two are modern CC0 photographs; two are archival photographic portraits from
the Wellcome Collection under CC BY 4.0.

| Tag | Commons file | Licence | Credit |
| --- | --- | --- | --- |
| R1 | `Always smile (Unsplash).jpg` | CC0 | michael (via Unsplash) |
| R2 | `Karen Elder (Unsplash).jpg` | CC0 | "Capturing the human heart." (via Unsplash) |
| R3 | `William Gordon. Photograph by Heath & Bradnee Ltd. Wellcome V0026455.jpg` | CC BY 4.0 | Wellcome Collection |
| R4 | `A bearded elderly man, carrying a prayer wheel and a rosary, Wellcome V0048576.jpg` | CC BY 4.0 | Wellcome Collection |

A fifth and sixth candidate (`Man's face with a flower`, CC0, and
`Charles Cyril Okell. Photograph.`, CC BY 4.0) were downloaded but not used --
the first is a stylised half-obscured face, unsuitable for scoring likeness.

Scenarios were deliberately kept neutral -- a person standing in a place -- so that
nothing was fabricated about any real person's relationships or conduct. The results
are of limited concern in that respect anyway: the finding is precisely that the
generated faces are *not* the faces of the people photographed.

**If the findings report is shared, note that it embeds these third-party images.**
CC BY 4.0 requires attribution, which this file supplies.

## Q1, Q3, Q4 -- generated sources

Everything else was generated locally with the same FLUX.2 Klein stack and carries no
third-party rights: the beach background, the man in the light blue button-up, the
woman in the racing jacket, the golden retriever, the red bicycle, the straw sunhat,
and the cluttered-kitchen candid used for the masking test.

The bicycle is worth keeping for regression testing -- it is the one subject that
reliably breaks composition (see Q1).
