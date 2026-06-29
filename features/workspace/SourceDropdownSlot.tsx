import { useEffect, useRef } from "react";
import { createSourceDropdown } from "./SourceDropdown";
import type { SourceDropdownInstance, SourceDropdownOption } from "./SourceDropdown";

export function SourceDropdownSlot({
  className = "",
  options,
  selectedId,
  onChange,
  editLabel,
  onEdit
}: {
  className?: string;
  options: SourceDropdownOption[];
  selectedId?: string;
  onChange?: (option: SourceDropdownOption | null) => void;
  editLabel?: string;
  onEdit?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<SourceDropdownInstance | null>(null);
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current || dropdownRef.current) return;
    dropdownRef.current = createSourceDropdown({
      options,
      selectedId,
      onChange(option) {
        onChangeRef.current?.(option);
      },
      onEdit,
      editLabel
    });
    hostRef.current.appendChild(dropdownRef.current.element);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    dropdownRef.current?.setOptions(options, selectedId);
  }, [options, selectedId]);

  return <div className={className} ref={hostRef} />;
}
