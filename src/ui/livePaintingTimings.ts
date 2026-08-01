export const LIVE_PHASE_IDS = [
  "capture.getPixels",
  "capture.toRgba",
  "capture.pngEncode",
  "upload.encodeBody",
  "upload.http",
  "submit.http",
  "server.queueWait",
  "server.execute",
  "poll.overshoot",
  "download.http",
  "paint"
] as const;

export type LivePhaseId = (typeof LIVE_PHASE_IDS)[number];

export type LiveCyclePhaseDurations = Partial<Record<LivePhaseId, number | null>>;

export type LiveCycleSample = {
  cycleIndex: number;
  kind: "live" | "refine";
  totalMs: number;
  phases: LiveCyclePhaseDurations;
  captureMode?: string;
  width?: number;
  height?: number;
};

export type LiveCycleSummary = LiveCycleSample & {
  accountedMs: number;
  unaccountedMs: number;
  overAccounted: boolean;
};

export type LiveDurationAggregate = {
  median: number | null;
  p90: number | null;
  count: number;
};

export type LiveCycleAggregate = {
  phases: Record<LivePhaseId, LiveDurationAggregate>;
  totalMs: LiveDurationAggregate;
};

export type ServerPhaseDurations = {
  queueWaitMs: number | null;
  executeMs: number | null;
  pollOvershootMs: number | null;
};

export function summariseCycle(sample: LiveCycleSample): LiveCycleSummary {
  const accountedMs = LIVE_PHASE_IDS.reduce((total, phaseId) => {
    const duration = sample.phases[phaseId];
    return duration === null || duration === undefined ? total : total + duration;
  }, 0);
  const overAccounted = accountedMs > sample.totalMs;

  return {
    ...sample,
    phases: { ...sample.phases },
    accountedMs,
    unaccountedMs: overAccounted ? 0 : sample.totalMs - accountedMs,
    overAccounted
  };
}

export function deriveServerPhases(
  submittedAtMs: number,
  observedCompleteAtMs: number,
  messages: unknown
): ServerPhaseDurations {
  if (!Array.isArray(messages)) {
    return emptyServerPhases();
  }

  let executionStartMs: number | null = null;
  let executionSuccessMs: number | null = null;

  for (const message of messages) {
    if (!Array.isArray(message) || message.length < 2) {
      continue;
    }

    const [eventName, data] = message;
    if (eventName !== "execution_start" && eventName !== "execution_success") {
      continue;
    }

    const timestamp = readTimestamp(data);
    if (timestamp === null) {
      continue;
    }

    if (eventName === "execution_start" && executionStartMs === null) {
      executionStartMs = timestamp;
    } else if (eventName === "execution_success" && executionSuccessMs === null) {
      executionSuccessMs = timestamp;
    }
  }

  if (executionStartMs === null || executionSuccessMs === null) {
    return emptyServerPhases();
  }

  return {
    queueWaitMs: nonNegativeDifference(executionStartMs, submittedAtMs),
    executeMs: nonNegativeDifference(executionSuccessMs, executionStartMs),
    pollOvershootMs: nonNegativeDifference(observedCompleteAtMs, executionSuccessMs)
  };
}

export function aggregateCycles(samples: readonly LiveCycleSample[]): LiveCycleAggregate {
  const phases = {} as Record<LivePhaseId, LiveDurationAggregate>;

  for (const phaseId of LIVE_PHASE_IDS) {
    const durations: number[] = [];

    for (const sample of samples) {
      const duration = sample.phases[phaseId];
      if (duration !== null && duration !== undefined) {
        durations.push(duration);
      }
    }

    phases[phaseId] = aggregateDurations(durations);
  }

  return {
    phases,
    totalMs: aggregateDurations(samples.map((sample) => sample.totalMs))
  };
}

export function formatCycleLine(sample: LiveCycleSample): string {
  const summary = summariseCycle(sample);
  const fields = [
    ...LIVE_PHASE_IDS.map(
      (phaseId) => `${phaseId} ${formatDuration(sample.phases[phaseId])}`
    ),
    `total ${formatDuration(sample.totalMs)}`,
    `accounted ${formatDuration(summary.accountedMs)}`,
    `unaccounted ${formatDuration(summary.unaccountedMs)}`,
    `overAccounted ${summary.overAccounted ? "yes" : "no"}`
  ];

  if (sample.captureMode !== undefined) {
    fields.push(`captureMode ${sample.captureMode}`);
  }

  if (sample.width !== undefined) {
    fields.push(`width ${sample.width}`);
  }

  if (sample.height !== undefined) {
    fields.push(`height ${sample.height}`);
  }

  return `Cycle ${sample.cycleIndex} (${sample.kind}): ${fields.join(" | ")}`;
}

/**
 * The per-cycle status line, showing only what was actually measured, most
 * expensive first.
 *
 * Every phase is deliberately NOT printed. The panel is 356px wide and eleven
 * phases plus their labels do not fit, but the stronger reason is that a line
 * listing eight "not reported" entries buries the three numbers that matter.
 * Unmeasured phases are still counted, in `unaccounted`, so nothing disappears
 * silently.
 */
export function formatMeasuredCycleLine(sample: LiveCycleSample): string {
  const summary = summariseCycle(sample);
  const measured = LIVE_PHASE_IDS
    .map((phaseId) => ({ phaseId, duration: sample.phases[phaseId] }))
    .filter((entry): entry is { phaseId: LivePhaseId; duration: number } =>
      entry.duration !== null && entry.duration !== undefined)
    .sort((left, right) => right.duration - left.duration)
    .map((entry) => `${entry.phaseId} ${entry.duration}ms`);

  const fields = [
    ...measured,
    `unaccounted ${summary.unaccountedMs}ms`,
    `total ${summary.totalMs}ms`
  ];

  if (summary.overAccounted) {
    fields.push("OVER-ACCOUNTED");
  }

  return `Cycle ${sample.cycleIndex} (${sample.kind}): ${fields.join(" | ")}`;
}

/**
 * The end-of-session line: median per phase across every cycle, worst first.
 *
 * This is the number the optimisation decision gets made from. A single cycle
 * is noise -- the first one pays for a cold model load and any one of them can
 * land badly against the poll interval -- so the panel shows this when the
 * session stops rather than asking anyone to read medians off a moving line.
 */
export function formatAggregateLine(samples: readonly LiveCycleSample[]): string {
  if (samples.length === 0) {
    return "No Live Painting cycles were measured.";
  }

  const aggregate = aggregateCycles(samples);
  const measured = LIVE_PHASE_IDS
    .map((phaseId) => ({ phaseId, aggregated: aggregate.phases[phaseId] }))
    .filter((entry) => entry.aggregated.median !== null)
    .sort((left, right) => (right.aggregated.median ?? 0) - (left.aggregated.median ?? 0))
    .map((entry) => `${entry.phaseId} ${entry.aggregated.median}ms`);

  return [
    `${samples.length} cycle${samples.length === 1 ? "" : "s"} measured`,
    `median total ${aggregate.totalMs.median}ms`,
    ...measured
  ].join(" | ");
}

export function formatCyclesTable(samples: readonly LiveCycleSample[]): string {
  const headers = [
    "cycleIndex",
    "kind",
    "captureMode",
    "width",
    "height",
    ...LIVE_PHASE_IDS,
    "totalMs",
    "accountedMs",
    "unaccountedMs",
    "overAccounted"
  ];
  const rows = samples.map((sample) => {
    const summary = summariseCycle(sample);

    return [
      String(sample.cycleIndex),
      sample.kind,
      sample.captureMode ?? "not reported",
      formatOptionalNumber(sample.width),
      formatOptionalNumber(sample.height),
      ...LIVE_PHASE_IDS.map((phaseId) => formatDuration(sample.phases[phaseId])),
      formatDuration(sample.totalMs),
      formatDuration(summary.accountedMs),
      formatDuration(summary.unaccountedMs),
      summary.overAccounted ? "yes" : "no"
    ].join("\t");
  });

  return [headers.join("\t"), ...rows].join("\n");
}

function emptyServerPhases(): ServerPhaseDurations {
  return {
    queueWaitMs: null,
    executeMs: null,
    pollOvershootMs: null
  };
}

function readTimestamp(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("timestamp" in value)) {
    return null;
  }

  const timestamp = value.timestamp;
  return typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : null;
}

function nonNegativeDifference(laterMs: number, earlierMs: number): number | null {
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) {
    return null;
  }

  const difference = laterMs - earlierMs;
  return difference >= 0 ? difference : null;
}

function aggregateDurations(durations: readonly number[]): LiveDurationAggregate {
  if (durations.length === 0) {
    return { median: null, p90: null, count: 0 };
  }

  const sorted = [...durations].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const p90Index = Math.ceil(sorted.length * 0.9) - 1;

  return {
    median,
    p90: sorted[p90Index],
    count: sorted.length
  };
}

function formatDuration(duration: number | null | undefined): string {
  return duration === null || duration === undefined ? "not reported" : `${duration}ms`;
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? "not reported" : String(value);
}
