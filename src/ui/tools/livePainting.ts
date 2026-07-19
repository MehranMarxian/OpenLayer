import {
  buildKrea2RefineWorkflow,
  buildLcmLiveWorkflow,
  clampLiveDenoise,
  clampRefineDenoise,
  findKrea2RefineGap,
  findLcmLoraName,
  LIVE_PAINTING_SAVE_NODE_ID,
  LIVE_REFINE_SAVE_NODE_ID
} from "../../comfy/livePainting";
import type { ComfyHistoryItem, ComfyModelInventory, ComfyWorkflow } from "../../comfy/types";
import type { PhotoshopDocumentIdentity } from "../../photoshop/documentContext";
import type { LiveCaptureResult } from "../../photoshop/livePaintingCapture";
import { createOpenLayerError, getErrorMessage } from "../../utils/errors";

export type LivePaintingState =
  | "idle"
  | "listening"
  | "pending"
  | "refining"
  | "refined"
  | "stopped";

export type LivePaintingV2Callbacks = {
  onStatus: (message: string) => void;
  onTimings: (message: string) => void;
  onPreviewBlob: (blob: Blob, originatingDocument: PhotoshopDocumentIdentity) => void;
  onRefineResult: (blob: Blob, originatingDocument: PhotoshopDocumentIdentity) => void;
  onStateChanged: (state: LivePaintingState) => void;
  onStopped: (reason: string) => void;
};

export type LivePaintingV2Options = {
  checkpointName: string;
  prompt: string;
  denoise: number;
  maxDimension?: number;
  autoRefineOnPause?: boolean;
  pauseSeconds?: number;
  refineMaxDimension?: number;
  refineDenoise?: number;
};

export type LivePaintingClient = {
  checkOnline: () => Promise<void>;
  getLoraNames: () => Promise<string[]>;
  getModelInventory: () => Promise<ComfyModelInventory>;
  uploadImage: (blob: Blob, fileName?: string) => Promise<string>;
  submitPrompt: (workflow: ComfyWorkflow) => Promise<string>;
  pollUntilComplete: (
    promptId: string,
    options: {
      intervalMs?: number;
      timeoutMs?: number;
      isCancelled?: () => boolean;
    }
  ) => Promise<ComfyHistoryItem>;
  retrieveFirstOutputImage: (
    promptId: string,
    history: ComfyHistoryItem,
    options: { preferredNodeId?: string }
  ) => Promise<{ blob: Blob }>;
  cancelPrompt: (promptId?: string) => Promise<unknown>;
};

export type PhotoshopActionModule = {
  addNotificationListener: (
    events: readonly string[] | readonly { event: string }[],
    handler: (eventName: string, descriptor: unknown) => void
  ) => Promise<void> | void;
  removeNotificationListener: (
    events: readonly string[] | readonly { event: string }[],
    handler: (eventName: string, descriptor: unknown) => void
  ) => Promise<void> | void;
};

export type LivePaintingTimers = {
  setTimeout: (handler: () => void, delayMs: number) => unknown;
  clearTimeout: (timer: unknown) => void;
};

export type LivePaintingV2Dependencies = {
  client: LivePaintingClient;
  capture: (maxDimension: number) => Promise<LiveCaptureResult>;
  actionModule?: PhotoshopActionModule;
  timers?: LivePaintingTimers;
};

const STROKE_EVENT_CANDIDATES = [
  "historyStateChanged",
  "paint",
  "set",
  "move",
  "toolModalStateChanged"
];

const MAX_CONSECUTIVE_FAILURES = 3;

type JobKind = "live" | "refine";

export class LivePaintingSessionV2 {
  private readonly options: LivePaintingV2Options;
  private readonly callbacks: LivePaintingV2Callbacks;
  private readonly client: LivePaintingClient;
  private readonly capture: (maxDimension: number) => Promise<LiveCaptureResult>;
  private readonly actionModule: PhotoshopActionModule;
  private readonly timers: LivePaintingTimers;
  private readonly seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  private readonly cancelledPromptIds = new Set<string>();
  private readonly notificationHandler = (eventName: string) => {
    this.handleStrokeEvent(eventName);
  };

  private state: LivePaintingState = "idle";
  private loraName = "";
  private refineGap: string | null = null;
  private registeredEvents: string[] = [];
  private dirty = false;
  private activeJob: JobKind | null = null;
  private refineRequested = false;
  private refineGeneration = 0;
  private liveCycles = 0;
  private refineCycles = 0;
  private consecutiveFailures = 0;
  private lastEventAt = 0;
  private currentPromptId: string | null = null;
  private pauseTimer: unknown = null;

  constructor(
    options: LivePaintingV2Options,
    callbacks: LivePaintingV2Callbacks,
    dependencies: LivePaintingV2Dependencies
  ) {
    this.options = options;
    this.callbacks = callbacks;
    this.client = dependencies.client;
    this.capture = dependencies.capture;
    this.actionModule = dependencies.actionModule
      ?? (require("photoshop") as { action: PhotoshopActionModule }).action;
    this.timers = dependencies.timers ?? {
      setTimeout: (handler, delayMs) => window.setTimeout(handler, delayMs),
      clearTimeout: (timer) => window.clearTimeout(timer as number)
    };
  }

  getState() {
    return this.state;
  }

  isRunning() {
    return this.state !== "idle" && this.state !== "stopped";
  }

  async start() {
    if (this.state !== "idle") {
      throw new Error("This Live Painting session has already been started.");
    }

    this.callbacks.onStatus("Checking ComfyUI and the LCM LoRA...");
    await this.client.checkOnline();

    if (this.hasStopped()) {
      return;
    }

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

    try {
      await this.checkRefineAvailability();
    } catch (caughtError) {
      this.refineGap = `Could not check Krea-2 refine availability: ${getErrorMessage(caughtError)}`;
    }

    if (this.hasStopped()) {
      return;
    }

    await this.registerStrokeListeners();

    if (this.hasStopped()) {
      this.removeStrokeListeners();
      return;
    }

    if (this.registeredEvents.length === 0) {
      throw createOpenLayerError(
        "PHOTOSHOP_EXPORT_FAILED",
        "Photoshop did not accept any Live Painting stroke listeners.",
        `Tried notification events: ${STROKE_EVENT_CANDIDATES.join(", ")}.`
      );
    }

    this.setState("listening");
    this.callbacks.onStatus(
      `Live session started with ${this.loraName}. Listening for: ${this.registeredEvents.join(", ")}. Paint a stroke...`
    );
    this.markDirty();
  }

  stop(reason = "Live session stopped.") {
    if (this.state === "stopped") {
      return;
    }

    this.refineGeneration += 1;
    this.refineRequested = false;
    this.dirty = false;
    this.clearPauseTimer();
    this.cancelCurrentPrompt();
    this.removeStrokeListeners();
    this.setState("stopped");
    this.callbacks.onStopped(reason);
  }

  async checkRefineAvailability() {
    const inventory = await this.client.getModelInventory();
    this.refineGap = findKrea2RefineGap(inventory);
    return this.refineGap;
  }

  refineNow() {
    if (!this.isRunning()) {
      return;
    }

    if (this.refineGap) {
      this.callbacks.onStatus(this.refineGap);
      return;
    }

    this.clearPauseTimer();
    this.refineGeneration += 1;
    this.refineRequested = true;

    if (this.activeJob === "refine") {
      this.callbacks.onStatus("Restarting Krea-2 refine with the latest canvas...");
      this.cancelCurrentPrompt();
      return;
    }

    this.callbacks.onStatus("Krea-2 refine requested...");
    void this.pump();
  }

  private setState(nextState: LivePaintingState) {
    if (this.state === nextState) {
      return;
    }

    this.state = nextState;
    this.callbacks.onStateChanged(nextState);
  }

  private hasStopped() {
    return this.state === "stopped";
  }

  private handleStrokeEvent(eventName: string) {
    if (!this.isRunning()) {
      return;
    }

    const now = Date.now();
    const sinceLast = this.lastEventAt ? now - this.lastEventAt : 0;
    this.lastEventAt = now;
    this.callbacks.onStatus(
      `Photoshop event "${eventName}"${sinceLast ? ` (+${sinceLast}ms)` : ""} — syncing...`
    );
    this.armPauseTimer();
    this.markDirty();
  }

  private markDirty() {
    if (!this.isRunning()) {
      return;
    }

    this.dirty = true;

    if (!this.activeJob && !this.refineRequested) {
      this.setState("pending");
    }

    void this.pump();
  }

  private async pump() {
    if (this.activeJob || !this.isRunning()) {
      return;
    }

    if (this.refineRequested && this.refineGap) {
      this.refineRequested = false;
      this.callbacks.onStatus(this.refineGap);
    }

    let jobKind: JobKind;
    let refineGeneration = this.refineGeneration;

    if (this.refineRequested) {
      jobKind = "refine";
      this.refineRequested = false;
      // The refine capture consumes all canvas changes made before it starts.
      // A stroke after this point sets dirty again and queues the next live job.
      this.dirty = false;
      refineGeneration = this.refineGeneration;
      this.setState("refining");
    } else if (this.dirty) {
      jobKind = "live";
      this.dirty = false;
      this.setState("pending");
    } else {
      if (this.state !== "refined") {
        this.setState("listening");
      }
      return;
    }

    this.activeJob = jobKind;

    try {
      const completed = jobKind === "live"
        ? await this.runLiveCycle()
        : await this.runRefineCycle(refineGeneration);

      if (completed) {
        this.consecutiveFailures = 0;
      }
    } catch (caughtError) {
      if (this.isRunning()) {
        this.handleCycleFailure(jobKind, caughtError);
      }
    } finally {
      this.activeJob = null;
    }

    if (!this.isRunning()) {
      return;
    }

    if (this.refineRequested || this.dirty) {
      void this.pump();
    } else if (this.state !== "refined") {
      this.setState("listening");
    }
  }

  private async runLiveCycle() {
    const cycleStart = Date.now();
    const capture = await this.capture(this.options.maxDimension ?? 512);
    const capturedAt = Date.now();

    if (!this.isRunning()) {
      return false;
    }

    const sourceImageName = await this.client.uploadImage(
      capture.blob,
      `openlayer-live-${this.seed}.png`
    );
    const uploadedAt = Date.now();

    if (!this.isRunning()) {
      return false;
    }

    const workflow = buildLcmLiveWorkflow({
      checkpointName: this.options.checkpointName,
      loraName: this.loraName,
      prompt: this.options.prompt,
      sourceImageName,
      seed: this.seed,
      denoise: clampLiveDenoise(this.options.denoise)
    });
    const result = await this.submitAndRetrieve(
      workflow,
      LIVE_PAINTING_SAVE_NODE_ID,
      250,
      120000,
      () => !this.isRunning()
    );
    const finishedAt = Date.now();

    if (!result || !this.isRunning()) {
      return false;
    }

    this.liveCycles += 1;
    this.callbacks.onPreviewBlob(result.blob, capture.originatingDocument);
    this.callbacks.onStatus(`Live preview updated (cycle ${this.liveCycles}).`);
    this.callbacks.onTimings(
      [
        `Cycle ${this.liveCycles}:`,
        `capture ${capturedAt - cycleStart}ms (${capture.mode}, ${capture.width}x${capture.height})`,
        `upload ${uploadedAt - capturedAt}ms`,
        `generate ${finishedAt - uploadedAt}ms`,
        `total ${((finishedAt - cycleStart) / 1000).toFixed(2)}s`
      ].join(" | ")
    );
    this.setState("listening");
    return true;
  }

  private async runRefineCycle(refineGeneration: number) {
    const isCancelled = () => !this.isRunning() || refineGeneration !== this.refineGeneration;
    const cycleStart = Date.now();
    const capture = await this.capture(this.options.refineMaxDimension ?? 1024);
    const capturedAt = Date.now();

    if (isCancelled()) {
      return false;
    }

    const sourceImageName = await this.client.uploadImage(
      capture.blob,
      `openlayer-refine-${this.seed}.png`
    );
    const uploadedAt = Date.now();

    if (isCancelled()) {
      return false;
    }

    const workflow = buildKrea2RefineWorkflow({
      prompt: this.options.prompt,
      sourceImageName,
      seed: this.seed,
      denoise: clampRefineDenoise(this.options.refineDenoise ?? 0.45),
      width: capture.width,
      height: capture.height
    });

    let result: { blob: Blob } | null;

    try {
      result = await this.submitAndRetrieve(
        workflow,
        LIVE_REFINE_SAVE_NODE_ID,
        500,
        180000,
        isCancelled
      );
    } catch (caughtError) {
      if (isCancelled()) {
        return false;
      }

      throw caughtError;
    }

    const finishedAt = Date.now();

    if (!result || isCancelled()) {
      return false;
    }

    this.refineCycles += 1;
    this.callbacks.onRefineResult(result.blob, capture.originatingDocument);
    this.callbacks.onStatus(`Refine result updated (cycle ${this.refineCycles}).`);
    this.callbacks.onTimings(
      [
        `Refine ${this.refineCycles}:`,
        `capture ${capturedAt - cycleStart}ms (${capture.mode}, ${capture.width}x${capture.height})`,
        `upload ${uploadedAt - capturedAt}ms`,
        `generate ${finishedAt - uploadedAt}ms`,
        `total ${((finishedAt - cycleStart) / 1000).toFixed(2)}s`
      ].join(" | ")
    );
    this.setState("refined");
    return true;
  }

  private async submitAndRetrieve(
    workflow: ComfyWorkflow,
    preferredNodeId: string,
    intervalMs: number,
    timeoutMs: number,
    isCancelled: () => boolean
  ): Promise<{ blob: Blob } | null> {
    const promptId = await this.client.submitPrompt(workflow);

    if (isCancelled()) {
      this.cancelPrompt(promptId);
      return null;
    }

    this.currentPromptId = promptId;

    try {
      const history = await this.client.pollUntilComplete(promptId, {
        intervalMs,
        timeoutMs,
        isCancelled
      });

      if (isCancelled()) {
        this.cancelPrompt(promptId);
        return null;
      }

      const result = await this.client.retrieveFirstOutputImage(promptId, history, {
        preferredNodeId
      });

      if (isCancelled()) {
        this.cancelPrompt(promptId);
        return null;
      }

      return result;
    } catch (caughtError) {
      if (isCancelled()) {
        this.cancelPrompt(promptId);
        return null;
      }

      throw caughtError;
    } finally {
      if (this.currentPromptId === promptId) {
        this.currentPromptId = null;
      }
    }
  }

  private handleCycleFailure(jobKind: JobKind, caughtError: unknown) {
    this.consecutiveFailures += 1;
    const label = jobKind === "live" ? "Live" : "Refine";
    const errorMessage = getErrorMessage(caughtError);
    this.callbacks.onStatus(
      `${label} cycle failed (${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} consecutive): ${errorMessage}`
    );

    if (this.consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      return;
    }

    const reason =
      `Live Painting stopped after ${MAX_CONSECUTIVE_FAILURES} consecutive cycle failures. `
      + `Last ${label.toLowerCase()} failure: ${errorMessage}`;
    this.callbacks.onStatus(reason);
    this.stop(reason);
  }

  private armPauseTimer() {
    this.clearPauseTimer();
    const pauseSeconds = Number.isFinite(this.options.pauseSeconds)
      ? Math.max(0, this.options.pauseSeconds ?? 4)
      : 4;

    this.pauseTimer = this.timers.setTimeout(() => {
      this.pauseTimer = null;

      if (
        this.options.autoRefineOnPause === true
        && this.state === "listening"
        && !this.dirty
      ) {
        this.refineNow();
      }
    }, pauseSeconds * 1000);
  }

  private clearPauseTimer() {
    if (this.pauseTimer === null) {
      return;
    }

    this.timers.clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }

  private cancelCurrentPrompt() {
    if (this.currentPromptId) {
      this.cancelPrompt(this.currentPromptId);
    }
  }

  private cancelPrompt(promptId: string) {
    if (this.cancelledPromptIds.has(promptId)) {
      return;
    }

    this.cancelledPromptIds.add(promptId);
    void this.client.cancelPrompt(promptId).catch(() => {
      // Stop and refine restart remain synchronous and best-effort if ComfyUI is unavailable.
    });
  }

  private async registerStrokeListeners() {
    for (const eventName of STROKE_EVENT_CANDIDATES) {
      if (this.state === "stopped") {
        return;
      }

      try {
        await this.actionModule.addNotificationListener([eventName], this.notificationHandler);
        this.registeredEvents.push(eventName);
      } catch {
        try {
          await this.actionModule.addNotificationListener([{ event: eventName }], this.notificationHandler);
          this.registeredEvents.push(eventName);
        } catch {
          // Unsupported Photoshop notification candidates are skipped.
        }
      }
    }
  }

  private removeStrokeListeners() {
    for (const eventName of this.registeredEvents) {
      this.removeStrokeListener(eventName);
    }

    this.registeredEvents = [];
  }

  private removeStrokeListener(eventName: string) {
    try {
      const removal = this.actionModule.removeNotificationListener(
        [eventName],
        this.notificationHandler
      );
      void Promise.resolve(removal).catch(() => {
        this.removeStrokeListenerWithDescriptor(eventName);
      });
    } catch {
      this.removeStrokeListenerWithDescriptor(eventName);
    }
  }

  private removeStrokeListenerWithDescriptor(eventName: string) {
    try {
      const removal = this.actionModule.removeNotificationListener(
        [{ event: eventName }],
        this.notificationHandler
      );
      void Promise.resolve(removal).catch(() => {
        // Listener cleanup is best-effort during synchronous teardown.
      });
    } catch {
      // Listener cleanup is best-effort during synchronous teardown.
    }
  }
}
