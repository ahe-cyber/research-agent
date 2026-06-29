export function SidebarHeader({ kicker, dropdown, action }) {
  return (
    <header className="sidebar-header">
      <div className="sidebar-header__body">
        <span className="sidebar-header__kicker panel-kicker">{kicker}</span>
        <div className="sidebar-header__dropdown">{dropdown}</div>
      </div>
      <div className="sidebar-header__action">{action}</div>
    </header>
  );
}
