export type StatusTone = "idle" | "ready" | "error";

type StatusBarProps = {
  status: string;
  tone: StatusTone;
};

export function StatusBar({ status, tone }: StatusBarProps) {
  const label = tone === "ready" ? "Ready" : tone === "error" ? "Error" : "Status";

  return (
    <div className="status-bar" role="status">
      <span className="status-text">{status}</span>
      <span className={`status-pill ${tone}`}>{label}</span>
    </div>
  );
}
