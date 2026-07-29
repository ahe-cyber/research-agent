import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SourceWidgetOption {
  id: string;
  name: string;
  access?: string;
  costly?: boolean;
  disabled?: boolean;
}

type SourceWidgetProps = {
  options: SourceWidgetOption[];
  selectedId: string;
  editLabel: string;
  onChange: (option: SourceWidgetOption) => void;
  onEdit: () => void;
};

const getButtonRect = (button: HTMLButtonElement | null) => {
  if (!button) return null;
  const rect = button.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    right: window.innerWidth - rect.right,
    minWidth: rect.width
  };
};

const SourceWidgetLabel = ({ option }: { option: SourceWidgetOption }) => {
  return (
    <span className={option.costly ? "has-money-icon" : undefined}>
      {option.name}
    </span>
  );
};

export const SourceWidget = ({ options, selectedId, editLabel, onChange, onEdit }: SourceWidgetProps) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(getButtonRect(buttonRef.current));
  const selected = options.find((option) => option.id === selectedId) || options[0] || null;

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const updatePosition = () => setMenuPosition(getButtonRect(buttonRef.current));

    updatePosition();
    document.addEventListener("click", close);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="search-source-ctrl">
      <button
        ref={buttonRef}
        className="section-tool-button"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        {selected ? <SourceWidgetLabel option={selected} /> : <span className="search-source-empty">No sources</span>}
      </button>
      {open && menuPosition && createPortal(
        <div
          className="search-source-menu"
          style={{
            position: "fixed",
            top: menuPosition.top,
            right: menuPosition.right,
            minWidth: menuPosition.minWidth
          }}
        >
          {options.length > 0 ? (
            <Fragment>
              {options.map((option) => (
                <button
                  key={option.id}
                  className={`search-source-item${option.id === selected?.id ? " is-active" : ""}`}
                  type="button"
                  disabled={Boolean(option.disabled)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (option.disabled) return;
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <SourceWidgetLabel option={option} />
                </button>
              ))}
              <div className="search-source-divider" />
            </Fragment>
          ) : null}
          <button
            className="search-source-item search-source-item--edit"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onEdit();
            }}
          >
            {editLabel}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};
