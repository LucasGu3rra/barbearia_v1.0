import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { usePwaInstall } from '../../contexts/usePwaInstall';
import { usePushNotifications } from '../../contexts/usePushNotifications';
import { montarRotaEmpresa } from '../../services/empresa';
import {
  carregarNotificacoesCache,
  limparNotificacoesCache,
  mesclarNotificacoesCache,
} from '../../services/notificationCache';
import { supabase } from '../../services/supabase';
import NotificacoesModal from '../components/NotificacoesModal';

const statusVisual = {
  agendado: 'bg-[#d5b451]/10 text-[#d5b451] border-[#d5b451]/20',
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pendente: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  cancelado: 'bg-red-500/10 text-red-400 border-red-500/20',
  finalizado: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const formatarHora = (valor) => {
  if (!valor) return '--:--';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '--:--';
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatarDataCurta = (valor) => {
  if (!valor) return '--/--';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '--/--';
  return data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

const inicioDoDia = (data) => {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
};

const fimDoDia = (data) => {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatarTelefoneWhatsapp = (valor) => {
  const numeros = String(valor || '').replace(/\D/g, '');
  if (!numeros) return '';
  if (numeros.startsWith('55')) return numeros;
  return `55${numeros}`;
};

const textoStatus = (status) => {
  if (!status) return 'Agendado';
  return String(status).replace('_', ' ');
};

const nomeClienteCurto = (nome) => {
  const partes = String(nome || 'Cliente').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || 'Cliente';
  return `${partes[0]} ${partes[1][0]}...`;
};

const bordaModal = {
  borderColor: '#313136',
  borderRadius: '30px',
  clipPath: 'inset(0 round 30px)',
  boxShadow: '0 0 0 1px #121214, 0 24px 80px rgba(0,0,0,0.95)',
};
const bordaCard = { borderColor: '#2a2a2e' };
const limitarDuasLinhas = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const usuarioJaFoiAtualizado = (user) => {
  const criadoEm = user?.created_at ? new Date(user.created_at).getTime() : 0;
  const atualizadoEm = user?.updated_at ? new Date(user.updated_at).getTime() : 0;
  if (!criadoEm || !atualizadoEm) return false;
  return atualizadoEm - criadoEm > 60_000;
};

function AgendamentoDetalhesModal({ agendamento, onClose }) {
  if (!agendamento) return null;

  const whatsapp = formatarTelefoneWhatsapp(agendamento.clientes?.whatsapp);
  const duracao = agendamento.duracao_minutos || agendamento.servicos?.duracao_minutos || 30;
  const status = String(agendamento.status || 'agendado').toLowerCase();

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/72 px-4 pb-0 pt-10">
      <div
        className="max-h-[calc(100dvh-72px)] w-full max-w-[390px] overflow-y-auto rounded-[30px] border bg-[#09090b] p-5 outline-none"
        style={bordaModal}
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-zinc-700" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#d5b451]">Atendimento</p>
            <h2 className="mt-2 max-w-[260px] text-xl font-black leading-tight text-white" style={limitarDuasLinhas}>
              {agendamento.clientes?.nome || 'Cliente'}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">{agendamento.clientes?.whatsapp || 'Sem WhatsApp cadastrado'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#27272a] bg-[#1b1b1b] text-zinc-500 outline-none focus:outline-none focus-visible:outline-none"
            aria-label="Fechar detalhes"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-[20px] border bg-[#18181b] p-4" style={bordaCard}>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Servico</p>
            <p className="mt-2 text-base font-black text-white">{agendamento.servicos?.nome || 'Servico'}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatarDataCurta(agendamento.data_hora)} - {formatarHora(agendamento.data_hora)} - {duracao} min
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[18px] border bg-[#18181b] p-4" style={bordaCard}>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Duracao</p>
              <p className="mt-2 text-lg font-black text-white">{duracao} min</p>
            </div>
            <div className="rounded-[18px] border bg-[#18181b] p-4" style={bordaCard}>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Tipo</p>
              <p className="mt-2 text-lg font-black capitalize text-white">{agendamento.tipo_cliente || 'avulso'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[18px] border bg-[#18181b] p-4" style={bordaCard}>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Filial</p>
              <p className="mt-2 truncate text-sm font-black text-white">{agendamento.filiais?.nome || 'Filial'}</p>
            </div>
            <div className="rounded-[18px] border bg-[#18181b] p-4" style={bordaCard}>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Status</p>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusVisual[status] || statusVisual.agendado}`}>
                {textoStatus(status)}
              </span>
            </div>
          </div>

          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center rounded-[18px] bg-[#d5b451] py-4 text-sm font-black text-black outline-none focus:outline-none focus-visible:outline-none"
            >
              Abrir WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function BarbeiroPerfilModal({ isOpen, onClose, barbeiro, user }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const senhaJaAlterada = Boolean(user?.user_metadata?.senha_alterada_em) || usuarioJaFoiAtualizado(user);
  const emailLogin = user?.email || barbeiro?.email || '';

  if (!isOpen) return null;

  const alterarSenha = async () => {
    setMensagem('');
    setErro('');

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmacao) {
      setErro('As senhas nao conferem.');
      return;
    }

    setSalvando(true);

    if (senhaJaAlterada) {
      if (!senhaAtual) {
        setSalvando(false);
        setErro('Informe sua senha atual.');
        return;
      }

      const { error: erroLogin } = await supabase.auth.signInWithPassword({
        email: emailLogin,
        password: senhaAtual,
      });

      if (erroLogin) {
        setSalvando(false);
        setErro('Senha atual incorreta.');
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({
      password: senha,
      data: {
        ...(user?.user_metadata || {}),
        senha_alterada_em: user?.user_metadata?.senha_alterada_em || new Date().toISOString(),
      },
    });
    setSalvando(false);

    if (error) {
      setErro('Nao foi possivel alterar a senha.');
      return;
    }

    setSenhaAtual('');
    setSenha('');
    setConfirmacao('');
    setMensagem('Senha alterada com sucesso.');
  };

  const recuperarSenha = async () => {
    setMensagem('');
    setErro('');

    if (!emailLogin) {
      setErro('E-mail da conta nao encontrado.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(emailLogin);
    if (error) {
      setErro('Nao foi possivel enviar a recuperacao.');
      return;
    }

    setMensagem('Enviamos a recuperacao para o e-mail da conta.');
  };

  return (
    <div className="fixed inset-0 z-[9500] flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-md">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        aria-label="Fechar perfil"
      />

      <div className="relative w-full max-w-[390px] rounded-[28px] border border-[#27272a] bg-[#09090b] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d5b451]">Perfil</p>
            <h2 className="mt-1 text-xl font-black text-white">Minha conta</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#27272a] bg-[#171717] text-zinc-500"
            aria-label="Fechar perfil"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d5b451]/10 text-sm font-black text-[#d5b451]">
              {(barbeiro?.nome || user?.email || 'BR').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black text-white">{barbeiro?.nome || 'Barbeiro'}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{barbeiro?.email || user?.email || 'Sem e-mail'}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-600">{barbeiro?.filiais?.nome || 'Filial nao vinculada'}</p>
            </div>
          </div>

          <div className="rounded-[22px] border border-[#27272a] bg-[#111111] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Alterar senha</p>
            <div className="mt-4 space-y-3">
              {senhaJaAlterada && (
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Senha atual"
                  className="w-full rounded-[14px] border border-[#27272a] bg-[#09090b] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d5b451]/60"
                />
              )}
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Nova senha"
                className="w-full rounded-[14px] border border-[#27272a] bg-[#09090b] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d5b451]/60"
              />
              <input
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="Confirmar senha"
                className="w-full rounded-[14px] border border-[#27272a] bg-[#09090b] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#d5b451]/60"
              />
              {senhaJaAlterada && (
                <button
                  type="button"
                  onClick={recuperarSenha}
                  className="w-full py-1 text-center text-xs font-bold text-[#d5b451]"
                >
                  Esqueci minha senha
                </button>
              )}
              {erro && <p className="text-xs font-bold text-red-400">{erro}</p>}
              {mensagem && <p className="text-xs font-bold text-emerald-400">{mensagem}</p>}
              <button
                type="button"
                onClick={alterarSenha}
                disabled={salvando}
                className="w-full rounded-[16px] bg-[#d5b451] py-3 text-sm font-black text-black disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarbeiroDrawer({ isOpen, onClose, barbeiro, user, onLogout, onOpenPerfil }) {
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

  if (!isOpen) return null;

  const iniciais = (barbeiro?.nome || user?.email || 'BR').substring(0, 2).toUpperCase();
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

  const notificacaoSubtexto = (() => {
    if (!pushConfigured) return 'Chave VAPID ausente';
    if (!pushSupported) return 'Use HTTPS ou app instalado';
    if (pushPermission === 'denied' || pushStatus === 'denied') return 'Liberar nas configuracoes';
    if (pushEnabled) return 'Enviar para este aparelho';
    return 'Avisos da agenda';
  })();

  return (
    <div
      className="fixed inset-0 z-[9000] bg-black/55 backdrop-blur-md"
      style={{ animation: 'barbeiroDrawerBackdropIn 180ms ease-out both' }}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        aria-label="Fechar menu"
      />

      <aside
        className="absolute right-0 top-0 flex h-full w-[88vw] max-w-[360px] flex-col shadow-2xl"
        style={{
          backgroundColor: '#080809',
          opacity: 1,
          animation: 'barbeiroDrawerIn 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
          willChange: 'transform',
        }}
      >
        <div className="p-5 pb-3">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#d5b451]">Menu</p>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] text-zinc-500"
              aria-label="Fechar menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d5b451]/10 text-base font-black text-[#d5b451]">
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-white">{barbeiro?.nome || 'Barbeiro'}</p>
              <p className="mt-1 truncate text-xs text-zinc-500">{barbeiro?.filiais?.nome || 'Filial nao vinculada'}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pt-6">
          <p className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">Conta</p>
          <div className="h-px bg-[#1f1f22]" />
          <button
            type="button"
            onClick={onOpenPerfil}
            className="relative flex w-full items-center justify-between rounded-[18px] bg-[#101011] px-4 py-3.5 text-left active:scale-[0.99]"
          >
            <span className="absolute left-4 right-4 top-0 h-px bg-[#d5b451]/25" />
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#d5b451]/10 text-[#d5b451]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <div>
                <p className="text-sm font-black text-white">Perfil e senha</p>
                <p className="mt-0.5 text-xs text-zinc-600">Dados da conta</p>
              </div>
            </div>
            <svg className="shrink-0 text-[#d5b451]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          {canInstall && (
            <button
              type="button"
              onClick={instalarApp}
              className="relative flex w-full items-center justify-between rounded-[18px] bg-[#101011] px-4 py-3.5 text-left active:scale-[0.99]"
            >
              <span className="absolute left-4 right-4 top-0 h-px bg-[#d5b451]/25" />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#d5b451]/10 text-[#d5b451]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><rect x="4" y="17" width="16" height="4" rx="1" /></svg>
                </div>
                <div>
                  <p className="text-sm font-black text-white">Instalar app</p>
                  <p className="mt-0.5 text-xs text-zinc-600">Tela inicial</p>
                </div>
              </div>
              <svg className="shrink-0 text-[#d5b451]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
          {pushVisible && (
            <button
              type="button"
              onClick={ativarNotificacoes}
              disabled={!pushAvailable || ['saving', 'testing', 'testing-delayed'].includes(pushStatus) || pushPermission === 'denied'}
              className="relative flex w-full items-center justify-between rounded-[18px] bg-[#101011] px-4 py-3.5 text-left active:scale-[0.99] disabled:opacity-60"
            >
              <span className="absolute left-4 right-4 top-0 h-px bg-[#d5b451]/25" />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#d5b451]/10 text-[#d5b451]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                </div>
                <div>
                  <p className="text-sm font-black text-white">{notificacaoLabel}</p>
                  <p className="mt-0.5 text-xs text-zinc-600">{notificacaoSubtexto}</p>
                </div>
              </div>
              <svg className="shrink-0 text-[#d5b451]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
          {pushVisible && pushEnabled && (
            <button
              type="button"
              onClick={testarNotificacaoAtrasada}
              disabled={!pushAvailable || ['saving', 'testing', 'testing-delayed'].includes(pushStatus)}
              className="relative flex w-full items-center justify-between rounded-[18px] bg-[#101011] px-4 py-3.5 text-left active:scale-[0.99] disabled:opacity-60"
            >
              <span className="absolute left-4 right-4 top-0 h-px bg-[#d5b451]/25" />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#d5b451]/10 text-[#d5b451]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div>
                  <p className="text-sm font-black text-white">Teste push em 1 min</p>
                  <p className="mt-0.5 text-xs text-zinc-600">Feche o app apos clicar</p>
                </div>
              </div>
              <svg className="shrink-0 text-[#d5b451]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
        </div>

        <div className="p-5">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#160d0d] py-4 text-sm font-black text-red-300 active:scale-[0.99]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Sair da conta
          </button>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes barbeiroDrawerIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes barbeiroDrawerBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      ` }} />
    </div>
  );
}

export default function BarbeiroDashboard() {
  const { empresaSlug } = useParams();
  const { user, empresaAtual, papelEmpresa } = useAuth();
  const [barbeiro, setBarbeiro] = useState(null);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const primeiraCargaRef = useRef(true);
  const [dataSelecionada, setDataSelecionada] = useState(() => inicioDoDia(new Date()));
  const [agendamentoAberto, setAgendamentoAberto] = useState(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [agendaAnimacaoId, setAgendaAnimacaoId] = useState(0);
  const [atualizadoAgora, setAtualizadoAgora] = useState(false);
  const [notificacoesAberto, setNotificacoesAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [limpandoNotificacoes, setLimpandoNotificacoes] = useState(false);
  const empresaId = empresaAtual?.id;
  const userId = user?.id;

  const carregarNotificacoes = useCallback(async () => {
    if (!empresaId || !userId) return;

    const notificacoesCache = carregarNotificacoesCache({ empresaId, userId });
    setNotificacoes(notificacoesCache);

    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('notificacoes')
      .select('id, titulo, corpo, tipo, dados, created_at')
      .eq('empresa_id', empresaId)
      .eq('user_id', userId)
      .eq('lida', false)
      .gte('created_at', duasHorasAtras)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Erro ao carregar notificacoes:', error);
      return;
    }

    if (!data?.length) return;

    const notificacoesMescladas = mesclarNotificacoesCache({ empresaId, userId, notificacoes: data });
    setNotificacoes(notificacoesMescladas);

    await supabase
      .from('notificacoes')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('user_id', userId)
      .in('id', data.map((notificacao) => notificacao.id));
  }, [empresaId, userId]);

  const abrirNotificacoes = async () => {
    await carregarNotificacoes();
    setNotificacoesAberto(true);
  };

  const limparNotificacoes = async () => {
    if (!empresaId || !userId || notificacoes.length === 0) return;
    setLimpandoNotificacoes(true);
    limparNotificacoesCache({ empresaId, userId });
    setNotificacoes([]);

    const { error } = await supabase
      .from('notificacoes')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('user_id', userId);

    if (error) console.error('Erro ao limpar notificacoes:', error);
    setLimpandoNotificacoes(false);
  };

  useEffect(() => {
    let ativo = true;
    let timeoutAtualizacao = null;

    const carregarDados = async ({ realtime = false } = {}) => {
      if (!empresaAtual?.id || !user?.id) return;

      if (primeiraCargaRef.current) setLoading(true);

      const inicio = inicioDoDia(dataSelecionada).toISOString();
      const fim = fimDoDia(dataSelecionada).toISOString();

      await supabase.rpc('finalizar_agendamentos_vencidos', { p_empresa_id: empresaAtual.id });

      const [{ data: dadosBarbeiro }, { data: dadosAgenda }] = await Promise.all([
        supabase
          .from('barbeiros')
          .select('id, nome, email, ativo, filiais(nome)')
          .eq('empresa_id', empresaAtual.id)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('agendamentos')
          .select('id, data_hora, status, tipo_cliente, duracao_minutos, clientes(nome, whatsapp), servicos(nome, preco, duracao_minutos), filiais(nome)')
          .eq('empresa_id', empresaAtual.id)
          .gte('data_hora', inicio)
          .lte('data_hora', fim)
          .not('status', 'eq', 'cancelado')
          .order('data_hora', { ascending: true }),
      ]);

      if (!ativo) return;
      setBarbeiro(dadosBarbeiro || null);
      setAgendamentos(dadosAgenda || []);
      setAgendaAnimacaoId((atual) => atual + 1);
      primeiraCargaRef.current = false;
      setLoading(false);

      if (realtime) {
        setAtualizadoAgora(true);
        timeoutAtualizacao = setTimeout(() => {
          if (ativo) setAtualizadoAgora(false);
        }, 1800);
      }
    };

    carregarDados();

    const channel = empresaAtual?.id
      ? supabase
        .channel(`barbeiro-agenda-${empresaAtual.id}-${user?.id || 'anon'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => carregarDados({ realtime: true }))
        .subscribe()
      : null;

    return () => {
      ativo = false;
      if (timeoutAtualizacao) clearTimeout(timeoutAtualizacao);
      if (channel) supabase.removeChannel(channel);
    };
  }, [dataSelecionada, empresaAtual, user]);

  useEffect(() => {
    Promise.resolve().then(() => carregarNotificacoes());
  }, [carregarNotificacoes]);

  const proximosDias = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => {
      const data = inicioDoDia(new Date());
      data.setDate(data.getDate() + index);
      return data;
    })
  ), []);

  const agora = new Date();
  const proximoAgendamento = agendamentos.find((item) => new Date(item.data_hora) >= agora) || agendamentos[0] || null;
  const totalFinalizados = agendamentos.filter((item) => ['finalizado', 'concluido'].includes(String(item.status || '').toLowerCase())).length;
  const totalNotificacoes = notificacoes.length;

  if (empresaAtual && empresaAtual.slug !== empresaSlug) return null;
  if (papelEmpresa && papelEmpresa !== 'barbeiro') {
    return <Navigate to={montarRotaEmpresa(empresaSlug, '')} replace />;
  }

  const sair = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <main className="mx-auto min-h-screen w-full max-w-[430px] px-4 py-5 pb-8">
        <header className="flex items-center justify-between border-b border-[#1f1f22] pb-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#d5b451]">Agenda do barbeiro</p>
          </div>
          <div className="ml-3 flex items-center gap-2">
            <button
              type="button"
              onClick={abrirNotificacoes}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#27272a] bg-[#121212] text-zinc-400"
              aria-label="Abrir notificacoes"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {totalNotificacoes > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d5b451] px-1 text-[10px] font-black text-black">
                  {totalNotificacoes > 9 ? '9+' : totalNotificacoes}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDrawerAberto(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#27272a] bg-[#121212] text-zinc-400"
              aria-label="Abrir menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
            </button>
          </div>
        </header>

        {loading ? (
          <p className="py-10 text-center text-sm text-zinc-500">Carregando agenda...</p>
        ) : (
          <div key={agendaAnimacaoId} className="space-y-5 pt-5" style={{ animation: 'barbeiroAgendaIn 220ms ease-out both' }}>
            <section className="rounded-[24px] border border-[#27272a] bg-[#171717] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d5b451]/60 bg-[#d5b451]/10 text-sm font-black text-[#d5b451]">
                  {(barbeiro?.nome || user?.email || 'BR').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black">{barbeiro?.nome || user?.email}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{barbeiro?.filiais?.nome || 'Filial nao vinculada'}</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[18px] border border-[#27272a] bg-[#171717] p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Hoje</p>
                <p className="mt-2 text-2xl font-black">{agendamentos.length}</p>
              </div>
              <div className="rounded-[18px] border border-[#27272a] bg-[#171717] p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Feitos</p>
                <p className="mt-2 text-2xl font-black">{totalFinalizados}</p>
              </div>
              <div className="rounded-[18px] border border-[#27272a] bg-[#171717] p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Proximo</p>
                <p className="mt-2 text-lg font-black">{proximoAgendamento ? formatarHora(proximoAgendamento.data_hora) : '--:--'}</p>
              </div>
            </div>

            <section className="rounded-[18px] border border-[#27272a] bg-[#111111] p-3">
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#d5b451]">Proximo atendimento</p>
              {proximoAgendamento ? (
                <button
                  type="button"
                  onClick={() => setAgendamentoAberto(proximoAgendamento)}
                  className="mt-2 block w-full rounded-[14px] border border-[#d5b451]/30 bg-[#d5b451]/10 px-3 py-2.5 text-left outline-none active:scale-[0.99] focus:outline-none focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black leading-tight text-white">{nomeClienteCurto(proximoAgendamento.clientes?.nome)}</p>
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <p className="truncate text-lg font-black leading-tight text-white">{proximoAgendamento.servicos?.nome || 'Servico'}</p>
                        <span className="shrink-0 text-[11px] font-bold text-zinc-500">{proximoAgendamento.duracao_minutos || proximoAgendamento.servicos?.duracao_minutos || 30} min</span>
                      </div>
                    </div>
                    <p className="shrink-0 text-lg font-black leading-tight text-[#d5b451]">{formatarHora(proximoAgendamento.data_hora)}</p>
                  </div>
                </button>
              ) : (
                <div className="mt-2 rounded-[16px] border border-dashed border-[#27272a] px-4 py-5 text-center">
                  <p className="text-sm text-zinc-500">Nenhum atendimento restante neste dia.</p>
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {proximosDias.map((data) => {
                  const ativo = inicioDoDia(data).getTime() === inicioDoDia(dataSelecionada).getTime();
                  return (
                    <button
                      key={data.toISOString()}
                      type="button"
                      onClick={() => setDataSelecionada(data)}
                      className={`min-w-[74px] rounded-[16px] border px-3 py-3 text-center outline-none transition-colors focus:outline-none focus-visible:outline-none ${ativo ? 'border-[#d5b451] bg-[#d5b451] text-black' : 'border-[#27272a] bg-[#171717] text-zinc-400'}`}
                    >
                      <p className="text-[10px] font-bold capitalize">{data.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                      <p className="mt-1 text-lg font-black">{data.toLocaleDateString('pt-BR', { day: '2-digit' })}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">Horarios do dia</h2>
                <div className="flex items-center gap-2">
                  {atualizadoAgora && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                      Ao vivo
                    </span>
                  )}
                  <span className="text-xs font-bold text-[#d5b451]">{formatarDataCurta(dataSelecionada)}</span>
                </div>
              </div>

              {agendamentos.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#27272a] px-5 py-8 text-center">
                  <p className="text-sm text-zinc-500">Nenhum agendamento para esta data.</p>
                </div>
              ) : (
                <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                  {agendamentos.map((agendamento) => {
                    const status = String(agendamento.status || 'agendado').toLowerCase();
                    return (
                      <button
                        key={agendamento.id}
                        type="button"
                        onClick={() => setAgendamentoAberto(agendamento)}
                        className="block w-full rounded-[20px] border border-[#27272a] bg-[#171717] p-4 text-left outline-none active:scale-[0.99] focus:outline-none focus-visible:outline-none"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#d5b451]/10 text-[#d5b451]">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-base font-black">{agendamento.servicos?.nome || 'Servico'}</p>
                              <p className="mt-1 truncate text-xs text-zinc-500">{agendamento.clientes?.nome || 'Cliente'} - {agendamento.duracao_minutos || agendamento.servicos?.duracao_minutos || 30} min</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-black">{formatarHora(agendamento.data_hora)}</p>
                            <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${statusVisual[status] || statusVisual.agendado}`}>
                              {textoStatus(status)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <AgendamentoDetalhesModal agendamento={agendamentoAberto} onClose={() => setAgendamentoAberto(null)} />
      <NotificacoesModal
        isOpen={notificacoesAberto}
        onClose={() => setNotificacoesAberto(false)}
        notificacoes={notificacoes}
        onLimpar={limparNotificacoes}
        limpando={limpandoNotificacoes}
      />
      <BarbeiroDrawer
        isOpen={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        barbeiro={barbeiro}
        user={user}
        onLogout={sair}
        onOpenPerfil={() => {
          setDrawerAberto(false);
          setPerfilAberto(true);
        }}
      />
      <BarbeiroPerfilModal
        isOpen={perfilAberto}
        onClose={() => setPerfilAberto(false)}
        barbeiro={barbeiro}
        user={user}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes barbeiroAgendaIn {
          from { opacity: 0.35; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` }} />
    </div>
  );
}
