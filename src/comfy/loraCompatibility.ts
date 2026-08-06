import { WorkflowPresetDefinition } from "./types";

/**
 * A guess, from the filename alone, about whether a LoRA suits a preset.
 *
 * `unknown` is the honest majority case and must stay usable: the panel labels
 * it and lets the artist proceed.
 */
export type LoraFamilyHint = "matches" | "foreign" | "unknown";

/**
 * Tokens that name a model family in the wild. A filename containing one of
 * these for a family the preset does not use is very likely trained for
 * something else.
 *
 * This is filename matching, not detection. It exists because nothing better is
 * reachable: ComfyUI serves only a LoRA's name, size and timestamps
 * (`/models/loras` and `/experiment/models/loras` both stop there), so the
 * panel cannot inspect a file it is offering. The safetensors metadata that
 * would answer the question is not served, and is not trustworthy anyway --
 * measured on the reference machine, `illustration.safetensors` and
 * `meat_v1.safetensors` both declare `ss_base_model_version: sd_1.5` while
 * their tensor keys (`transformer.single_transformer_blocks.*`) are plainly
 * Flux. A filename says less but at least does not actively lie.
 */
const FOREIGN_FAMILY_TOKENS = [
  "flux",
  "sdxl",
  "sd15",
  "sd1.5",
  "sd_1.5",
  "z-image",
  "zimage",
  "z_image",
  "pony",
  "illustrious",
  "wan",
  "qwen",
  "hunyuan",
  "sd3"
] as const;

function normalize(loraName: string): string {
  return loraName.toLowerCase().replace(/\\/g, "/");
}

/**
 * What the filename suggests about this LoRA's fit for the preset.
 *
 * Deliberately asymmetric: it returns `matches` only on a positive token the
 * preset itself declares, and never infers a match from the absence of a
 * foreign token. Over-claiming a match is the one error that would actively
 * mislead, because a mismatched LoRA fails silently rather than erroring.
 */
export function getLoraFamilyHint(loraName: string, preset: WorkflowPresetDefinition): LoraFamilyHint {
  const matchTokens = preset.loraInsertion?.familyTokens ?? [];
  const normalized = normalize(loraName);

  if (matchTokens.some((token) => normalized.includes(token.toLowerCase()))) {
    return "matches";
  }

  const ownTokens = matchTokens.map((token) => token.toLowerCase());

  for (const token of FOREIGN_FAMILY_TOKENS) {
    // A token the preset claims as its own is never foreign, even if it also
    // appears in this list -- a Qwen-based preset would otherwise flag its own
    // LoRAs.
    if (ownTokens.includes(token)) {
      continue;
    }

    if (normalized.includes(token)) {
      return "foreign";
    }
  }

  return "unknown";
}

/** Short suffix for a dropdown entry. Empty when there is nothing useful to say. */
export function formatLoraHintSuffix(hint: LoraFamilyHint): string {
  if (hint === "matches") {
    return "  (name matches this model)";
  }

  if (hint === "foreign") {
    return "  (name suggests another model)";
  }

  return "";
}
