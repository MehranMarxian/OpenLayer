import {
  CAMERA_DIRECTIONS,
  CAMERA_DISTANCES,
  CAMERA_HEIGHTS,
  DEFAULT_CAMERA_ANGLE,
  type CameraAngleChoice,
  type CameraAngleOption
} from "../../comfy/cameraAngle";

/**
 * Camera Angle: the decisions that do not need Photoshop or ComfyUI.
 *
 * The tool sends a captured layer and one of the angles LoRA's 96 trained
 * poses to Qwen-Image-Edit 2511 and imports the re-shot picture as a new layer.
 * The pose phrase itself is written by comfy/cameraAngle.ts; this module turns
 * the three dropdowns into a choice and says what was asked for in words an
 * artist reads. Those words go through textContent, so they are plain text.
 *
 * Measured 2026-11-04 on a 4070 Ti (12 GB): 34 s for the first run, 20-22 s
 * after it, every one of seven poses honoured. The whole picture is redrawn
 * from the new position, background included, and faces come back softer and
 * less exact than the photograph. The hint says so; nothing here may promise
 * that a person keeps their likeness.
 */

/** The three dropdowns' raw values. An unknown id falls back to the default pose part. */
export function readCameraAngleChoice(values: { direction: string; height: string; distance: string }): CameraAngleChoice {
  return {
    direction: knownId(CAMERA_DIRECTIONS, values.direction, DEFAULT_CAMERA_ANGLE.direction),
    height: knownId(CAMERA_HEIGHTS, values.height, DEFAULT_CAMERA_ANGLE.height),
    distance: knownId(CAMERA_DISTANCES, values.distance, DEFAULT_CAMERA_ANGLE.distance)
  };
}

/**
 * "Front right / Eye level / Medium". Slashes rather than commas because one
 * height label ("Low, looking up") already contains a comma.
 */
export function describeCameraAngle(choice: CameraAngleChoice): string {
  return [
    labelFor(CAMERA_DIRECTIONS, choice.direction),
    labelFor(CAMERA_HEIGHTS, choice.height),
    labelFor(CAMERA_DISTANCES, choice.distance)
  ].join(" / ");
}

export function createCameraAngleOptionsMarkup(options: readonly CameraAngleOption[], selectedId: string): string {
  return options
    .map((option) => `<option value="${option.id}"${option.id === selectedId ? " selected" : ""}>${option.label}</option>`)
    .join("");
}

function knownId(options: readonly CameraAngleOption[], id: string, fallback: string): string {
  return options.some((option) => option.id === id) ? id : fallback;
}

function labelFor(options: readonly CameraAngleOption[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}
