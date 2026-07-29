import type { CSSProperties } from "react";
import { withBasePath } from "@/lib/basePath";
import { getFeatureLabel, type FeatureName } from "@/lib/features";
import styles from "./Sidebar.module.css";

type SidebarNavItemProps = {
  feature: FeatureName;
  activeFeature: FeatureName;
  setActiveFeature: (feature: FeatureName) => void;
  onMoveFeature: (feature: FeatureName, targetFeature: FeatureName) => void;
  onOpenSettings?: () => void;
};

const getFeatureIconSrc = (feature: FeatureName) => {
  if (feature === "workspace") return withBasePath("/assets/home.svg");
  if (feature === "settings") return withBasePath("/assets/settings.svg");
  return withBasePath(`/api/feature-icon/${encodeURIComponent(feature)}`);
};

export const SidebarNavItem = ({ feature, activeFeature, setActiveFeature, onMoveFeature, onOpenSettings }: SidebarNavItemProps) => {
  const iconStyle = { "--feature-icon": `url(${getFeatureIconSrc(feature)})` } as CSSProperties;

  return (
    <button
      type="button"
      className={[
        styles.navButton,
        activeFeature === feature && styles.navButtonActive,
        (feature === "workspace" || feature === "settings") && styles.navButtonFixed
      ].filter(Boolean).join(" ")}
      style={iconStyle}
      draggable={feature !== "workspace" && feature !== "settings"}
      aria-label={getFeatureLabel(feature)}
      aria-pressed={activeFeature === feature}
      title={getFeatureLabel(feature)}
      onClick={() => {
        setActiveFeature(feature);
        if (feature === "settings") onOpenSettings?.();
      }}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", feature)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const draggedFeature = event.dataTransfer.getData("text/plain");
        if (draggedFeature) onMoveFeature(draggedFeature, feature);
      }}
    />
  );
};
