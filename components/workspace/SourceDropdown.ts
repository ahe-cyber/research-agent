export interface SourceDropdownOption {
  id: string;
  label: string;
  costly?: boolean;
  disabled?: boolean;
}

export interface SourceDropdownInstance {
  element: HTMLDivElement;
  setOptions(options: SourceDropdownOption[], selectedId?: string): void;
  getSelected(): SourceDropdownOption | null;
}

export function createSourceDropdown({
  options = [],
  selectedId = "",
  onChange,
  onEdit,
  editLabel = "Edit sources",
  buttonClassName = "section-tool-button"
}: {
  options?: SourceDropdownOption[];
  selectedId?: string;
  onChange?: (option: SourceDropdownOption | null) => void;
  onEdit?: () => void;
  editLabel?: string;
  buttonClassName?: string;
} = {}): SourceDropdownInstance {
  let items = options;
  let currentId = selectedId;
  let open = false;

  const element = document.createElement("div");
  element.className = "search-source-ctrl";

  const onDocClick = (event: MouseEvent) => {
    if (!element.contains(event.target as Node)) closeMenu();
  };
  document.addEventListener("click", onDocClick);

  function getSelected() {
    return items.find((option) => option.id === currentId) || items[0] || null;
  }

  function setOptions(nextOptions: SourceDropdownOption[], nextSelectedId = currentId) {
    items = nextOptions;
    currentId = items.some((option) => option.id === nextSelectedId)
      ? nextSelectedId
      : (items[0]?.id ?? "");
    render();
    onChange?.(getSelected());
  }

  function render() {
    const current = getSelected();
    element.replaceChildren();
    if (!current) return;

    if (open) {
      const menu = document.createElement("div");
      menu.className = "search-source-menu";
      items.forEach((option) => {
        const item = document.createElement("button");
        item.className = `search-source-item${option.id === currentId ? " is-active" : ""}`;
        item.type = "button";
        item.disabled = Boolean(option.disabled);
        appendSourceDropdownLabel(item, option);
        item.addEventListener("click", (event) => {
          event.stopPropagation();
          if (option.disabled) return;
          currentId = option.id;
          closeMenu();
          onChange?.(option);
        });
        menu.appendChild(item);
      });
      if (onEdit) {
        const divider = document.createElement("div");
        divider.className = "search-source-divider";
        const editItem = document.createElement("button");
        editItem.className = "search-source-item search-source-item--edit";
        editItem.type = "button";
        editItem.textContent = editLabel;
        editItem.addEventListener("click", (event) => {
          event.stopPropagation();
          closeMenu();
          onEdit();
        });
        menu.append(divider, editItem);
      }
      element.appendChild(menu);
    }

    const button = document.createElement("button");
    button.className = buttonClassName;
    button.type = "button";
    appendSourceDropdownLabel(button, current);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      open ? closeMenu() : openMenu();
    });
    element.appendChild(button);
  }

  function openMenu() {
    open = true;
    render();
  }

  function closeMenu() {
    open = false;
    render();
  }

  setOptions(items, selectedId);

  return {
    element,
    setOptions,
    getSelected
  };
}

export function appendSourceDropdownLabel(element: HTMLElement, option: SourceDropdownOption) {
  element.classList.toggle("has-money-icon", Boolean(option.costly));
  element.textContent = "";
  element.append(option.label);
}
