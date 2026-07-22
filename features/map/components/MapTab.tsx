import { useEffect, useState } from "react";
import { FeatureSourceTab } from "@/components/workspace/FeatureSourceTab";
import { CustomLayersSection } from "./CustomLayersSection";
import { PdfOverlaySection } from "./PdfOverlaySection";

const MAP_SOURCE_OPTIONS = [
  { id: "map-setup", label: "Map setup" }
];

export function MapTab({ active }: { active: boolean }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    filterInjectedMapOptions("mapBasemapOptions", query);
    filterInjectedMapOptions("mapDetailOptions", query);
  }, [query]);

  return (
    <FeatureSourceTab
      active={active}
      featureId="map"
      featureLabel="Map"
      dropdownClassName="map-source-dropdown"
      dropdownOptions={MAP_SOURCE_OPTIONS}
      selectedSourceId="map-setup"
      onEditSources={() => window.dispatchEvent(new CustomEvent("research-agent:edit-map-sources"))}
      editSourcesLabel="Edit map setup"
      searchClassName="map-search-widget"
      searchId="mapSidebarSearch"
      searchPlaceholder="Search map layers"
      searchInputName="map-layer-query"
      onSearchQuery={(value) => setQuery(value.trim().toLowerCase())}
    >
      <div className="map-display-settings">
        <div className="map-display-group" data-map-filter-group>
          <h3>Basemap</h3>
          <div id="mapBasemapOptions" />
        </div>
        <div className="map-display-group" data-map-filter-group>
          <h3>Global Overlay</h3>
          <div id="mapDetailOptions" />
        </div>
        <div className="map-display-group" data-map-filter-group>
          <h3>Local Overlay</h3>
          <div className="map-display-options">
            <p className="map-empty-note">No local overlays configured.</p>
          </div>
        </div>
        <div className="map-display-group map-manual-overlay-group" data-map-filter-group>
          <h3>Manual Overlay</h3>
          <PdfOverlaySection />
          <CustomLayersSection />
        </div>
      </div>
    </FeatureSourceTab>
  );
}

function filterInjectedMapOptions(containerId: string, query: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll<HTMLElement>(".map-display-option").forEach((item) => {
    item.hidden = Boolean(query) && !item.textContent?.toLowerCase().includes(query);
  });
}
