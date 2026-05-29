import { useState } from 'react';
import { usePwaInstall } from '../../../contexts/usePwaInstall';
import { usePushNotifications } from '../../../contexts/usePushNotifications';

const formatarNomeVisivel = (nomeCompleto) => {
  if (!nomeCompleto) return '';
  const partes = nomeCompleto.trim().split(/\s+/);
  return partes.length <= 2 ? partes.join(' ') : `${partes[0]} ${partes[1]}...`;
};

function MenuButton({ children, badge, onClick, disabled = false, danger = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full p-3 rounded-[10px] border flex items-center justify-between text-left transition-all ${
        danger
          ? 'border-red-500/20 bg-red-500/5 text-red-400'
          : disabled
            ? 'border-[#27272a] bg-[#121212]/40 text-zinc-500 opacity-80 cursor-not-allowed'
            : 'border-[#27272a] bg-[#121212] text-white active:scale-[0.99]'
      }`}
    >
      <span className="font-bold text-sm">{children}</span>
      {badge && (
        <span className={`text-[8px] px-2 py-1 rounded font-bold uppercase tracking-widest ${disabled ? 'bg-[#27272a] text-zinc-400' : 'bg-[#d5b451] text-black'}`}>
          {badge}
        </span>
      )}
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
  agendamentoAtivo = false,
  tipoCliente,
  onAgendar,
  onPagarPlano,
  onHistoricoCompleto,
}) {
  const [planosAbertos, setPlanosAbertos] = useState(false);
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
    sendTestPush,
    sendDelayedTestPush,
  } = usePushNotifications();

  if (!dados) return null;

  const instalarApp = async () => {
    await installApp();
    onClose();
  };

  const ativarNotificacoes = async () => {
    if (!pushAvailable) return;

    if (pushEnabled) {
      await sendTestPush();
      return;
    }

    await enablePush();
  };

  const testarNotificacaoAtrasada = async () => {
    if (!pushAvailable || !pushEnabled) return;
    await sendDelayedTestPush();
  };

  const notificacaoLabel = (() => {
    if (!pushConfigured) return 'Configurar notificacoes';
    if (!pushSupported) return 'Notificacoes indisponiveis';
    if (pushPermission === 'denied' || pushStatus === 'denied') return 'Notificacoes bloqueadas';
    if (pushEnabled) return 'Enviar teste push';
    return 'Ativar notificacoes';
  })();

  const notificacaoBadge = (() => {
    if (!pushConfigured) return 'Env';
    if (!pushSupported) return 'Off';
    if (pushPermission === 'denied' || pushStatus === 'denied') return 'Bloq';
    if (pushEnabled) return 'Teste';
    return 'Push';
  })();

  const statusLabel = dados.status === 'ativa' ? 'Ativa' : dados.status ? 'Pendente' : 'Sem plano ativo';
  const statusClass = dados.status === 'ativa' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : dados.status ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-zinc-500 bg-[#171717] border-[#333]';

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>

      <div className={`absolute left-0 top-0 bottom-0 w-[82%] max-w-[330px] bg-[#0c0c0c] border-r border-[#2b2b2b] flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[#222]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="w-14 h-14 rounded-full bg-[#2c281b] border border-[#d5b451]/70 flex items-center justify-center text-[#f0d36e] font-medium mb-3">
                {dados.iniciais}
              </div>
              <h2 className="text-lg font-black text-white">{formatarNomeVisivel(dados.nome)}</h2>
              <p className="text-xs text-zinc-500 mt-1">{dados.whatsapp}</p>
              <span className={`inline-flex mt-3 border rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#181818] border border-[#333] text-zinc-500 flex items-center justify-center active:scale-95">
              x
            </button>
          </div>

          <div className="mt-5">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Nome do cliente</p>
              {!editandoNome && dados.alteracoesNome < LIMITE_ALTERACOES && (
                <button
                  onClick={() => {
                    setEditandoNome(true);
                    setNovoNome(dados.nome);
                  }}
                  className="text-[#d5b451] text-[10px] font-bold uppercase tracking-widest"
                >
                  Editar
                </button>
              )}
            </div>

            {editandoNome && (
              <div className="bg-[#151515] border border-[#2b2b2b] rounded-[10px] p-3">
                <p className="text-[9px] text-orange-400 font-bold uppercase tracking-widest mb-3">
                  Restam {LIMITE_ALTERACOES - dados.alteracoesNome} alterações
                </p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={novoNome}
                    onChange={e => setNovoNome(e.target.value)}
                    placeholder="Digite seu nome completo"
                    className="flex-1 min-w-0 bg-[#090909] border border-[#333] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#d5b451]/60"
                  />
                  <button onClick={salvarNovoNome} className="bg-[#d5b451] text-black px-4 py-2 rounded-lg text-xs font-bold">
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Ações rápidas</p>
            <div className="space-y-3">
              {tipoCliente !== 'avulso' && (
                <MenuButton onClick={onAgendar} disabled={!agendamentoAtivo} badge={agendamentoAtivo ? 'Abrir' : 'Off'}>
                  Agendamento
                </MenuButton>
              )}
              {tipoCliente === 'pendente' && (
                <MenuButton onClick={onPagarPlano} badge="Pix">
                  Pagar plano
                </MenuButton>
              )}
              <MenuButton onClick={onHistoricoCompleto} badge="Ver">
                Historico completo
              </MenuButton>
              {canInstall && (
                <MenuButton onClick={instalarApp} badge="App">
                  Instalar app
                </MenuButton>
              )}
              {pushVisible && (
                <MenuButton
                  onClick={ativarNotificacoes}
                  disabled={!pushAvailable || ['saving', 'testing', 'testing-delayed'].includes(pushStatus) || pushPermission === 'denied'}
                  badge={notificacaoBadge}
                >
                  {notificacaoLabel}
                </MenuButton>
              )}
              {pushVisible && pushEnabled && (
                <MenuButton
                  onClick={testarNotificacaoAtrasada}
                  disabled={!pushAvailable || ['saving', 'testing', 'testing-delayed'].includes(pushStatus)}
                  badge="1 min"
                >
                  Teste push em 1 min
                </MenuButton>
              )}
            </div>
          </div>

          {tipoCliente !== 'avulso' && (
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Plano</p>
              <button
                onClick={() => setPlanosAbertos(!planosAbertos)}
                className="w-full p-3 rounded-[10px] border border-[#27272a] bg-[#121212] flex justify-between items-center text-white"
              >
                <span className="font-bold text-sm">Trocar meu plano</span>
                <span className={`text-zinc-500 transition-transform ${planosAbertos ? 'rotate-180' : ''}`}>⌄</span>
              </button>

              {planosAbertos && (
                <div className="mt-3 space-y-2">
                  {planosDb.map(p => (
                    <button
                      key={p.id}
                      onClick={() => alterarPlano(p.slug)}
                      className={`w-full p-3 rounded-[10px] border text-left flex justify-between items-center ${
                        dados.planoId === p.slug ? 'border-[#d5b451] bg-[#2c281b]' : 'border-[#27272a] bg-[#121212]'
                      }`}
                    >
                      <div>
                        <p className={`font-bold text-sm ${dados.planoId === p.slug ? 'text-[#d5b451]' : 'text-white'}`}>{p.nome}</p>
                        <p className="text-[10px] text-zinc-500">{formatarMoeda(p.preco)}/mês</p>
                      </div>
                      {dados.planoId === p.slug ? (
                        <span className="bg-[#d5b451] text-black text-[9px] font-black px-2 py-1 rounded">Atual</span>
                      ) : dados.proximoPlano === p.slug ? (
                        <span className="text-[8px] text-[#d5b451] font-bold uppercase border border-[#d5b451]/30 px-2 py-1 rounded">Agendado</span>
                      ) : null}
                    </button>
                  ))}

                  {dados.proximoPlano && (
                    <button onClick={cancelarAgendamento} className="w-full text-zinc-500 text-[10px] font-bold uppercase py-3 border border-[#27272a] rounded-[10px]">
                      Cancelar agendamento
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#222]">
          <MenuButton onClick={onLogout} danger>
            Sair da conta
          </MenuButton>
        </div>
      </div>
    </div>
  );
}

function formatarMoeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(0)}`;
}
