import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createSearchWidget, type SearchWidgetInstance } from "../search/SearchWidget";
import { SourceDropdownSlot } from "./SourceDropdownSlot";
import type { SourceDropdownOption } from "./SourceDropdown";

interface FeatureSourceTabProps {
  active: boolean;
  featureId: string;
  featureLabel: string;
  dropdownClassName?: string;
  dropdownOptions?: SourceDropdownOption[];
  selectedSourceId?: string;
  editSourcesLabel?: string;
  searchClassName?: string;
  searchId?: string;
  searchPlaceholder?: string;
  searchInputName?: string;
  initialSearchQuery?: string;
  compactId?: string;
  children?: ReactNode;
  headerAccessory?: ReactNode;
  onSourceChange?: (option: SourceDropdownOption | null) => void;
  onEditSources?: () => void;
  onSearchQuery?: (query: string, source: SourceDropdownOption | null) => void;
  onSearchWidget?: (widget: SearchWidgetInstance) => void;
}

export function FeatureSourceTab({
  active,
  featureId,
  featureLabel,
  dropdownClassName = "",
  dropdownOptions = [],
  selectedSourceId,
  editSourcesLabel,
  searchClassName = "",
  searchId,
  searchPlaceholder,
  searchInputName,
  initialSearchQuery = "",
  compactId,
  children,
  headerAccessory,
  onSourceChange,
  onEditSources,
  onSearchQuery,
  onSearchWidget
}: FeatureSourceTabProps) {
  const searchRef = useRef<HTMLDivElement | null>(null);
  const onSearchQueryRef = useRef(onSearchQuery);

  onSearchQueryRef.current = onSearchQuery;

  useEffect(() => {
    if (!searchRef.current || !searchPlaceholder) return;

    const widget = createSearchWidget({
      placeholder: searchPlaceholder,
      inputName: searchInputName || `${featureId}-query`,
      onQuery(query, source) {
        onSearchQueryRef.current?.(query, source);
      },
      onSubmit(query, source) {
        onSearchQueryRef.current?.(query, source);
      }
    });
    widget.setQuery(initialSearchQuery);
    searchRef.current.replaceChildren(widget.shellElement);
    onSearchWidget?.(widget);
  }, [featureId, initialSearchQuery, searchInputName, searchPlaceholder, onSearchWidget]);

  return (
    <section
      className={`workspace-tab${active ? " is-active" : ""}`}
      id={`${featureId}Tab`}
      data-tab-panel
      hidden={!active}
    >
      <div className="section-title-row">
        <h2 className="section-title">{featureLabel}</h2>
        {dropdownOptions.length > 0 && (
          <SourceDropdownSlot
            className={dropdownClassName}
            options={dropdownOptions}
            selectedId={selectedSourceId}
            onChange={onSourceChange}
            onEdit={onEditSources}
            editLabel={editSourcesLabel || `Edit ${featureId} sources`}
          />
        )}
        {headerAccessory}
      </div>
      {searchPlaceholder && (
        <div className={searchClassName} id={searchId} ref={searchRef} />
      )}
      {children}
      {compactId && <div id={compactId} />}
    </section>
  );
}
