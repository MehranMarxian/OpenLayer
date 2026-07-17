import {
  canPublishGenerationUpdate,
  shouldFinalizeActiveRun,
  validateGenerationCommit
} from "./generationIntegrity";
import {
  createGenerationCancelledError,
  GenerationCancelResult,
  isGenerationCancelledError
} from "../comfy/generationCancel";
import { bindDocumentContext, DocumentContextBound, PhotoshopDocumentIdentity } from "../photoshop/documentContext";
import type { HistoryToolType } from "./historyMetadata";

export type GenerationProgressWatcher = { close: () => void };

// The structural subset of ComfyClient the pipeline drives. Kept structural so
// the run/cancel/stale semantics are testable against a scripted fake client.
export type GenerationClient<THistory, TImage> = {
  submitPrompt(workflow: object): Promise<string>;
  watchProgress(promptId: string, callbacks: {
    onStatus: (message: string) => void;
    onProgress: (value: number, max: number) => void;
    onPreviewBlob: (blob: Blob) => void;
    onError: (message: string) => void;
  }): GenerationProgressWatcher | null;
  pollUntilComplete(promptId: string, options: {
    onTick: (message: string) => void;
    isCancelled: () => boolean;
  }): Promise<THistory>;
  retrieveFirstOutputImage(promptId: string, history: THistory, options: {
    preferredNodeId?: string;
  }): Promise<TImage>;
};

export type CancellableGenerationClient = {
  cancelPrompt(promptId?: string): Promise<GenerationCancelResult>;
};

export type GenerationStatusTone = "idle" | "ready" | "error";

// How one tool reports pipeline progress. Every callback is already gated on
// run currency by the controller; hooks never need their own staleness checks.
export type GenerationPipelineUi = {
  status(message: string, tone: GenerationStatusTone): void;
  progressPreview(message: string, blob?: Blob): void;
  stepProgress(value: number, max: number): void;
  diagnostics(message: string): void;
  cancelled(promptId?: string): void;
};

export type GenerationPipelineMessages = {
  submitStatus: string;
  submitPreview: string;
  generateStatus: string;
  generatePreview: string;
  retrieveStatus: string;
  retrievePreview: string;
  livePreview: string;
};

export type GenerationPipelineOptions<THistory, TImage extends object> = {
  toolType: HistoryToolType;
  client: GenerationClient<THistory, TImage> & CancellableGenerationClient;
  workflow: object;
  preferredNodeId?: string;
  originatingDocument: PhotoshopDocumentIdentity | null;
  ui: GenerationPipelineUi;
  messages: GenerationPipelineMessages;
  // Publish the committed result to tool state and history. Runs only after the
  // commit gate passed; the run is finalized when it returns.
  commit(result: DocumentContextBound<TImage>): void | Promise<void>;
};

export type GenerationRunHandle = {
  readonly toolType: HistoryToolType;
  readonly promptId: string;
  publish(update: () => void): void;
  isRunCancelled(): boolean;
  setWatcher(watcher: GenerationProgressWatcher | null): void;
  assertCanCommit(): void;
  isCurrent(): boolean;
  finish(): void;
};

export type ActiveGenerationSnapshot = {
  toolType: HistoryToolType;
  promptId: string;
  client: CancellableGenerationClient;
  isCurrent(): boolean;
};

export type GenerationControllerHooks = {
  onRunStarted(toolType: HistoryToolType): void;
  onRunFinished(toolType: HistoryToolType): void;
};

type ActiveGeneration = {
  runId: number;
  toolType: HistoryToolType;
  client: CancellableGenerationClient;
  promptId: string;
  watcher: GenerationProgressWatcher | null;
  isCancelled: boolean;
};

// Owns which generation run is current. Exactly one run can publish UI updates,
// commit a result, or finalize shared state; a cancelled or superseded run's
// callbacks fall through the gates in generationIntegrity. This is the Phase A4
// state that previously lived as renderApp closure variables.
export function createGenerationController(hooks: GenerationControllerHooks) {
  let activeGeneration: ActiveGeneration | null = null;
  let runSequence = 0;

  function begin(
    toolType: HistoryToolType,
    client: CancellableGenerationClient,
    promptId: string
  ): GenerationRunHandle {
    const run: ActiveGeneration = {
      runId: ++runSequence,
      toolType,
      client,
      promptId,
      watcher: null,
      isCancelled: false
    };

    activeGeneration = run;
    hooks.onRunStarted(toolType);
    let finished = false;

    return {
      toolType,
      promptId,
      publish(update) {
        if (canPublishGenerationUpdate(run, activeGeneration)) update();
      },
      isRunCancelled() {
        return run.isCancelled;
      },
      setWatcher(watcher) {
        run.watcher = watcher;
      },
      assertCanCommit() {
        if (!validateGenerationCommit(run, activeGeneration).ok) throw createGenerationCancelledError();
      },
      isCurrent() {
        return shouldFinalizeActiveRun(run, activeGeneration);
      },
      finish() {
        if (finished) return;
        finished = true;
        run.watcher?.close();
        run.watcher = null;

        if (shouldFinalizeActiveRun(run, activeGeneration)) {
          activeGeneration = null;
          hooks.onRunFinished(toolType);
        }
      }
    };
  }

  return {
    begin,

    // Marks the active run cancelled and stops its progress watcher, returning
    // what the caller needs to also interrupt ComfyUI. The run's own pipeline
    // notices isCancelled at the next poll and unwinds through its normal path.
    cancelActive(): ActiveGenerationSnapshot | null {
      const generation = activeGeneration;
      if (!generation) return null;

      generation.isCancelled = true;
      generation.watcher?.close();
      generation.watcher = null;

      return {
        toolType: generation.toolType,
        promptId: generation.promptId,
        client: generation.client,
        isCurrent: () => activeGeneration?.runId === generation.runId
      };
    },

    // Panel teardown: stop polling without finalizing UI state that no longer
    // exists. Mirrors the pre-refactor disposeAppResources behavior.
    disposeActive() {
      if (!activeGeneration) return;
      activeGeneration.isCancelled = true;
      activeGeneration.watcher?.close();
      activeGeneration.watcher = null;
    },

    async runPipeline<THistory, TImage extends object>(
      options: GenerationPipelineOptions<THistory, TImage>
    ): Promise<DocumentContextBound<TImage> | null> {
      let watcher: GenerationProgressWatcher | null = null;
      let run: GenerationRunHandle | null = null;

      try {
        options.ui.status(options.messages.submitStatus, "idle");
        options.ui.progressPreview(options.messages.submitPreview);
        const promptId = await options.client.submitPrompt(options.workflow);
        run = begin(options.toolType, options.client, promptId);
        const startedRun = run;
        let hasLivePreview = false;
        watcher = options.client.watchProgress(promptId, {
          onStatus: (message) => {
            startedRun.publish(() => {
              options.ui.status(message, "idle");

              if (!hasLivePreview) {
                options.ui.progressPreview(message);
              }
            });
          },
          onProgress: (value, max) => startedRun.publish(() => options.ui.stepProgress(value, max)),
          onPreviewBlob: (blob) => {
            startedRun.publish(() => {
              hasLivePreview = true;
              options.ui.progressPreview(options.messages.livePreview, blob);
            });
          },
          onError: (message) => startedRun.publish(() => options.ui.diagnostics(message))
        });
        run.setWatcher(watcher);

        options.ui.status(options.messages.generateStatus, "idle");
        options.ui.progressPreview(options.messages.generatePreview);
        const history = await options.client.pollUntilComplete(promptId, {
          onTick: (message) => {
            startedRun.publish(() => {
              options.ui.status(message, "idle");

              if (!hasLivePreview) {
                options.ui.progressPreview(message);
              }
            });
          },
          isCancelled: () => startedRun.isRunCancelled()
        });
        watcher?.close();
        watcher = null;
        run.setWatcher(null);

        options.ui.status(options.messages.retrieveStatus, "idle");
        options.ui.progressPreview(options.messages.retrievePreview);
        const generatedResult = bindDocumentContext(
          await options.client.retrieveFirstOutputImage(promptId, history, {
            preferredNodeId: options.preferredNodeId
          }),
          options.originatingDocument
        );
        run.assertCanCommit();
        await options.commit(generatedResult);
        run.finish();
        run = null;
        return generatedResult;
      } catch (caughtError) {
        if (isGenerationCancelledError(caughtError)) {
          if (!run || run.isCurrent()) options.ui.cancelled(run?.promptId);
          return null;
        }

        throw caughtError;
      } finally {
        watcher?.close();
        run?.finish();
      }
    }
  };
}

export type GenerationController = ReturnType<typeof createGenerationController>;
