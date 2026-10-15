import type { SetupRequirementsReport } from "../comfy/setupRequirements";

/**
 * Whether a Setup check should refill the tools' model dropdowns.
 *
 * The dropdowns are filled when the panel loads and when Check ComfyUI is
 * pressed. A Setup check only read the inventory for its own list, so a model
 * that arrived through the Start here card or a row's Download showed as
 * installed on Setup while Text to Image still offered the fallback list from
 * before it existed, and the first Generate asked for a model ComfyUI did not
 * have. Found in the timed fresh-install walkthrough, 2026-10-16.
 *
 * True when the new report was really checked and either there was no checked
 * report before it (the panel may have loaded while ComfyUI was down, leaving
 * the fallback list) or the set of installed models differs. An unchanged
 * re-check leaves the dropdowns alone and costs no extra requests.
 */
export function shouldRefreshToolModels(
  previous: SetupRequirementsReport | null,
  next: SetupRequirementsReport
): boolean {
  if (!next.checked) {
    return false;
  }

  if (!previous?.checked) {
    return true;
  }

  const before = installedModelKeys(previous);
  const after = installedModelKeys(next);

  return before.size !== after.size || [...after].some((key) => !before.has(key));
}

function installedModelKeys(report: SetupRequirementsReport): Set<string> {
  return new Set(report.models.filter((model) => model.status === "installed").map((model) => model.key));
}
