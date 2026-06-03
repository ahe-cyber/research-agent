import { useLayoutEffect, useRef } from "react";

interface DomSlotProps {
  nodes?: Node[];
}

export function DomSlot({ nodes = [] }: DomSlotProps) {
  const slotRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    slot.replaceChildren(...nodes);

    return () => {
      slot.replaceChildren();
    };
  }, [nodes]);

  return <span ref={slotRef} style={{ display: "contents" }} />;
}
