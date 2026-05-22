import { formatarMoeda } from './clienteDashboardUtils';

export function Icon({ name, className = 'w-5 h-5' }) {
  const icons = {
    menu: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    crown: <><path d="m2 8 4 10h12l4-10-6 4-4-7-4 7-6-4z" /><path d="M6 18h12" /></>,
    scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9" /><path d="M14.5 14.5 20 20" /><path d="M8.1 8.1 12 12" /></>,
    tool: <><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.8-2.8 2.2-2.6z" /></>,
    sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="m5 3 .7 2.3L8 6l-2.3.7L5 9l-.7-2.3L2 6l2.3-.7L5 3z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" /></>,
    calendar: <><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    whatsapp: <><path d="M3 21 4.8 16.3A8.5 8.5 0 1 1 8 19.2L3 21z" /><path d="M9 9c.2 3 2.8 5.3 6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.sparkles}
    </svg>
  );
}

export function HeroCard({ dados, sub, status, compact = false }) {
  return (
    <div className={`card hero ${compact ? 'compact' : ''}`}>
      <div className="av">{dados.iniciais}</div>
      <div>
        <div className="hero-name">{dados.nome}</div>
        <div className="hero-sub">{sub}</div>
        <span className={`plan-pill ${status.variant || ''}`}>
          {status.icon && <Icon name={status.icon} className="w-3 h-3" />}
          {status.label}
        </span>
      </div>
    </div>
  );
}

export function AlertBox({ type = 'gold', icon = 'crown', children }) {
  return (
    <div className={`alert ${type}`}>
      <Icon name={icon} className="w-5 h-5 flex-shrink-0" />
      <div className="alert-txt">{children}</div>
    </div>
  );
}

export function SectionTitle({ children, action, onAction }) {
  return (
    <div className="sec">
      <span>{children}</span>
      {action && <span onClick={onAction} className="sec-link">{action}</span>}
    </div>
  );
}

export function ServiceRow({ servico, onClick }) {
  const nome = servico?.nome?.toLowerCase() || '';
  const icon = nome.includes('barba') ? 'tool' : nome.includes('combo') || nome.includes('&') ? 'sparkles' : 'scissors';

  return (
    <button onClick={onClick} className="sopt">
      <div className="sopt-ico">
        <Icon name={icon} />
      </div>
      <div>
        <div className="sopt-name">{servico.nome}</div>
        <p className="sopt-sub">{formatarMoeda(servico.preco)} · ~{servico.duracao_minutos || 30} min</p>
      </div>
      <Icon name="chevron" className="w-4 h-4 text-zinc-600 ml-auto" />
    </button>
  );
}

export function StatCard({ label, children }) {
  return (
    <div className="bg-[#1b1b1b] border border-[#333] rounded-[14px] p-4">
      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-3">{label}</p>
      {children}
    </div>
  );
}
