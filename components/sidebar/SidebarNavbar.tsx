import type { FeatureName } from "@/lib/features";
import styles from "./Sidebar.module.css";
import { SidebarNavItem } from "./SidebarNavItem";

type SidebarNavbarProps = {
  activeFeature: FeatureName;
  featureOrder: FeatureName[];
  setActiveFeature: (feature: FeatureName) => void;
  onMoveFeature: (feature: FeatureName, targetFeature: FeatureName) => void;
  onOpenSettings?: () => void;
};

export const SidebarNavbar = ({ activeFeature, featureOrder, setActiveFeature, onMoveFeature, onOpenSettings }: SidebarNavbarProps) => {
  return (
    <nav className={styles.navbar} aria-label="Features">
      <SidebarNavItem
        feature="workspace"
        activeFeature={activeFeature}
        setActiveFeature={setActiveFeature}
        onMoveFeature={onMoveFeature}
      />
      {featureOrder.map((feature) => (
        <SidebarNavItem
          key={feature}
          feature={feature}
          activeFeature={activeFeature}
          setActiveFeature={setActiveFeature}
          onMoveFeature={onMoveFeature}
        />
      ))}
      <SidebarNavItem
        feature="settings"
        activeFeature={activeFeature}
        setActiveFeature={setActiveFeature}
        onMoveFeature={onMoveFeature}
        onOpenSettings={onOpenSettings}
      />
    </nav>
  );
};
