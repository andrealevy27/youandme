import type { GapSeverity } from "./gaps-model";

export const SEVERITY_LABELS: Record<GapSeverity, string> = {
  critical: "critical",
  important: "important",
  nice: "nice to have",
};
