import { Icon } from './ClienteDashboardParts';

function TopBar({ onMenu, empresaNome }) {
  return (
    <div className="client-topbar">
      <button onClick={onMenu} className="ib">
        <Icon name="menu" />
      </button>
      <div className="client-brand">
        {empresaNome}
      </div>
      <button className="ib notif-dot">
        <Icon name="bell" />
      </button>
    </div>
  );
}

export default function ClienteShell({ children, onMenu, empresaNome }) {
  return (
    <div className="client-page-root">
      <div className="client-device">
        <TopBar onMenu={onMenu} empresaNome={empresaNome} />
        {children}
      </div>
    </div>
  );
}
