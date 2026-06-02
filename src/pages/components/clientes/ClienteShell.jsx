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
      <div className="ib invisible" aria-hidden="true" />
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
