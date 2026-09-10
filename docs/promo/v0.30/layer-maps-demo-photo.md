# Layer Maps demo photo — three candidates, ranked

**Do not download.** Links and the licence manifest only, per the brief. Mehran runs all three through
the three Layer Maps graphs on the local ComfyUI before recording, so we know the maps actually look
good before anyone's on camera.

Every candidate below was checked on **its own Wikimedia Commons file description page** (not a
search snippet) for licence, author, and upload date. All three are SFW with no identifiable people —
each is individually confirmed, not assumed from the thumbnail.

---

## 1st choice — terrace, umbrellas, mountains (best single photo for all three maps)

**File:** `GER Kochel am See, Schloss Aspenstein 008.jpg`
**Commons page:** https://commons.wikimedia.org/wiki/File:GER_Kochel_am_See,_Schloss_Aspenstein_008.jpg
**Direct original file:** https://upload.wikimedia.org/wikipedia/commons/0/07/GER_Kochel_am_See%2C_Schloss_Aspenstein_008.jpg
**Author:** `-wuppertaler` (own work)
**Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0)
**Attribution line to use:** `-wuppertaler, CC BY 4.0 <https://creativecommons.org/licenses/by/4.0>, via Wikimedia Commons`
**Size:** 4,032 × 3,024 px (iPhone 11, Sept 2022)
**Commons categories include:** "Empty seats in Germany" — confirms no people, independently of my
own look at the image.

**Why it's the pick:** this is close to the brief's own example almost exactly — a terrace with
wicker chairs and steel tables in the foreground, two closed blue umbrellas and trees at mid distance,
and a hazy mountain range fading into cloud at the far distance. That haze gradient is a genuine
atmospheric depth cue, which is exactly the kind of thing a depth estimator reads well — this is the
strongest near/mid/far separation of the three candidates. The umbrella canopies and wicker chair
weave give the normal-map pass real curved surfaces to work with, and the paving-stone pattern plus
furniture edges give the line-art pass clear, readable contours without being so busy it reads as
noise on video. Largest file of the three, landscape orientation, easy 16:9 crop for a screen
recording.

**Watch for:** overcast/grey sky — fine for depth and normals, but line art on the sky itself will be
close to blank (nothing to trace up there), which is correct behaviour, not a bug, but worth a caption
saying so if it looks odd on camera.

---

## 2nd choice — Old Town alley, Stockholm

**File:** `Alley in Old Town Stockholm.jpg`
**Commons page:** https://commons.wikimedia.org/wiki/File:Alley_in_Old_Town_Stockholm.jpg
**Direct original file:** https://upload.wikimedia.org/wikipedia/commons/b/b3/Alley_in_Old_Town_Stockholm.jpg
**Author:** Bengt Nyman (uploaded from Flickr via Flickr upload bot, confirmed licence on upload)
**Licence:** Creative Commons Attribution 2.0 Generic (CC BY 2.0)
**Attribution line to use:** `Bengt Nyman, CC BY 2.0 <https://creativecommons.org/licenses/by/2.0>, via Wikimedia Commons`
**Size:** 3,744 × 5,616 px (Canon EOS 5D Mark II, March 2009)

**Why it's a strong second:** exactly the "old-town alley" example from the brief. A curving,
converging cobblestone alley between two close building walls is the single strongest depth signal of
any of the three candidates — the estimator has an unambiguous near-to-far gradient with nothing
ambiguous in it. The cobblestones, the gutter line down the middle, and the brick and stone wall
edges all give the line-art pass strong, clean contours. No people anywhere in frame.

**Watch for:** it's the weakest of the three for the **normal** map — the walls are largely flat
stone, so the normal pass will read as mostly uniform blue-violet with detail concentrated in the
cobblestones underfoot, which is real and correct but a less visually interesting normal-map moment
than candidate 1 or 3. Also portrait orientation (taller than wide) — fine for a still, needs a crop
decision for 16:9 video.

---

## 3rd choice — Bar Campo de Fiori, Rome

**File:** `Roma Campo de Fiori BW 2.JPG`
**Commons page:** https://commons.wikimedia.org/wiki/File:Roma_Campo_de_Fiori_BW_2.JPG
**Direct original file:** https://upload.wikimedia.org/wikipedia/commons/b/bb/Roma_Campo_de_Fiori_BW_2.JPG
**Author:** Berthold Werner (own work, self-dedicated)
**Licence:** Public domain (author's own dedication, confirmed on the file's licensing section)
**Size:** 2,304 × 1,536 px (Kodak DX6490, May 2007)

**Why it's a solid third, not first:** the richest surface variety of the three for the **normal**
map — cascading bougainvillea, a wooden handcart, wrought-iron door hardware, and window shutters all
give genuinely curved, varied surfaces in one frame, more than either terrace or alley alone. Depth
range is real but shallower (cart in the near-foreground, doors at mid distance, upper-storey windows
far) — a noticeable but less dramatic gradient than the mountain haze or the converging alley. Line
art gets strong contours from the ironwork, shutters and flower clusters.

**Watch for:** there's a partial, blurred figure-shaped shadow/reflection visible in the glass door on
the left edge of frame (in a shop window under an awning, in shadow) — it reads as a reflection or
motion blur rather than a posed photograph of a person, but it's worth Mehran's own eyes on the full
2,304×1,536 original before treating this one as clean. Also the smallest file of the three (still
comfortably over the 2,000px-long-edge floor, but least headroom for cropping).

---

## Labelled fallback (not CC — mentioned only because the brief allows it as a fallback)

If none of the three above look right once run through the actual Layer Maps graphs, Unsplash's own
"Terrace Cafe" and "Empty Cafe" collections (`unsplash.com/s/photos/terrace-cafe`,
`unsplash.com/s/photos/empty-cafe`) have candidates with a similar look to choice 1. **These are under
the Unsplash License, not a Creative Commons licence** — free to use, no CC share-alike or attribution
requirement, but it is not CC0 and not interchangeable with the Commons candidates above for any use
where CC provenance specifically matters. I did not pick a specific file from there; if it comes to
that, verify the individual photo's licence badge on its own Unsplash page before using it, the same
way each Commons candidate was verified above.

## What I did not do

I did not download or locally process any of these three images — per the brief, this file is links
and a licence manifest only. Running them through the depth/line-art/normal graphs and judging the
actual output is the next step, on Mehran's local ComfyUI.

## Tested on the real Layer Maps graphs (2026-09-10)

All three candidates were run through the three shipped graphs on the local ComfyUI, exactly as the
panel builds them (Base depth model, detail clamped to 1536, output pinned to source size). Licences
re-checked against the Commons API; all match the file pages above. None of the depth maps came back
washed out.

| Photo | Depth spread (p99 − p1) | Line art | Verdict |
| :--- | ---: | ---: | :--- |
| **Kochel terrace** | 159 | 71% white | **Use this.** Clear near/mid/far layers (furniture, umbrellas and trees, mountains), so the depth and Lens Blur beats both land. Excellent line art, clean normals. Landscape, so it fits 16:9. |
| Stockholm alley | 143 | 91% white | Strong receding depth, but portrait (wrong for 16:9) and the line art is sparse. A vertical-video fallback. |
| Campo de' Fiori | 173 | 83% white | The most beautiful line art and normals, but the depth is a flat facade, so the headline beat is weak. Highest spread, yet the flattest-looking depth: the number catches washed-out maps, not a lack of layers. |

**Direct original files:**

- Kochel: https://upload.wikimedia.org/wikipedia/commons/0/07/GER_Kochel_am_See%2C_Schloss_Aspenstein_008.jpg
- Stockholm: https://upload.wikimedia.org/wikipedia/commons/b/b3/Alley_in_Old_Town_Stockholm.jpg
- Campo de' Fiori: https://upload.wikimedia.org/wikipedia/commons/b/bb/Roma_Campo_de_Fiori_BW_2.JPG

**Attribution line for the Kochel photo.** CC BY 4.0 requires saying that changes were made, and the
maps are derivatives, so the "maps derived" clause is not optional:

> Photo: "GER Kochel am See, Schloss Aspenstein 008" by -wuppertaler, CC BY 4.0
> (https://creativecommons.org/licenses/by/4.0/), via Wikimedia Commons. Depth, line-art and normal
> maps derived with OpenLayer.
