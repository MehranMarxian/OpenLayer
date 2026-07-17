import { ComfyClient } from "../comfy/comfyClient";
import {
  buildLcmLiveWorkflow,
  clampLiveDenoise,
  findLcmLoraName,
  LIVE_PAINTING_SAVE_NODE_ID
} from "../comfy/livePainting";
import { captureCanvasForLivePainting } from "../photoshop/livePaintingCapture";
import type { PhotoshopDocumentIdentity } from "../photoshop/documentContext";
import { createOpenLayerError, getErrorMessage } from "../utils/errors";

export type LivePaintingCallbacks = {
  onStatus: (message: string) => void;
  onTimings: (message: string) => void;
  onPreviewBlob: (blob: Blob, originatingDocument: PhotoshopDocumentIdentity) => void;
  onStopped: (reason: string) => void;
};

export type LivePaintingOptions = {
  serverUrl: string;
  checkpointName: string;
  prompt: string;
  denoise: number;
  maxDimension?: number;
};

// Candidate Photoshop notification events for stroke detection. Part of the
// spike is discovering which of these this host actually delivers, so every
// arrival is reported through onStatus with its event name.
const STROKE_EVENT_CANDIDATES = ["historyStateChanged", "paint", "set", "move", "toolModalStateChanged"];

type PhotoshopActionModule = {
  addNotificationListener: (
    events: readonly string[] | readonly { event: string }[],
    handler: (eventName: string, descriptor: unknown) => void
  ) => Promise<void> | void;
  removeNotificationListener: (
    events: readonly string[] | readonly { event: string }[],
    handler: (eventName: string, descriptor: unknown) => void
  ) => Promise<void> | void;
};

export class LivePaintingSession {
  private readonly client: ComfyClient;
  private readonly options: LivePaintingOptions;
  private readonly callbacks: LivePaintingCallbacks;
  private readonly seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  private readonly notificationHandler = (eventName: string) => {
    this.handleStrokeEvent(eventName);
  };

  private loraName = "";
  private registeredEvents: string[] = [];
  private running = false;
  private generating = false;
  private dirty = false;
  private cycles = 0;
  private lastEventAt = 0;

  constructor(options: LivePaintingOptions, callbacks: LivePaintingCallbacks) {
    this.options = options;
    this.callbacks = callbacks;
    this.client = new ComfyClient(options.serverUrl);
  }

  isRunning() {
    return this.running;
  }

  async start() {
    this.callbacks.onStatus("Checking ComfyUI and the LCM LoRA...");
    await this.client.checkOnline();

    const loraNames = await this.client.getLoraNames();
    const lcmLoraName = findLcmLoraName(loraNames);

    if (!lcmLoraName) {
      throw createOpenLayerError(
        "COMFY_SETUP_MISSING",
        "Live Painting needs an SD 1.5 LCM LoRA in ComfyUI.",
        "Install lcm-lora-sdv1-5 (pytorch_lora_weights.safetensors) in ComfyUI models/loras, then start the session again."
      );
    }

    this.loraName = lcmLoraName;
    this.running = true;
    await this.registerStrokeListeners();

    if (this.registeredEvents.length === 0) {
      this.running = false;
      throw createOpenLayerError(
        "PHOTOSHOP_EXPORT_FAILED",
        "Photoshop did not accept any Live Painting stroke listeners.",
        `Tried notification events: ${STROKE_EVENT_CANDIDATES.join(", ")}.`
      );
    }

    this.callbacks.onStatus(
      `Live session started with ${this.loraName}. Listening for: ${this.registeredEvents.join(", ")}. Paint a stroke...`
    );
    this.markDirty("session-start");
  }

  stop(reason = "Live session stopped.") {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.removeStrokeListeners();
    this.callbacks.onStopped(reason);
  }

  private handleStrokeEvent(eventName: string) {
    if (!this.running) {
      return;
    }

    const now = Date.now();
    const sinceLast = this.lastEventAt ? now - this.lastEventAt : 0;
    this.lastEventAt = now;
    this.callbacks.onStatus(
      `Photoshop event "${eventName}"${sinceLast ? ` (+${sinceLast}ms)` : ""} — syncing...`
    );
    this.markDirty(eventName);
  }

  private markDirty(_source: string) {
    if (!this.running) {
      return;
    }

    this.dirty = true;
    void this.pump();
  }

  private async pump() {
    if (this.generating || !this.dirty || !this.running) {
      return;
    }

    this.generating = true;
    this.dirty = false;

    try {
      await this.runCycle();
    } catch (caughtError) {
      this.callbacks.onStatus(`Live cycle failed: ${getErrorMessage(caughtError)}`);
    }

    this.generating = false;

    if (this.running && this.dirty) {
      void this.pump();
    }
  }

  private async runCycle() {
    const cycleStart = Date.now();
    const capture = await captureCanvasForLivePainting(this.options.maxDimension ?? 512);
    const capturedAt = Date.now();

    if (!this.running) {
      return;
    }

    const sourceImageName = await this.client.uploadImage(capture.blob, `openlayer-live-${this.seed}.png`);
    const uploadedAt = Date.now();

    const workflow = buildLcmLiveWorkflow({
      checkpointName: this.options.checkpointName,
      loraName: this.loraName,
      prompt: this.options.prompt,
      sourceImageName,
      seed: this.seed,
      denoise: clampLiveDenoise(this.options.denoise)
    });

    const promptId = await this.client.submitPrompt(workflow);
    const history = await this.client.pollUntilComplete(promptId, {
      intervalMs: 250,
      timeoutMs: 120000,
      isCancelled: () => !this.running
    });
    const result = await this.client.retrieveFirstOutputImage(promptId, history, {
      preferredNodeId: LIVE_PAINTING_SAVE_NODE_ID
    });
    const finishedAt = Date.now();

    if (!this.running) {
      return;
    }

    this.cycles += 1;
    this.callbacks.onPreviewBlob(result.blob, capture.originatingDocument);
    this.callbacks.onStatus(`Live preview updated (cycle ${this.cycles}).`);
    this.callbacks.onTimings(
      [
        `Cycle ${this.cycles}:`,
        `capture ${capturedAt - cycleStart}ms (${capture.mode}, ${capture.width}x${capture.height})`,
        `upload ${uploadedAt - capturedAt}ms`,
        `generate ${finishedAt - uploadedAt}ms`,
        `total ${((finishedAt - cycleStart) / 1000).toFixed(2)}s`
      ].join(" | ")
    );
  }

  private async registerStrokeListeners() {
    const action = this.getActionModule();

    for (const eventName of STROKE_EVENT_CANDIDATES) {
      try {
        await action.addNotificationListener([eventName], this.notificationHandler);
        this.registeredEvents.push(eventName);
      } catch {
        try {
          await action.addNotificationListener([{ event: eventName }], this.notificationHandler);
          this.registeredEvents.push(eventName);
        } catch {
          // Spike telemetry: unsupported events are simply not registered.
        }
      }
    }
  }

  private removeStrokeListeners() {
    const action = this.getActionModule();

    for (const eventName of this.registeredEvents) {
      try {
        void action.removeNotificationListener([eventName], this.notificationHandler);
      } catch {
        try {
          void action.removeNotificationListener([{ event: eventName }], this.notificationHandler);
        } catch {
          // Listener cleanup is best-effort during the spike.
        }
      }
    }

    this.registeredEvents = [];
  }

  private getActionModule(): PhotoshopActionModule {
    return (require("photoshop") as { action: PhotoshopActionModule }).action;
  }
}
