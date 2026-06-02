import { useState } from 'react';
import { usePwaInstall } from '../../../contexts/usePwaInstall';
import { usePushNotifications } from '../../../contexts/usePushNotifications';

const formatarNomeVisivel = (nomeCompleto) => {
  if (!nomeCompleto) return '';
  const partes = String(nomeCompleto).trim().split(/\s+/);
  const nomeCurto = partes.slice(0, 2).join(' ');
  if (nomeCurto.length <= 24 && partes.length <= 2) return nomeCurto;
  if (nomeCurto.length <= 21) return `${nomeCurto}...`;
  return `${nomeCurto.slice(0, 21).trimEnd()}...`;
};

function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    user: <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .92V20.5a2 2 0 1 1-4 0v-.18a1.7 1.7 0 0 0-1-.92 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.92-1H3.5a2 2 0 1 1 0-4h.18a1.7 1.7 0 0 0 .92-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.92V3.5a2 2 0 1 1 4 0v.18a1.7 1.7 0 0 0 1 .92 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.4.16.72.48.92 1h.18a2 2 0 1 1 0 4h-.18a1.7 1.7 0 0 0-.92 1Z" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></>,
    bug: <><path d="m8 2 1.5 2h5L16 2" /><path d="M19 8h2" /><path d="M3 8h2" /><path d="M19 14h2" /><path d="M3 14h2" /><path d="M7 8v8a5 5 0 0 0 10 0V8Z" /><path d="M10 8V5h4v3" /></>,
    bell: <><path d="M10 21h4" /><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.user}
    </svg>
  );
}

function MenuButton({ children, badge, onClick, disabled = false, danger = false, icon = null, sub = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-[10px] border p-3 text-left transition-all ${
        danger
          ? 'border-red-500/20 bg-red-500/5 text-red-400'
          : disabled
            ? 'border-[#27272a] bg-[#121212]/40 text-zinc-500 opacity-80 cursor-not-allowed'
            : 'border-[#27272a] bg-[#121212] text-white active:scale-[0.99]'
      }`}
    >
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2c281b] text-[#d5b451]">
              {icon}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{children}</span>
            {sub && <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{sub}</span>}
          </span>
        </span>
        {badge && (
          <span className={`shrink-0 rounded px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${disabled ? 'bg-[#27272a] text-zinc-400' : 'bg-[#d5b451] text-black'}`}>
            {badge}
          </span>
        )}
      </span>
    </button>
  );
}

function SupportButton({ label, icon, onClick, disabled = false, sub = null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-[10px] border p-3 text-left active:scale-[0.99] ${
        disabled
          ? 'cursor-not-allowed border-[#27272a] bg-[#121212]/40 text-zinc-500'
          : 'border-[#27272a] bg-[#121212] text-white'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${disabled ? 'bg-[#181818] text-zinc-600' : 'bg-[#2c281b] text-[#d5b451]'}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{label}</span>
        {sub && <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{sub}</span>}
      </span>
    </button>
  );
}

export default function DrawerClientes({
  isOpen,
  onClose,
  dados,
  editandoNome,
  setEditandoNome,
  novoNome,
  setNovoNome,
  salvarNovoNome,
  LIMITE_ALTERACOES,
  planosDb,
  alterarPlano,
  cancelarAgendamento,
  onLogout,
  tipoCliente,
  onPagarPlano,
  onHistoricoCompleto,
  onRedefinirSenha,
  whatsappBarbearia,
}) {
  const [planosAbertos, setPlanosAbertos] = useState(false);
  const [modalConfiguracoesAberto, setModalConfiguracoesAberto] = useState(false);
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const { canInstall, installApp } = usePwaInstall();
  const {
    visible: pushVisible,
    available: pushAvailable,
    configured: pushConfigured,
    supported: pushSupported,
    enabled: pushEnabled,
    permission: pushPermission,
    status: pushStatus,
    enablePush,
  } = usePushNotifications();

  if (!dados) return null;

  const instalarApp = async () => {
    await installApp();
    setModalConfiguracoesAberto(false);
    onClose();
  };

  const ativarNotificacoes = async () => {
    if (!pushAvailable) return;
    if (pushEnabled) return;
    await enablePush();
  };

  const abrirPerfil = () => {
    setModalPerfilAberto(true);
    setEditandoNome(false);
    setNovoNome(dados.nome || '');
  };

  const falarComBarbeiro = () => {
    if (!whatsappBarbearia) return;
    const texto = `Olá! Sou ${dados.nome || 'cliente'} e preciso falar com a barbearia.`;
    window.open(`https://wa.me/${whatsappBarbearia}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const reportarBug = () => {
    if (!whatsappBarbearia) return;
    const texto = `Olá! Quero reportar um problema no app.\nCliente: ${dados.nome || '-'}\nDescreva aqui o que aconteceu:`;
    window.open(`https://wa.me/${whatsappBarbearia}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const notificacaoLabel = (() => {
    if (!pushConfigured) return 'Configurar notificações';
    if (!pushSupported) return 'Notificações indisponíveis';
    if (pushPermission === 'denied' || pushStatus === 'denied') return 'Notificações bloqueadas';
    if (pushEnabled) return 'Notificações ativas';
    return 'Ativar notificações';
  })();

  const notificacaoBadge = (() => {
    if (!pushConfigured) return 'Env';
    if (!pushSupported) return 'Off';
    if (pushPermission === 'denied' || pushStatus === 'denied') return 'Bloq';
    if (pushEnabled) return 'On';
    return 'Push';
  })();

  const statusLabel = dados.status === 'ativa' ? 'Ativa' : dados.status ? 'Pendente' : 'Sem plano ativo';
  const statusClass = dados.status === 'ativa' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : dados.status ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-zinc-500 bg-[#171717] border-[#333]';
  const planoPendente = tipoCliente === 'pendente' || dados.status === 'pendente';

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>

      <div className={`absolute left-0 top-0 bottom-0 flex w-[82%] max-w-[330px] flex-col border-r border-[#2b2b2b] bg-[#0c0c0c] transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-[#222] p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#d5b451]/70 bg-[#2c281b] text-[#f0d36e] font-medium">
                {dados.iniciais}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-white" title={dados.nome}>{formatarNomeVisivel(dados.nome)}</h2>
                <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#333] bg-[#181818] text-zinc-500 active:scale-95">
              x
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Conta</p>
            <div className="space-y-3">
              <MenuButton onClick={abrirPerfil} icon={<Icon name="user" />} sub="Dados, nome e senha">
                Meu perfil
              </MenuButton>
              <MenuButton onClick={onHistoricoCompleto} badge="Ver" icon={<Icon name="history" />} sub="Cortes e agendamentos">
                Histórico completo
              </MenuButton>
            </div>
          </div>

          {tipoCliente === 'pendente' && (
            <div className="mt-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pagamento</p>
              <MenuButton onClick={onPagarPlano} badge="Pix">
                Pagar plano
              </MenuButton>
            </div>
          )}

          {tipoCliente !== 'avulso' && (
            <div className="mt-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plano</p>
              {planoPendente ? (
                <div className="rounded-[10px] border border-[#d5b451]/25 bg-[#151207] p-3">
                  <p className="text-sm font-black text-white">Plano pendente</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Aguarde a confirmação do pagamento antes de trocar o plano solicitado.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPlanosAbertos(!planosAbertos)}
                  className="flex w-full items-center justify-between rounded-[10px] border border-[#27272a] bg-[#121212] p-3 text-white"
                >
                  <span className="text-sm font-bold">Trocar meu plano</span>
                  <span className={`text-zinc-500 transition-transform ${planosAbertos ? 'rotate-180' : ''}`}>⌄</span>
                </button>
              )}

              {!planoPendente && planosAbertos && (
                <div className="mt-3 space-y-2">
                  {planosDb.map((plano) => (
                    <button
                      key={plano.id}
                      type="button"
                      onClick={() => alterarPlano(plano.slug)}
                      className={`flex w-full items-center justify-between rounded-[10px] border p-3 text-left ${
                        dados.planoId === plano.slug ? 'border-[#d5b451] bg-[#2c281b]' : 'border-[#27272a] bg-[#121212]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-bold ${dados.planoId === plano.slug ? 'text-[#d5b451]' : 'text-white'}`}>{plano.nome}</p>
                        <p className="text-[10px] text-zinc-500">{formatarMoeda(plano.preco)}/mês</p>
                      </div>
                      {dados.planoId === plano.slug ? (
                        <span className="rounded bg-[#d5b451] px-2 py-1 text-[9px] font-black text-black">Atual</span>
                      ) : dados.proximoPlano === plano.slug ? (
                        <span className="rounded border border-[#d5b451]/30 px-2 py-1 text-[8px] font-bold uppercase text-[#d5b451]">Agendado</span>
                      ) : null}
                    </button>
                  ))}

                  {dados.proximoPlano && (
                    <button type="button" onClick={cancelarAgendamento} className="w-full rounded-[10px] border border-[#27272a] py-3 text-[10px] font-bold uppercase text-zinc-500">
                      Cancelar agendamento
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 border-t border-[#1f1f1f] pt-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Suporte</p>
            <div className="space-y-3">
              <SupportButton label="Falar com o barbeiro" icon={<Icon name="message" />} onClick={falarComBarbeiro} />
              <SupportButton label="Configurações" icon={<Icon name="settings" />} onClick={() => setModalConfiguracoesAberto(true)} />
              <SupportButton label="Reportar um bug" sub="Em breve" icon={<Icon name="bug" />} onClick={reportarBug} disabled />
            </div>
          </div>
        </div>

        <div className="border-t border-[#222] bg-[#0c0c0c] p-3">
          <MenuButton onClick={onLogout} danger>
            Sair da conta
          </MenuButton>
        </div>
      </div>

      {modalConfiguracoesAberto && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[390px] rounded-[24px] border border-[#2b2b2b] bg-[#101010] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d5b451]">Configurações</p>
                <h3 className="mt-1 text-xl font-black text-white">Sistema</h3>
              </div>
              <button type="button" onClick={() => setModalConfiguracoesAberto(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1c1c1c] text-zinc-500">
                x
              </button>
            </div>

            <div className="space-y-3">
              <MenuButton
                onClick={ativarNotificacoes}
                disabled={pushEnabled || !pushVisible || !pushAvailable || pushStatus === 'saving' || pushPermission === 'denied'}
                badge={notificacaoBadge}
                icon={<Icon name="bell" />}
                sub={pushEnabled ? 'Este aparelho recebera avisos' : 'Receber avisos do sistema'}
              >
                {notificacaoLabel}
              </MenuButton>
              <MenuButton onClick={instalarApp} disabled={!canInstall} badge={canInstall ? 'App' : 'OK'} icon={<Icon name="download" />} sub={canInstall ? 'Adicionar na tela inicial' : 'Instalação indisponível ou já feita'}>
                Instalar sistema
              </MenuButton>
            </div>
          </div>
        </div>
      )}

      {modalPerfilAberto && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[86vh] w-full max-w-[390px] overflow-y-auto rounded-[24px] border border-[#2b2b2b] bg-[#101010] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d5b451]">Conta</p>
                <h3 className="mt-1 text-xl font-black text-white">Meu perfil</h3>
              </div>
              <button type="button" onClick={() => setModalPerfilAberto(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1c1c1c] text-zinc-500">
                x
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-[14px] border border-[#27272a] bg-[#151515] p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d5b451]/70 bg-[#2c281b] text-[#f0d36e]">
                {dados.iniciais}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">{formatarNomeVisivel(dados.nome)}</p>
                <p className="mt-1 text-xs text-zinc-500">{statusLabel}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[14px] border border-[#27272a] bg-[#121212] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nome do cliente</p>
                  {!editandoNome && dados.alteracoesNome < LIMITE_ALTERACOES && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoNome(true);
                        setNovoNome(dados.nome);
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-[#d5b451]"
                    >
                      Editar
                    </button>
                  )}
                </div>

                {editandoNome ? (
                  <div>
                    <p className="mb-3 text-[9px] font-bold uppercase tracking-widest text-orange-400">
                      Restam {LIMITE_ALTERACOES - dados.alteracoesNome} alterações
                    </p>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={novoNome}
                        onChange={(event) => setNovoNome(event.target.value)}
                        placeholder="Digite seu nome completo"
                        className="min-w-0 flex-1 rounded-lg border border-[#333] bg-[#090909] px-3 py-2 text-sm text-white outline-none focus:border-[#d5b451]/60"
                      />
                      <button type="button" onClick={salvarNovoNome} className="rounded-lg bg-[#d5b451] px-4 py-2 text-xs font-bold text-black">
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="truncate text-sm font-bold text-white">{dados.nome}</p>
                )}
              </div>

              <MenuButton onClick={onRedefinirSenha} icon={<Icon name="lock" />} sub="Alterar ou recuperar acesso">
                Trocar senha
              </MenuButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatarMoeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(0)}`;
}
