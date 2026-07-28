import type { DragEvent } from "react";
import { SidebarNavItem } from "./SidebarNavItemOLD.jsx";
import styles from "./Sidebar.module.css";

const noopDragHandler = () => {};

interface SidebarNavbarItem {
  id: string;
  label: string;
  iconSrc: string;
}

interface SidebarNavbarProps {
  homeTab: SidebarNavbarItem;
  settingsTab: SidebarNavbarItem;
  tabs: SidebarNavbarItem[];
  activeTab: string;
  dragOverId: string | null;
  onSelectTab: (id: string) => void;
  onOpenSettings: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>, id: string) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>, id: string) => void;
  onDragEnd: () => void;
}

export function SidebarNavbar({
  homeTab,
  settingsTab,
  tabs,
  activeTab,
  dragOverId,
  onSelectTab,
  onOpenSettings,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: SidebarNavbarProps) {
  return (
    <nav className={styles.navbar} aria-label="Feature Bar">
      <SidebarNavItem
        tab={homeTab.id}
        label={homeTab.label}
        iconSrc={homeTab.iconSrc}
        active={activeTab === homeTab.id}
        dragOver={false}
        draggable={false}
        fixed
        onClick={onSelectTab}
        onDragStart={noopDragHandler}
        onDragOver={noopDragHandler}
        onDrop={noopDragHandler}
        onDragEnd={noopDragHandler}
      />
      {tabs.map(({ id, label, iconSrc }) => (
        <SidebarNavItem
          key={id}
          tab={id}
          label={label}
          iconSrc={iconSrc}
          active={activeTab === id}
          dragOver={dragOverId === id}
          onClick={onSelectTab}
          onDragStart={() => onDragStart(id)}
          onDragOver={(event) => onDragOver(event, id)}
          onDrop={(event) => onDrop(event, id)}
          onDragEnd={onDragEnd}
        />
      ))}
      <SidebarNavItem
        tab={settingsTab.id}
        label={settingsTab.label}
        iconSrc={settingsTab.iconSrc}
        className={styles.navbarSettingsButton}
        active={false}
        dragOver={false}
        draggable={false}
        fixed
        onClick={onOpenSettings}
        onDragStart={noopDragHandler}
        onDragOver={noopDragHandler}
        onDrop={noopDragHandler}
        onDragEnd={noopDragHandler}
      />
    </nav>
  );
}
