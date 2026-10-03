"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./Button";

/** Remounts its children so an entrance animation can be watched again. */
export function Replayable({ children, label = "Play again" }: { children: ReactNode; label?: string }) {
  const [run, setRun] = useState(0);
  return (
    <div>
      <div key={run}>{children}</div>
      <Button variant="quiet" className="mt-2" onClick={() => setRun(run + 1)}>
        {label}
      </Button>
    </div>
  );
}
