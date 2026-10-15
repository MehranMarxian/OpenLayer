/**
 * Which WebSocket handshakes the hub accepts, judged by their `Origin` header.
 *
 * ## The hole this closes
 *
 * Browsers do not apply CORS to WebSockets, and the hub's loopback check passes
 * for any page open in the artist's own browser, because the browser itself is
 * local. So before this, any website could open `ws://127.0.0.1:8199`, say
 * `hello` as an agent and run every tool in the panel, or say `hello` as a
 * panel and push the real one off (codebase review finding 3).
 *
 * ## The rule
 *
 * A browser always sends `Origin` on a WebSocket handshake, and a page cannot
 * forge or remove it. The hub's real clients are not browsers:
 *
 * - the MCP agent (`main.mjs`, Node's `ws`) sends no `Origin`;
 * - the panel's socket comes from UXP inside Photoshop. What `Origin` UXP sends
 *   is not documented, which is why every handshake's `Origin` is logged and a
 *   refusal names it.
 *
 * So the hub refuses every origin a web page can produce: any `http:` or
 * `https:` origin (including pages served from localhost) and the opaque
 * `null` that sandboxed iframes and `file:` pages send. Everything else, and a
 * missing header, is allowed.
 *
 * This is the first half of roadmap item R2. The second half, a per-session
 * token, is what would also stop a local program that is not a browser.
 */

const WEB_SCHEMES = new Set(["http:", "https:"]);

/**
 * @param {string | undefined | null} origin the handshake's `Origin` header
 * @returns {{ allowed: true } | { allowed: false, reason: string }}
 */
export function judgeOrigin(origin) {
  if (origin === undefined || origin === null || origin === "") {
    return { allowed: true };
  }

  const value = String(origin).trim();

  if (value.toLowerCase() === "null") {
    return { allowed: false, reason: "an opaque (null) origin, which sandboxed web pages send" };
  }

  let scheme;

  try {
    scheme = new URL(value).protocol.toLowerCase();
  } catch {
    // Not a URL at all. No browser sends this, so it is not a web page.
    return { allowed: true };
  }

  if (WEB_SCHEMES.has(scheme)) {
    return { allowed: false, reason: `a web page (${value})` };
  }

  return { allowed: true };
}

/** For the log line: what a handshake presented, in a form that reads well. */
export function describeOrigin(origin) {
  return origin === undefined || origin === null || origin === "" ? "no Origin header" : `Origin ${origin}`;
}
