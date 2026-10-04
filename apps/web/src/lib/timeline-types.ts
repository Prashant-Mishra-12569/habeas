// Shared by server and client code.
export type StepKind = "opened" | "answered" | "decided" | "settled" | "withdrawn" | "emergency";
export type TimelineStep = { kind: StepKind; at: number; tx: string | null };
export type Timeline = { steps: TimelineStep[]; oldestKept: number };
