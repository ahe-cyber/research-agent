"use client";

import { type RefObject, useCallback, useRef } from "react";
import { AgentPanel } from "@/features/agent/components/AgentPanel.jsx";

type AgentAreaProps = {
  suggestToolRef?: RefObject<((name: string) => void) | null>;
};

export function AgentArea({ suggestToolRef: providedSuggestToolRef }: AgentAreaProps = {}) {
  const localSuggestToolRef = useRef<((name: string) => void) | null>(null);
  const suggestToolRef = providedSuggestToolRef ?? localSuggestToolRef;
  const onSuggestTool = useCallback((name: string) => suggestToolRef.current?.(name), []);

  void onSuggestTool;

  return (
    <aside aria-label="Agent">
      <AgentPanel />
    </aside>
  );
}
