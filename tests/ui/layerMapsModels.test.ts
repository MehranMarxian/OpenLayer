import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEPTH_MAP_MODEL,
  FALLBACK_DEPTH_MAP_MODELS,
  UNAVAILABLE_DEPTH_MAP_MODELS
} from "../../src/ui/appConstants";

/**
 * Depth Anything V2 ships four sizes in `DepthAnythingV2Preprocessor`'s
 * `ckpt_name` enum and only three of them can be downloaded.
 *
 * Giant was announced and never released. The node fetches it from
 * `depth-anything/Depth-Anything-V2-Giant`, which answers 401 where Small, Base
 * and Large answer 200, so choosing it queues a run that dies in the preprocessor
 * with a RepositoryNotFoundError. v0.30.0 shipped it in the picker for exactly
 * one Photoshop session before that happened for real.
 *
 * The panel therefore filters it out of both the offline fallback list and the
 * live list read from `/object_info`. These assertions exist so a future edit
 * cannot quietly put an unobtainable model back in front of an artist.
 */
describe("Layer Maps depth model list", () => {
  it("offers no model that cannot be downloaded", () => {
    for (const unavailable of UNAVAILABLE_DEPTH_MAP_MODELS) {
      expect(
        FALLBACK_DEPTH_MAP_MODELS,
        `${unavailable} cannot be downloaded and must not be offered`
      ).not.toContain(unavailable);
    }
  });

  it("names Giant specifically, since that is the one the node advertises", () => {
    expect(UNAVAILABLE_DEPTH_MAP_MODELS).toContain("depth_anything_v2_vitg.pth");
  });

  it("defaults to a model it actually offers", () => {
    expect(FALLBACK_DEPTH_MAP_MODELS).toContain(DEFAULT_DEPTH_MAP_MODEL);
  });

  it("keeps Base as the default rather than Large", () => {
    // Two independent reasons, both recorded in appConstants: Large collapsed a
    // wide landscape into an unreadable near-white band, and Large is the one
    // downloadable size under a non-commercial licence.
    expect(DEFAULT_DEPTH_MAP_MODEL).toBe("depth_anything_v2_vitb.pth");
  });
});
