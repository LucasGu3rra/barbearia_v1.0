import { useState } from 'react';
import { usePwaInstall } from '../../contexts/usePwaInstall';
import { usePushNotifications } from '../../contexts/usePushNotifications';

export default function DrawerAdmin({ 
  isOpen, 
  onClose, 
  onLogout, 
  dadosFinanceiros,
  onOpenPlanos,
  onOpenFiliais,
  onOpenBarbeiros,
  onOpenServicos,
  onOpenConfiguracoes,
  onOpenHistorico, // Nova prop para o Histórico
}) {
  const [modalFinanceiro, setModalFinanceiro] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
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
  } = usePushNotifications();

  if (!isOpen) return null;

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const handleConfigItem = (acao) => {
    if (acao) {
      onClose();
      acao();
    }
  };

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

  const notificacaoLabel = (() => {
    if (!pushConfigured) return 'Configurar notificacoes';
    if (!pushSupported) return 'Notificacoes indisponiveis';
    if (pushPermission === 'denied' || pushStatus === 'denied') return 'Notificacoes bloqueadas';
    if (pushEnabled) return 'Enviar teste push';
    return 'Ativar notificacoes';
  })();

  const notificacaoSubtexto = (() => {
    if (!pushConfigured) return 'Chave VAPID ausente';
    if (!pushSupported) return 'Use HTTPS ou app instalado';
    if (pushPermission === 'denied' || pushStatus === 'denied') return 'Liberar nas configuracoes';
    if (pushEnabled) return 'Enviar para este aparelho';
    return 'Avisos do sistema';
  })();

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-72 bg-[#09090b] border-l border-[#27272a] z-[70] p-6 flex flex-col animate-[slideIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-[#CEAA6B] font-bold uppercase tracking-widest text-sm">Menu Admin</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto">
          {/* Botão Financeiro */}
          <button
            onClick={() => setModalFinanceiro(true)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B] group-hover:bg-[#CEAA6B] group-hover:text-black transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div className="text-left">
              <span className="block font-bold text-sm">Financeiro</span>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Renda e Previsão</span>
            </div>
          </button>

          {/* Botão Planos */}
          {canInstall && (
            <button
              onClick={instalarApp}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B] group-hover:bg-[#CEAA6B] group-hover:text-black transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><rect x="4" y="17" width="16" height="4" rx="1"></rect></svg>
              </div>
              <div className="text-left">
                <span className="block font-bold text-sm">Instalar app</span>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Adicionar na tela inicial</span>
              </div>
            </button>
          )}

          {pushVisible && (
            <button
              onClick={ativarNotificacoes}
              disabled={!pushAvailable || ['saving', 'testing'].includes(pushStatus) || pushPermission === 'denied'}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B] group-hover:bg-[#CEAA6B] group-hover:text-black transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              </div>
              <div className="text-left">
                <span className="block font-bold text-sm">{notificacaoLabel}</span>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">{notificacaoSubtexto}</span>
              </div>
            </button>
          )}

          <button
            onClick={() => { if(onOpenPlanos) onOpenPlanos(); onClose(); }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <div className="text-left">
              <span className="block font-bold text-sm">Planos</span>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Gerenciar Assinaturas</span>
            </div>
          </button>

          {/* NOVO: Botão Histórico */}
          <button
            onClick={() => { if(onOpenServicos) onOpenServicos(); onClose(); }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg>
            </div>
            <div className="text-left">
              <span className="block font-bold text-sm">Serviços</span>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Categorias e Avulsos</span>
            </div>
          </button>

          <button
            onClick={() => { if(onOpenHistorico) onOpenHistorico(); onClose(); }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div className="text-left">
              <span className="block font-bold text-sm">Histórico</span>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Cortes Manuais</span>
            </div>
          </button>

          {/* Botão Configurações (accordion) */}
          <div>
            <button
              onClick={() => setConfigAberto(!configAberto)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group ${configAberto ? 'border-[#CEAA6B]/50' : 'border-[#27272a]'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${configAberto ? 'bg-[#CEAA6B] text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-white group-hover:text-black'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <div className="text-left flex-1">
                <span className="block font-bold text-sm">Configurações</span>
                <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Filiais, Barbeiros e Mais</span>
              </div>
              <svg
                className={`text-zinc-500 transition-transform duration-300 flex-shrink-0 ${configAberto ? 'rotate-180 text-[#CEAA6B]' : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {/* Submenu accordion */}
            <div className={`overflow-hidden transition-all duration-300 ${configAberto ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              <div className="ml-3 space-y-1.5 border-l border-[#27272a] pl-3">

                <button
                  onClick={() => handleConfigItem(onOpenFiliais)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-[#CEAA6B]/10 group-hover:text-[#CEAA6B] transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Filiais</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Gerenciar Unidades</span>
                  </div>
                </button>

                <button
                  onClick={() => handleConfigItem(onOpenBarbeiros)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-[#CEAA6B]/10 group-hover:text-[#CEAA6B] transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Barbeiros</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Gerenciar Profissionais</span>
                  </div>
                </button>

                <button
                  onClick={() => handleConfigItem(onOpenServicos)}
                  className="hidden w-full items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-[#CEAA6B]/10 group-hover:text-[#CEAA6B] transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Serviços</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Gerenciar Serviços Avulsos</span>
                  </div>
                </button>

                <button
                  onClick={() => handleConfigItem(onOpenConfiguracoes)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-[#CEAA6B]/10 group-hover:text-[#CEAA6B] transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Fluxo de Agendamento</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Configurar Jornada</span>
                  </div>
                </button>

              </div>
            </div>
          </div>
        </nav>

        <button onClick={onLogout} className="mt-6 w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/5 text-red-500/60 font-bold text-xs uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sair do Painel
        </button>
      </div>

      {/* Modal Financeiro */}
      {modalFinanceiro && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#27272a] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="relative p-6 pb-0">
              <button
                onClick={() => setModalFinanceiro(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#CEAA6B] flex items-center justify-center text-black shadow-[0_0_15px_rgba(206,170,107,0.2)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">Financeiro</h3>
              </div>
            </div>

            <div className="p-6 pt-2 space-y-4">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#121212] to-[#09090b] p-5 rounded-[24px] border border-[#27272a] group">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#CEAA6B]/5 rounded-full blur-2xl group-hover:bg-[#CEAA6B]/10 transition-all" />
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1.5">Faturamento Atual</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white tracking-tighter">
                    {formatarMoeda(dadosFinanceiros?.faturamentoMensal || 0).split(',')[0]}
                  </span>
                  <span className="text-base font-bold text-[#CEAA6B]">
                    ,{formatarMoeda(dadosFinanceiros?.faturamentoMensal || 0).split(',')[1]}
                  </span>
                </div>
              </div>

              <div className="bg-[#121212]/50 p-5 rounded-[24px] border border-[#27272a] flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-0.5">Previsão Próximo Mês</p>
                  <p className="text-lg font-black text-emerald-500 tracking-tight">{formatarMoeda(dadosFinanceiros?.previsaoProximoMes || 0)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-3 bg-[#121212] rounded-xl border border-[#27272a]">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Assinantes Ativos</span>
                <span className="text-xs font-black text-white">{dadosFinanceiros?.totalAtivos || 0}</span>
              </div>

              <button
                onClick={() => setModalFinanceiro(false)}
                className="w-full bg-white text-black font-black py-4 rounded-[20px] uppercase tracking-[0.2em] text-[9px] active:scale-95 transition-all shadow-[0_8px_15px_rgba(255,255,255,0.1)]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
