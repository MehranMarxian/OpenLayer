import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createAgentBridge } from "../../src/ui/agentBridge";
import { createAgentConnection, openWebSocket } from "../../src/ui/agentConnection";

/**
 * The real bridge process, driven over real MCP, talking to the real panel
 * modules over a real socket. Everything except Photoshop itself.
 *
 * Excluded from `npm test` (see `vitest.e2e.config.ts`) because it spawns a
 * process and binds a port, and the unit suite is 750 pure tests in three
 * seconds — worth keeping that way. Run it with `npm run test:e2e`.
 *
 * What it catches that nothing else does: the two protocol copies agreeing in
 * *practice* rather than in a parity test, the handshake actually announcing
 * the tools the panel registered, and a tool call travelling all the way from
 * an MCP client into `agentBridge.execute` and back with the panel's own status
 * text. The unit suites stub the socket on one side or the other; this stubs
 * neither.
 */

const PORT = 8499;
const bridgeDir = resolve(__dirname, "..", "..", "bridge");

let hub: ChildProcessWithoutNullStreams;
let child: ChildProcessWithoutNullStreams;
const responses = new Map<number, Record<string, unknown>>();
const stderr: string[] = [];
let corruptedStdout: string | null = null;

function send(message: Record<string, unknown>) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function waitFor(id: number, label: string) {
  await vi.waitFor(() => expect(responses.has(id), `no response to ${label}`).toBe(true), {
    timeout: 10_000,
    interval: 25
  });

  return responses.get(id) as Record<string, never>;
}

beforeAll(async () => {
  // Two processes, because their lifetimes differ: the hub owns the socket and
  // outlives every MCP session, and the MCP server is spawned by its client.
  hub = spawn(process.execPath, ["src/hub.mjs", "--port", String(PORT)], {
    cwd: bridgeDir,
    stdio: ["ignore", "pipe", "pipe"]
  }) as ChildProcessWithoutNullStreams;

  await new Promise((done) => setTimeout(done, 600));

  child = spawn(process.execPath, ["src/main.mjs", "--port", String(PORT)], {
    cwd: bridgeDir,
    stdio: ["pipe", "pipe", "pipe"]
  }) as ChildProcessWithoutNullStreams;

  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));

  let buffer = "";

  child.stdout.on("data", (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      try {
        const message = JSON.parse(line) as { id?: number };

        if (message.id !== undefined) {
          responses.set(message.id, message as Record<string, unknown>);
        }
      } catch {
        corruptedStdout ??= line;
      }
    }
  });

  await new Promise((done) => setTimeout(done, 800));

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "e2e", version: "0" }
    }
  });

  await waitFor(1, "initialize");
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
}, 30_000);

afterAll(() => {
  child?.kill();
  hub?.kill();
});

describe("agent bridge end to end", () => {
  it("carries a tool call from MCP into the panel's handler and back", async () => {
    const ran: { params: unknown }[] = [];
    const bridge = createAgentBridge();

    // The panel side, assembled from the real modules. Only the DOM is stubbed,
    // because there is no DOM in Photoshop's place here.
    const prompt = { value: "", dispatchEvent: () => true } as unknown as HTMLInputElement;
    const steps = { value: "20", dispatchEvent: () => true } as unknown as HTMLInputElement;

    bridge.register("text_to_image", {
      run: () => {
        ran.push({ params: { prompt: prompt.value, steps: steps.value } });
      },
      fields: { prompt, steps },
      statusText: { textContent: "Imported as new layer." } as unknown as HTMLElement,
      statusPill: { classList: { contains: () => false } } as unknown as HTMLElement
    });
    bridge.publishCapability("text_to_image", { canRun: true, reason: "" });

    const statuses: string[] = [];
    const connection = createAgentConnection({
      bridge,
      openSocket: openWebSocket,
      panelVersion: "0.15.0",
      onStatus: (status) => statuses.push(status.state),
      log: () => {}
    });

    connection.enable(PORT);

    await vi.waitFor(() => expect(statuses).toContain("connected"), { timeout: 10_000 });

    // The bridge should now know what this panel offers, from the real handshake.
    send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_panel_state" } });
    const state = await waitFor(2, "get_panel_state");
    const parsedState = JSON.parse(
      (state.result as { content: { text: string }[] }).content[0].text
    ) as { connected: boolean; panelVersion: string; tools: string[] };

    expect(parsedState.connected).toBe(true);
    expect(parsedState.panelVersion).toBe("0.15.0");
    expect(parsedState.tools).toEqual(["text_to_image"]);

    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "text_to_image", arguments: { prompt: "a cat on a bicycle", steps: 30 } }
    });

    const called = await waitFor(3, "text_to_image");

    // The values reached the panel's form fields, and the handler saw them.
    expect(ran).toHaveLength(1);
    expect(ran[0].params).toEqual({ prompt: "a cat on a bicycle", steps: "30" });

    // The panel's own status text came back to the MCP client.
    const content = (called.result as { content: { text: string }[]; isError?: boolean }).content;
    expect(content[0].text).toBe("Imported as new layer.");
    expect((called.result as { isError?: boolean }).isError).not.toBe(true);

    connection.disable();
  }, 30_000);

  it("refuses a command while the panel is busy, without running the handler", async () => {
    const bridge = createAgentBridge();
    const run = vi.fn();

    bridge.register("text_to_image", {
      run,
      fields: {},
      statusText: { textContent: "" } as unknown as HTMLElement
    });
    // What syncBusy publishes mid-generation. This is the A4 gate, and it is
    // the only thing between an agent command and a second concurrent pipeline.
    bridge.publishCapability("text_to_image", {
      canRun: false,
      reason: "OpenLayer is busy with text-to-image. Wait for it to finish."
    });

    const statuses: string[] = [];
    const connection = createAgentConnection({
      bridge,
      openSocket: openWebSocket,
      panelVersion: "0.15.0",
      onStatus: (status) => statuses.push(status.state),
      log: () => {}
    });

    connection.enable(PORT);
    await vi.waitFor(() => expect(statuses).toContain("connected"), { timeout: 10_000 });

    send({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "text_to_image", arguments: { prompt: "a cat" } }
    });

    const refused = await waitFor(4, "busy text_to_image");
    const result = refused.result as { content: { text: string }[]; isError?: boolean };

    expect(run).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("busy");
    expect(result.isError).toBe(true);

    connection.disable();
  }, 30_000);

  it("kept stdout clean, because stdout is the MCP transport", () => {
    expect(corruptedStdout).toBeNull();
  });

  it("fails fast against something that listens but is not a hub", async () => {
    // The exact shape of a real failure: a stale pre-split bridge was still
    // holding 8199. It accepted the connection, mistook the agent for a panel,
    // kicked the real Photoshop panel off, and then never replied — so the
    // client sat waiting on a ten-minute generation timeout with no clue why.
    // `ws` is a dependency of bridge/, not of the repo root, so it has to be
    // reached where it is actually installed.
    const wsModule = (await import(
      pathToFileURL(resolve(bridgeDir, "node_modules", "ws", "index.js")).href
    )) as { WebSocketServer?: typeof import("ws").WebSocketServer; default?: { Server: unknown } };
    const WebSocketServer = (wsModule.WebSocketServer ??
      wsModule.default?.Server) as typeof import("ws").WebSocketServer;

    const impostor = new WebSocketServer({ host: "127.0.0.1", port: 8599 });

    // Accepts connections, reads frames, answers nothing. Like the stale build.
    impostor.on("connection", () => {});

    const { createAgentClient } = await import("../../bridge/src/agentClient.mjs");
    const agent = createAgentClient({
      url: "ws://127.0.0.1:8599",
      client: "e2e",
      clientVersion: "0",
      log: () => {},
      connectTimeoutMs: 1500
    });

    try {
      await expect(
        agent.runTool({ tool: "text_to_image", params: { prompt: "a cat" } })
      ).rejects.toThrow(/did not answer as an OpenLayer hub/);
    } finally {
      agent.close();
      impostor.close();
    }
  }, 30_000);

  it("tells an agent how to start the hub when there is no hub", async () => {
    // The first-run experience, and the one that used to be a dead end: an MCP
    // client is registered, the hub was never started, and the error has to say
    // so rather than surfacing ECONNREFUSED.
    const orphan = spawn(process.execPath, ["src/main.mjs", "--port", "8598"], {
      cwd: bridgeDir,
      stdio: ["pipe", "pipe", "pipe"]
    }) as ChildProcessWithoutNullStreams;

    const seen = new Map<number, Record<string, unknown>>();
    let buffer = "";

    orphan.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          const message = JSON.parse(line) as { id?: number };

          if (message.id !== undefined) {
            seen.set(message.id, message as Record<string, unknown>);
          }
        } catch {
          // Covered by the stdout test above.
        }
      }
    });

    const write = (message: Record<string, unknown>) =>
      orphan.stdin.write(`${JSON.stringify(message)}\n`);

    try {
      await new Promise((done) => setTimeout(done, 800));

      write({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "e2e", version: "0" }
        }
      });

      await vi.waitFor(() => expect(seen.has(1)).toBe(true), { timeout: 10_000, interval: 25 });
      write({ jsonrpc: "2.0", method: "notifications/initialized" });

      write({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "text_to_image", arguments: { prompt: "a cat" } }
      });

      await vi.waitFor(() => expect(seen.has(2)).toBe(true), { timeout: 15_000, interval: 25 });

      const result = (seen.get(2) as { result: { content: { text: string }[]; isError?: boolean } })
        .result;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No OpenLayer hub is listening");
      expect(result.content[0].text).toContain("node bridge/src/hub.mjs");
    } finally {
      orphan.kill();
    }
  }, 30_000);
});
