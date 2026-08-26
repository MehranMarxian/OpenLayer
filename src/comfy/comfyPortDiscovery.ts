import { COMFY_PORT_CANDIDATES } from "../ui/appConstants";

/**
 * Scans the currently-configured URL plus a fixed list of common local
 * ComfyUI ports and returns the first one that answers. Shared by the
 * Settings "Find ComfyUI Active Port" button and the first-run welcome
 * screen, which both need the identical scan rather than two ways to answer
 * the same question.
 */
export async function findActiveComfyUrl(
  currentUrl: string,
  onProgress: (message: string) => void
): Promise<string> {
  const candidates = buildComfyCandidateUrls(currentUrl);

  for (const candidate of candidates) {
    onProgress(`Checking ${candidate}...`);

    if (await isComfyServerOnline(candidate)) {
      return candidate;
    }
  }

  return "";
}

function buildComfyCandidateUrls(currentUrl: string) {
  const candidates = [
    normalizeCandidateUrl(currentUrl),
    ...COMFY_PORT_CANDIDATES.map((port) => `http://127.0.0.1:${port}`)
  ].filter(Boolean);

  return Array.from(new Set(candidates));
}

function normalizeCandidateUrl(url: string) {
  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

async function isComfyServerOnline(serverUrl: string) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = window.setTimeout(() => {
    controller?.abort();
  }, 1200);

  try {
    const requestOptions: RequestInit = controller ? { signal: controller.signal } : {};
    const response = await fetch(`${serverUrl}/system_stats`, requestOptions);
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
