/**
 * Camera angle choices for fal's Qwen-Image-Edit-2511 multiple-angles LoRA.
 *
 * The LoRA was trained on 96 fixed poses -- 8 directions around the subject,
 * 4 camera heights, 3 distances -- each named by an exact phrase, and it is
 * prompted as `<sks> [direction] [height] [distance]` in that order (the model
 * card: "Respect the order"). A free-text prompt box would invite wording the
 * LoRA never saw, so the panel offers the three lists and this module writes
 * the phrase. Labels are what the artist reads; phrases are what the LoRA reads.
 *
 * Source: https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA
 * (model card, read 2026-10-29).
 */

export type CameraAngleOption = Readonly<{ id: string; label: string; phrase: string }>;

export const CAMERA_DIRECTIONS: readonly CameraAngleOption[] = [
  { id: "front", label: "Front", phrase: "front view" },
  { id: "front-right", label: "Front right", phrase: "front-right quarter view" },
  { id: "right", label: "Right side", phrase: "right side view" },
  { id: "back-right", label: "Back right", phrase: "back-right quarter view" },
  { id: "back", label: "Back", phrase: "back view" },
  { id: "back-left", label: "Back left", phrase: "back-left quarter view" },
  { id: "left", label: "Left side", phrase: "left side view" },
  { id: "front-left", label: "Front left", phrase: "front-left quarter view" }
];

export const CAMERA_HEIGHTS: readonly CameraAngleOption[] = [
  { id: "low", label: "Low, looking up", phrase: "low-angle shot" },
  { id: "eye-level", label: "Eye level", phrase: "eye-level shot" },
  { id: "elevated", label: "Slightly above", phrase: "elevated shot" },
  { id: "high", label: "High, looking down", phrase: "high-angle shot" }
];

export const CAMERA_DISTANCES: readonly CameraAngleOption[] = [
  { id: "close-up", label: "Close-up", phrase: "close-up" },
  { id: "medium", label: "Medium", phrase: "medium shot" },
  { id: "wide", label: "Wide", phrase: "wide shot" }
];

export type CameraAngleChoice = Readonly<{ direction: string; height: string; distance: string }>;

/** The card's reference pose, and the panel's starting point. */
export const DEFAULT_CAMERA_ANGLE: CameraAngleChoice = { direction: "front-right", height: "eye-level", distance: "medium" };

const TRIGGER_WORD = "<sks>";

/**
 * The prompt for one pose. Throws on an unknown id rather than dropping it,
 * because a missing part still produces a valid-looking prompt that the LoRA
 * reads as a different pose.
 */
export function buildCameraAnglePrompt(choice: CameraAngleChoice): string {
  return [
    TRIGGER_WORD,
    findPhrase(CAMERA_DIRECTIONS, choice.direction, "direction"),
    findPhrase(CAMERA_HEIGHTS, choice.height, "camera height"),
    findPhrase(CAMERA_DISTANCES, choice.distance, "distance")
  ].join(" ");
}

function findPhrase(options: readonly CameraAngleOption[], id: string, what: string): string {
  const option = options.find((candidate) => candidate.id === id);

  if (!option) {
    throw new Error(`Unknown camera ${what}: ${id}.`);
  }

  return option.phrase;
}
