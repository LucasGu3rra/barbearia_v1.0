/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, forwardRef, useCallback } from 'react';
import ModalFiliais from '../components/ModalFiliais';
import ModalBarbeiros from '../components/ModalBarbeiros';
import ModalServicos from '../components/ModalServicos';
import ModalConfiguracoes from '../components/ModalConfiguracoes';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { enviarPushParaUsuarios, notificarAgendamento } from '../../services/notifications';
import ModalAlerta from "../components/ModalAlerta";
import ModalPlanos from "../components/ModalPlanos";
import NotificacoesModal from "../components/NotificacoesModal";
import DrawerAdmin from "./DrawerAdmin";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../contexts/useAuth';
import { signOutWithPushCleanup } from '../../services/authSession';
import { limparSessaoPreservandoEmpresa, montarRotaEmpresa } from '../../services/empresa';
import {
  carregarNotificacoesCache,
  limparNotificacoesCache,
  mesclarNotificacoesCache,
} from '../../services/notificationCache';

const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
  <button
    type="button"
    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-white text-sm font-medium outline-none focus:border-[#CEAA6B]/50 transition-colors cursor-pointer text-center"
    onClick={onClick}
    ref={ref}
  >
    {value}
  </button>
));

function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#09090b] p-6 pb-28 text-white">
      <div className="mx-auto w-full max-w-[430px] animate-pulse space-y-5">
        <div className="flex items-center justify-between pt-4">
          <div className="h-6 w-36 rounded bg-[#18181b]" />
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[#18181b]" />
            <div className="h-10 w-10 rounded-full bg-[#18181b]" />
          </div>
        </div>
        <div className="h-24 rounded-[22px] border border-[#27272a] bg-[#18181b]" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-20 rounded-[18px] border border-[#27272a] bg-[#18181b]" />
          <div className="h-20 rounded-[18px] border border-[#27272a] bg-[#18181b]" />
          <div className="h-20 rounded-[18px] border border-[#27272a] bg-[#18181b]" />
        </div>
        <div className="space-y-3">
          <div className="h-20 rounded-[18px] border border-[#27272a] bg-[#18181b]" />
          <div className="h-20 rounded-[18px] border border-[#27272a] bg-[#18181b]" />
          <div className="h-20 rounded-[18px] border border-[#27272a] bg-[#18181b]" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, isAdmin, empresaAtual, loading: authLoading } = useAuth();
  const { empresaSlug } = useParams();
  const empresaId = empresaAtual?.id;
  const userId = user?.id;
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [cortesGerais, setCortesGerais] = useState([]); 
  const [agenda, setAgenda] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planosInfo, setPlanosInfo] = useState({});
  
  const [abaAtiva, setAbaAtiva] = useState('ativos');
  const [filtroAgenda, setFiltroAgenda] = useState('agendados');
  const [busca, setBusca] = useState('');
  
  const [dataFiltro, setDataFiltro] = useState(new Date());

  const [modalConfig, setModalConfig] = useState({ 
    isOpen: false, type: 'alert', title: '', message: '', onConfirm: null 
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalPlanosAberto, setModalPlanosAberto] = useState(false);
  const [modalFiliaisAberto, setModalFiliaisAberto] = useState(false);
  const [modalBarbeirosAberto, setModalBarbeirosAberto] = useState(false);
  const [modalServicosAberto, setModalServicosAberto] = useState(false);
  const [modalConfiguracoesAberto, setModalConfiguracoesAberto] = useState(false);
  const [mostrarAguardando, setMostrarAguardando] = useState(true);
  const [notificacoesAberto, setNotificacoesAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [limpandoNotificacoes, setLimpandoNotificacoes] = useState(false);
  const [novosClientes, setNovosClientes] = useState(0);
  const [novosAgendamentos, setNovosAgendamentos] = useState(0);
  const [novosCortes, setNovosCortes] = useState(0);

  const navigate = useNavigate();
 
  const fecharModal = () => setModalConfig({ ...modalConfig, isOpen: false });
  const showConfirm = (title, message, acao) => setModalConfig({ isOpen: true, type: 'confirm', title, message, onConfirm: acao });
  const showAlert = (title, message) => setModalConfig({ isOpen: true, type: 'alert', title, message, onConfirm: null });

  const carregarNotificacoes = useCallback(async () => {
    if (!empresaId || !userId) return;

    const notificacoesCache = carregarNotificacoesCache({ empresaId, userId });
    setNotificacoes(notificacoesCache);

    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('notificacoes')
      .select('id, titulo, corpo, tipo, dados, lida, created_at')
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

    if (error) {
      console.error('Erro ao limpar notificacoes:', error);
      setLimpandoNotificacoes(false);
      return;
    }
    setLimpandoNotificacoes(false);
  };

  const carregarDados = useCallback(async (isManualRefresh = false) => {
    if (!empresaId) return;
    if (isManualRefresh) setRefreshing(true);
    
    try {
      const { data: dadosPlanos, error: errPlanos } = await supabase
        .from('planos')
        .select('*')
        .eq('empresa_id', empresaId);
      
      if (errPlanos) throw errPlanos;

      const mapaPlanos = {};
      dadosPlanos?.forEach(p => {
        mapaPlanos[p.slug] = { 
          nome: p.nome, 
          limite: p.limite,
          ilimitado: Boolean(p.ilimitado),
          preco: `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}/mês` 
        };
      });
      setPlanosInfo(mapaPlanos);

      const { data: config } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('chave', 'fluxo_agendamento')
        .maybeSingle();

      if (config?.valor) {
        setAgendamentoAtivo(config.valor.agendamento_ativo ?? false);
      }

      const { data: dadosClientes, error: errClientes } = await supabase
        .from('clientes')
        .select(`
          id, nome, whatsapp,
          assinaturas ( id, plano_escolhido, status, data_vencimento, created_at )
        `)
        .eq('empresa_id', empresaId)
        .eq('eh_admin', false) 
        .order('nome');

      if (errClientes) throw errClientes;

      const { data: dadosCortes, error: errCortes } = await supabase
        .from('historico_cortes')
        .select(`
          id, created_at, tipo_corte, cliente_id, status, origem, cancelavel_ate,
          clientes ( nome, whatsapp )
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (errCortes) throw errCortes;

      const { data: dadosAgendamentos, error: errAgendamentos } = await supabase
        .from('agendamentos')
        .select(`
          id, data_hora, status, tipo_cliente, created_at, cliente_id,
          clientes ( nome, whatsapp ),
          servicos ( nome, preco, duracao_minutos ),
          barbeiros ( nome )
        `)
        .eq('empresa_id', empresaId)
        .order('data_hora', { ascending: true });

      if (errAgendamentos) throw errAgendamentos;

      setClientes(dadosClientes || []);
      setCortesGerais(dadosCortes || []);
      setAgenda(dadosAgendamentos || []);

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setRefreshing(false), 600);
      }
    }
  }, [empresaId]);

  useEffect(() => { 
    if (authLoading) return;

    let isMounted = true;

    const checarAdminReal = async () => {
      if (!isAdmin || !empresaId || !empresaSlug || empresaAtual?.slug !== empresaSlug) {
        return navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/');
      }

      if (isMounted) carregarDados();
    };

    checarAdminReal(); 

    const filtroEmpresa = `empresa_id=eq.${empresaId}`;
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes', filter: filtroEmpresa }, (payload) => {
        if (payload.eventType === 'INSERT') setNovosClientes((total) => total + 1);
        carregarDados();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assinaturas', filter: filtroEmpresa }, () => carregarDados())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: filtroEmpresa }, (payload) => {
        if (payload.eventType === 'INSERT') setNovosAgendamentos((total) => total + 1);
        carregarDados();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historico_cortes', filter: filtroEmpresa }, (payload) => {
        if (payload.eventType === 'INSERT') setNovosCortes((total) => total + 1);
        carregarDados();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes', filter: filtroEmpresa }, () => carregarDados())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [navigate, authLoading, isAdmin, empresaId, empresaSlug, empresaAtual?.slug, carregarDados]);

  useEffect(() => {
    if (!agendamentoAtivo && abaAtiva === 'agenda') {
      setAbaAtiva('historico');
    }
    if (!agendamentoAtivo && abaAtiva === 'avulsos') {
      setAbaAtiva('ativos');
    }
  }, [agendamentoAtivo, abaAtiva]);

  useEffect(() => {
    if (abaAtiva === 'agenda') setNovosAgendamentos(0);
    if (abaAtiva === 'historico') setNovosCortes(0);
    if (!['agenda', 'historico'].includes(abaAtiva)) setNovosClientes(0);
  }, [abaAtiva]);

  useEffect(() => {
    carregarNotificacoes();
  }, [carregarNotificacoes]);

  const handleLogout = async () => {
    await signOutWithPushCleanup({ empresaId, userId });
    limparSessaoPreservandoEmpresa();
    navigate(montarRotaEmpresa(empresaSlug, ''));
  };

  const confirmarAtivacao = (assinaturaId, nomeCliente) => {
    showConfirm('Ativar Assinatura', `Confirmar recebimento e ativar o plano de ${nomeCliente} por 30 dias?`, () => efetuarAtivacao(assinaturaId));
  };

  const efetuarAtivacao = async (assinaturaId) => {
    fecharModal();
    try {
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);
      const assinaturaAtivada = aguardandoAtivacao.find((item) => item.assinatura.id === assinaturaId);
      const { error } = await supabase
        .from('assinaturas')
        .update({ status: 'ativa', data_vencimento: dataVencimento.toISOString() })
        .eq('id', assinaturaId)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      if (assinaturaAtivada?.id) {
        enviarPushParaUsuarios({
          empresaId,
          userIds: [assinaturaAtivada.id],
          titulo: 'Plano ativado',
          corpo: 'Seu plano foi ativado. Agora voce ja pode usar os beneficios.',
          tipo: 'plano_ativado',
          dados: { url: montarRotaEmpresa(empresaSlug, '/dashboard') },
        });
      }
      carregarDados(); 
      showAlert('Sucesso', 'A assinatura foi ativada e o acesso do cliente está liberado.');
    } catch (error) {
      showAlert('Erro', 'Não foi possível ativar a assinatura: ' + error.message);
    }
  };

  const confirmarExclusaoAssinatura = (assinaturaId, nomeCliente) => {
    showConfirm('Excluir Assinatura', `Tem certeza que deseja remover a assinatura de ${nomeCliente}? O cliente voltará para a tela de escolha de planos.`, () => efetuarExclusaoAssinatura(assinaturaId));
  };

  const efetuarExclusaoAssinatura = async (assinaturaId) => {
    fecharModal();
    try {
      const { error } = await supabase
        .from('assinaturas')
        .delete()
        .eq('id', assinaturaId)
        .eq('empresa_id', empresaId);
      if (error) throw error;
      carregarDados();
      showAlert('Removida', 'A assinatura foi excluída com sucesso.');
    } catch (error) {
      console.error(error);
      showAlert('Erro', 'Não foi possível excluir a assinatura.');
    }
  };

  const confirmarExclusaoAgendamento = (agendamento) => {
    const nomeCliente = agendamento.clientes?.nome || 'Cliente';
    const horario = formatarHora(agendamento.data_hora);
    showConfirm(
      'Excluir Agendamento',
      `Tem certeza que deseja excluir o agendamento de ${nomeCliente} as ${horario}?`,
      () => efetuarExclusaoAgendamento(agendamento.id)
    );
  };

  const efetuarExclusaoAgendamento = async (agendamentoId) => {
    fecharModal();
    try {
      await notificarAgendamento({ agendamentoId, evento: 'excluido' });
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', agendamentoId)
        .eq('empresa_id', empresaId);

      if (error) throw error;
      carregarDados();
      showAlert('Removido', 'O agendamento foi excluido com sucesso.');
    } catch (error) {
      console.error(error);
      showAlert('Erro', 'Nao foi possivel excluir o agendamento.');
    }
  };

  const formatarData = (dataStr) => {
    if (!dataStr) return '--/--';
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatarHora = (dataStr) => {
    if (!dataStr) return '--:--';
    const d = new Date(dataStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const hojeInicio = new Date();
  hojeInicio.setHours(0, 0, 0, 0);
  const hojeFim = new Date(hojeInicio);
  hojeFim.setHours(23, 59, 59, 999);
  const limiteVencimento = new Date(hojeInicio);
  limiteVencimento.setDate(limiteVencimento.getDate() + 7);

  const classificarCliente = (assinaturas = []) => {
    const assinaturasOrdenadas = [...assinaturas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const ativa = assinaturasOrdenadas.find(a => a.status === 'ativa');
    if (ativa) {
      const vencimento = ativa.data_vencimento ? new Date(ativa.data_vencimento) : null;
      if (!vencimento || vencimento < hojeInicio) return { assinatura: ativa, classificacao: 'inativo' };
      if (vencimento && vencimento <= limiteVencimento) return { assinatura: ativa, classificacao: 'vencendo' };
      return { assinatura: ativa, classificacao: 'ativo' };
    }

    const pendente = assinaturasOrdenadas.find(a => a.status === 'pendente');
    if (pendente) return { assinatura: pendente, classificacao: 'pendente' };

    const ultima = assinaturasOrdenadas[0] || null;
    if (ultima) return { assinatura: ultima, classificacao: 'inativo' };
    return { assinatura: null, classificacao: 'avulso' };
  };

  const clientesProcessados = clientes.map(cliente => {
    const todasAssinaturas = cliente.assinaturas || [];
    const { assinatura, classificacao } = classificarCliente(todasAssinaturas);

    const planoDetalhe = assinatura ? planosInfo[assinatura.plano_escolhido] : null;

    const cortesHistoricoMes = cortesGerais.filter(corte => {
      const ehDesteCliente = corte.cliente_id === cliente.id && String(corte.status || 'feito').toLowerCase() !== 'cancelado';
      const dataCorte = new Date(corte.created_at);
      return ehDesteCliente && dataCorte.getMonth() === mesAtual && dataCorte.getFullYear() === anoAtual;
    });

    const agendamentosValidosCliente = agenda.filter(agendamento => {
      const status = String(agendamento.status || '').toLowerCase();
      return agendamento.cliente_id === cliente.id && !['cancelado', 'cancelada'].includes(status);
    });

    const agendamentosValidosMes = agendamentosValidosCliente.filter(agendamento => {
      const dataAgendamento = new Date(agendamento.data_hora || agendamento.created_at);
      return dataAgendamento.getMonth() === mesAtual && dataAgendamento.getFullYear() === anoAtual;
    });
    const agendamentosPlanoMes = agendamentosValidosMes.filter(agendamento => {
      return String(agendamento.tipo_cliente || '').toLowerCase() === 'assinante';
    });

    const ultimoServicoHistorico = cortesGerais.find(corte => {
      return corte.cliente_id === cliente.id && String(corte.status || 'feito').toLowerCase() !== 'cancelado';
    }) || null;

    const ultimoServicoAgendamento = agendamentosValidosCliente
      .filter(agendamento => agendamento.data_hora || agendamento.created_at)
      .sort((a, b) => new Date(b.data_hora || b.created_at) - new Date(a.data_hora || a.created_at))[0] || null;

    const ultimoServico = (() => {
      if (!ultimoServicoHistorico) return ultimoServicoAgendamento;
      if (!ultimoServicoAgendamento) return ultimoServicoHistorico;
      const dataHistorico = new Date(ultimoServicoHistorico.created_at);
      const dataAgendamento = new Date(ultimoServicoAgendamento.data_hora || ultimoServicoAgendamento.created_at);
      return dataAgendamento > dataHistorico ? ultimoServicoAgendamento : ultimoServicoHistorico;
    })();

    const usosPlanoMes = cortesHistoricoMes.length + agendamentosPlanoMes.length;
    const servicosNoMes = cortesHistoricoMes.length + agendamentosValidosMes.length;

    return {
      ...cliente,
      assinatura,
      planoDetalhe,
      cortesNoMes: usosPlanoMes,
      servicosNoMes,
      ultimoServico,
      classificacao,
    };
  });

  const clientesAtivos = clientesProcessados.filter(c => c.classificacao === 'ativo');
  const clientesPendentes = clientesProcessados.filter(c => c.classificacao === 'pendente');
  const clientesVencendo = clientesProcessados.filter(c => c.classificacao === 'vencendo');
  const clientesInativos = clientesProcessados.filter(c => c.classificacao === 'inativo');
  const clientesAvulsos = clientesProcessados.filter(c => c.classificacao === 'avulso');
  const novosItensPrimeiraAba = agendamentoAtivo ? novosAgendamentos : novosCortes;

  const aguardandoAtivacao = [];
  clientes.forEach(cliente => {
    const pendentes = (cliente.assinaturas || []).filter(a => a.status === 'pendente');
    pendentes.forEach(assinaturaPendente => {
      aguardandoAtivacao.push({ ...cliente, assinatura: assinaturaPendente });
    });
  });

  const calcularRenda = () => {
    let faturamentoMensal = 0;
    let previsaoProximoMes = 0;
    clientesProcessados.forEach(cliente => {
      if (['ativo', 'vencendo'].includes(cliente.classificacao) && cliente.planoDetalhe) {
        const valor = parseFloat(cliente.planoDetalhe.preco.replace('R$ ', '').replace('.', '').replace(',', '.'));
        faturamentoMensal += valor;
        previsaoProximoMes += valor;
      }
    });
    return { faturamentoMensal, previsaoProximoMes };
  };

  const { faturamentoMensal, previsaoProximoMes } = calcularRenda();
  const notificacoesNaoLidas = notificacoes.filter((notificacao) => !notificacao.lida).length;
  
  let listaClientesFiltrada = clientesProcessados.filter(c => {
    const nomeSeguro = c.nome ? String(c.nome).toLowerCase() : '';
    const whatsappSeguro = c.whatsapp ? String(c.whatsapp) : '';
    const buscaSegura = busca ? String(busca).toLowerCase() : '';
    return nomeSeguro.includes(buscaSegura) || whatsappSeguro.includes(buscaSegura);
  });

  if (abaAtiva === 'ativos') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => c.classificacao === 'ativo');
  } else if (abaAtiva === 'vencendo') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => c.classificacao === 'vencendo');
  } else if (abaAtiva === 'inativos') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => c.classificacao === 'inativo');
  } else if (abaAtiva === 'avulsos') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => c.classificacao === 'avulso');
  } else if (abaAtiva === 'pendentes') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => c.classificacao === 'pendente');
  }

  const listaCortesFiltrada = cortesGerais.filter(corte => {
    if (String(corte.status || 'feito').toLowerCase().startsWith('cancelad')) return false;
    if (!dataFiltro) return true; 
    const d = new Date(corte.created_at);
    return d.getDate() === dataFiltro.getDate() && d.getMonth() === dataFiltro.getMonth() && d.getFullYear() === dataFiltro.getFullYear();
  });

  const listaAgendaFiltrada = agenda.filter(ag => {
    if (!dataFiltro || !ag.data_hora) return false;
    const d = new Date(ag.data_hora);
    return d.getDate() === dataFiltro.getDate() && d.getMonth() === dataFiltro.getMonth() && d.getFullYear() === dataFiltro.getFullYear();
  });
  const cortesHoje = cortesGerais.filter(corte => {
    const dataCorte = new Date(corte.created_at);
    return dataCorte >= hojeInicio && dataCorte <= hojeFim && String(corte.status || 'feito').toLowerCase() !== 'cancelado';
  });
  const totalAgendadosDia = listaAgendaFiltrada.filter(ag => ['agendado', 'confirmado', 'pendente'].includes(String(ag.status || '').toLowerCase())).length;
  const totalFinalizadosDia = listaAgendaFiltrada.filter(ag => ['finalizado', 'concluido'].includes(String(ag.status || '').toLowerCase())).length;
  const listaAgendaVisivel = listaAgendaFiltrada.filter(ag => {
    const status = String(ag.status || '').toLowerCase();
    if (filtroAgenda === 'agendados') return ['agendado', 'confirmado', 'pendente'].includes(status);
    if (filtroAgenda === 'finalizados') return ['finalizado', 'concluido'].includes(status);
    return true;
  });

  const getIniciais = (nome) => {
    if (!nome) return '??';
    const partes = String(nome).split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return partes[0].substring(0, 2).toUpperCase();
  };

  const estilosCliente = {
    ativo: {
      label: 'Ativo',
      border: 'border-emerald-500/30',
      badge: 'bg-emerald-500/10 text-emerald-400',
      icon: 'text-emerald-400',
    },
    vencendo: {
      label: 'Vencendo',
      border: 'border-[#CEAA6B]/45',
      badge: 'bg-[#CEAA6B]/10 text-[#CEAA6B]',
      icon: 'text-[#CEAA6B]',
    },
    pendente: {
      label: 'Pendente',
      border: 'border-[#CEAA6B]/45',
      badge: 'bg-[#CEAA6B]/10 text-[#CEAA6B]',
      icon: 'text-[#CEAA6B]',
    },
    inativo: {
      label: 'Inativo',
      border: 'border-red-500/30',
      badge: 'bg-red-500/10 text-red-400',
      icon: 'text-red-400',
    },
    avulso: {
      label: 'Avulso',
      border: 'border-sky-500/30',
      badge: 'bg-sky-500/10 text-sky-400',
      icon: 'text-sky-400',
    },
  };

  const detalhePrincipalCliente = (cliente) => {
    if (cliente.classificacao === 'avulso') {
      return cliente.ultimoServico
        ? `Ultimo servico: ${cliente.ultimoServico.tipo_corte || cliente.ultimoServico.servicos?.nome || 'Servico'}`
        : 'Sem servicos registrados';
    }

    if (cliente.classificacao === 'pendente') {
      return cliente.planoDetalhe
        ? `${cliente.planoDetalhe.nome || 'Plano'} solicitado`
        : 'Plano solicitado';
    }

    if (cliente.classificacao === 'inativo') {
      return cliente.planoDetalhe
        ? `Ultimo plano: ${cliente.planoDetalhe.nome || 'Plano'}`
        : 'Plano inativo';
    }

    return cliente.planoDetalhe
      ? `${cliente.planoDetalhe.ilimitado ? 'Ilimitado' : `${cliente.planoDetalhe.limite} Cortes/mês`} • ${cliente.planoDetalhe.preco}`
      : 'Plano ativo';
  };

  const detalheUsoCliente = (cliente) => {
    if (cliente.classificacao === 'avulso') {
      return `${cliente.servicosNoMes || 0} servicos no mes`;
    }

    if (cliente.classificacao === 'pendente') {
      return 'Aguardando ativacao';
    }

    if (cliente.classificacao === 'inativo') {
      return 'Plano inativo';
    }

    if (cliente.planoDetalhe?.ilimitado) {
      return `${cliente.cortesNoMes} cortes no mes`;
    }

    return `${cliente.cortesNoMes} de ${cliente.planoDetalhe?.limite || 0} cortes usados`;
  };

  const detalheDataCliente = (cliente) => {
    if (cliente.classificacao === 'avulso') {
      return cliente.ultimoServico ? formatarData(cliente.ultimoServico.data_hora || cliente.ultimoServico.created_at) : 'Sem plano';
    }

    if (cliente.classificacao === 'pendente') {
      return `Solicitado ${formatarData(cliente.assinatura?.created_at)}`;
    }

    if (cliente.classificacao === 'inativo') {
      return cliente.assinatura?.data_vencimento ? `Venceu ${formatarData(cliente.assinatura.data_vencimento)}` : 'Sem vencimento';
    }

    return `Vence ${formatarData(cliente.assinatura?.data_vencimento)}`;
  };

  if (loading) return <AdminDashboardSkeleton />;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans pb-28">
      
      <DrawerAdmin 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        onLogout={handleLogout}
        dadosFinanceiros={{ faturamentoMensal, previsaoProximoMes, totalAtivos: clientesAtivos.length }}
        onOpenPlanos={() => setModalPlanosAberto(true)}
        onOpenFiliais={() => setModalFiliaisAberto(true)}
        onOpenBarbeiros={() => setModalBarbeirosAberto(true)}
        onOpenServicos={() => setModalServicosAberto(true)}
        onOpenConfiguracoes={() => setModalConfiguracoesAberto(true)}
        onOpenHistorico={() => setAbaAtiva('historico')}
        novosCortes={novosCortes}
      />
      <ModalPlanos isOpen={modalPlanosAberto} onClose={() => setModalPlanosAberto(false)} onRefresh={carregarDados} empresaId={empresaId} />
      <ModalFiliais isOpen={modalFiliaisAberto} onClose={() => setModalFiliaisAberto(false)} empresaId={empresaId} />
      <ModalBarbeiros isOpen={modalBarbeirosAberto} onClose={() => setModalBarbeirosAberto(false)} empresaId={empresaId} />
      <ModalServicos isOpen={modalServicosAberto} onClose={() => setModalServicosAberto(false)} onRefresh={carregarDados} empresaId={empresaId} />
      
      <ModalConfiguracoes 
        isOpen={modalConfiguracoesAberto} 
        onClose={() => setModalConfiguracoesAberto(false)} 
        onRefresh={carregarDados} 
        onConfigChange={(status) => setAgendamentoAtivo(status)} 
        empresaId={empresaId}
      />

      <ModalAlerta 
        isOpen={modalConfig.isOpen} 
        onClose={fecharModal} 
        onConfirm={modalConfig.onConfirm} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        type={modalConfig.type} 
      />
      <NotificacoesModal
        isOpen={notificacoesAberto}
        onClose={() => setNotificacoesAberto(false)}
        notificacoes={notificacoes}
        onLimpar={limparNotificacoes}
        limpando={limpandoNotificacoes}
      />

      <header className="flex justify-between items-center mb-8 mt-4">
        <h1 className="text-[#CEAA6B] font-black text-xl tracking-widest uppercase">Painel ADMIN</h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={abrirNotificacoes}
            className="relative w-10 h-10 rounded-full border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-[#CEAA6B] transition-colors active:scale-95"
            aria-label="Abrir notificacoes"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            {notificacoesNaoLidas > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-[#CEAA6B] text-black text-[10px] font-black flex items-center justify-center">
                {notificacoesNaoLidas > 9 ? '9+' : notificacoesNaoLidas}
              </span>
            )}
          </button>
          <button 
            onClick={() => carregarDados(true)} 
            disabled={refreshing}
            className="w-10 h-10 rounded-full border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-[#CEAA6B] transition-colors active:scale-95 disabled:opacity-50"
          >
            <svg className={`${refreshing ? 'animate-spin text-[#CEAA6B]' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path></svg>
          </button>
        </div>
      </header>

      <nav className="fixed bottom-3 left-1/2 z-[55] w-[calc(100%-24px)] max-w-[390px] -translate-x-1/2 rounded-[24px] border border-[#27272a] bg-[#070707]/95 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setAbaAtiva(agendamentoAtivo ? 'agenda' : 'historico')}
            className={`relative flex h-[58px] flex-col items-center justify-center rounded-[20px] text-[11px] font-black transition-colors ${abaAtiva === (agendamentoAtivo ? 'agenda' : 'historico') ? 'bg-[#2a2418] text-[#E1BF63]' : 'text-zinc-500'}`}
          >
            {novosItensPrimeiraAba > 0 && (
              <span className="absolute right-7 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CEAA6B] px-1 text-[10px] font-black text-black shadow-[0_0_0_2px_#070707]">
                {novosItensPrimeiraAba > 9 ? '9+' : novosItensPrimeiraAba}
              </span>
            )}
            {agendamentoAtivo ? (
              <svg className="mb-1" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            ) : (
              <svg className="mb-1" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 11 17 15 13" /></svg>
            )}
            {agendamentoAtivo ? 'Agenda' : 'Cortes'}
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('ativos')}
            className={`relative flex h-[58px] flex-col items-center justify-center rounded-[20px] text-[11px] font-black transition-colors ${!['agenda', 'historico'].includes(abaAtiva) ? 'bg-[#2a2418] text-[#E1BF63]' : 'text-zinc-500 active:bg-[#141414]'}`}
          >
            {novosClientes > 0 && (
              <span className="absolute right-7 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CEAA6B] px-1 text-[10px] font-black text-black shadow-[0_0_0_2px_#070707]">
                {novosClientes > 9 ? '9+' : novosClientes}
              </span>
            )}
            <svg className="mb-1" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
            Clientes
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`relative flex h-[58px] flex-col items-center justify-center rounded-[20px] text-[11px] font-black transition-colors ${drawerOpen ? 'bg-[#2a2418] text-[#E1BF63]' : 'text-zinc-500 active:bg-[#141414]'}`}
          >
            {agendamentoAtivo && novosCortes > 0 && (
              <span className="absolute right-7 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CEAA6B] px-1 text-[10px] font-black text-black shadow-[0_0_0_2px_#070707]">
                {novosCortes > 9 ? '9+' : novosCortes}
              </span>
            )}
            <svg className="mb-1" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
            Menu
          </button>
        </div>
      </nav>

      {abaAtiva !== 'historico' && abaAtiva !== 'agenda' && aguardandoAtivacao.length > 0 && (
        <section className="mb-8">
          <button 
            onClick={() => setMostrarAguardando(!mostrarAguardando)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4 outline-none active:scale-[0.98] transition-transform"
          >
            <span className="flex items-center gap-2">
              <span>Aguardando Ativação</span>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#CEAA6B] px-2 text-[11px] font-black text-black shadow-[0_0_18px_rgba(206,170,107,0.35)]">
                {aguardandoAtivacao.length > 99 ? '99+' : aguardandoAtivacao.length}
              </span>
            </span>
            <svg className={`transition-transform duration-300 ${mostrarAguardando ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          
          {mostrarAguardando && (
            <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
              {aguardandoAtivacao.map((item, index) => (
                <div key={`${item.id}-${index}`} className="bg-[#121212] border border-[#27272a] rounded-[20px] p-5 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg leading-tight"><span>{item.nome}</span></h3>
                    <p className="text-[#CEAA6B] text-[10px] font-bold uppercase mt-1">
                      <span>{planosInfo[item.assinatura.plano_escolhido]?.nome || 'Plano Antigo'} • SOLICITADO EM {formatarData(item.assinatura.created_at)} ÀS {formatarHora(item.assinatura.created_at)}</span>
                    </p>
                    <p className="text-zinc-500 text-[10px] mt-1"><span>WhatsApp: {item.whatsapp}</span></p>
                  </div>
                  <button 
                    onClick={() => confirmarAtivacao(item.assinatura.id, item.nome)}
                    className="bg-[#CEAA6B] text-black font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl active:scale-95 transition-transform"
                  >
                    Ativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* BLOCO DE BOTÕES - COM A VACINA DO <span> PARA EVITAR CRASH DO GOOGLE TRADUTOR */}

      {abaAtiva === 'agenda' || abaAtiva === 'historico' ? (

        <div className="animate-[fadeIn_0.2s_ease-out]">
          <div className="flex justify-between items-center mb-6 bg-[#121212] p-4 rounded-2xl border border-[#27272a]">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                {abaAtiva === 'agenda' ? 'Agendamentos' : 'Cortes'}
              </p>
              <h2 className="text-[#CEAA6B] font-bold text-lg">
                <span>
                  {dataFiltro && dataFiltro.toDateString() === new Date().toDateString() 
                    ? (abaAtiva === 'agenda' ? 'Agenda de Hoje' : 'Cortes de Hoje') 
                    : formatarData(dataFiltro)}
                </span>
              </h2>
            </div>
            
            <div className="relative w-full ml-4 max-w-[150px]">
              <DatePicker 
                selected={dataFiltro}
                onChange={(date) => setDataFiltro(date)}
                locale={ptBR}
                dateFormat="dd/MM/yyyy"
                withPortal
                customInput={<CustomDateInput />}
                wrapperClassName="w-full"
              />
            </div>
          </div>

          {abaAtiva === 'agenda' && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setFiltroAgenda('agendados')}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-colors ${filtroAgenda === 'agendados' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
              >
                Agendados ({totalAgendadosDia})
              </button>
              <button
                type="button"
                onClick={() => setFiltroAgenda('finalizados')}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-colors ${filtroAgenda === 'finalizados' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
              >
                Finalizados ({totalFinalizadosDia})
              </button>
              <button
                type="button"
                onClick={() => setFiltroAgenda('todos')}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-colors ${filtroAgenda === 'todos' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
              >
                Todos ({listaAgendaFiltrada.length})
              </button>
            </div>
          )}

          <div className="space-y-3">
            {abaAtiva === 'agenda' ? (
              listaAgendaVisivel.length > 0 ? (
                listaAgendaVisivel.map(ag => {
                  const horaAgendamento = formatarHora(ag.data_hora);
                  const nomeCli = ag.clientes?.nome || 'Cliente Desconhecido';
                  const nomeServico = ag.servicos?.nome || 'Serviço não informado';
                  const nomeBarbeiro = ag.barbeiros?.nome || 'Sem barbeiro';
                  const status = String(ag.status || 'agendado').toLowerCase();

                  return (
                    <div key={ag.id} className="bg-[#121212] border border-[#27272a] rounded-[16px] p-4 flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-[#27272a] bg-[#09090b] flex items-center justify-center text-zinc-500 font-bold text-xs">
                          {getIniciais(nomeCli)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white"><span>{nomeCli}</span></h4>
                          <p className="text-[10px] text-[#CEAA6B] font-medium uppercase tracking-wider"><span>{nomeServico} • {nomeBarbeiro}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-white"><span>{horaAgendamento}</span></p>
                          <span className={`inline-block mt-1 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${['finalizado', 'concluido'].includes(status) ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[#CEAA6B]/10 text-[#CEAA6B]'}`}>
                            {ag.status || 'Agendado'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => confirmarExclusaoAgendamento(ag)}
                          className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center active:scale-95 transition-transform"
                          aria-label="Excluir agendamento"
                          title="Excluir agendamento"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="bg-[#121212] border border-[#27272a] border-dashed rounded-[20px] p-10 flex flex-col items-center justify-center text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600 mb-3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <p className="text-zinc-500 text-sm font-medium"><span>Nenhum agendamento para este dia.</span></p>
                </div>
              )
            ) : (
              listaCortesFiltrada.length > 0 ? (
                listaCortesFiltrada.map(corte => {
                  const horaCorte = formatarHora(corte.created_at);
                  const nomeCli = corte.clientes?.nome || 'Cliente Desconhecido';
                  
                  return (
                    <div key={corte.id} className="bg-[#121212] border border-[#27272a] rounded-[16px] p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border border-[#27272a] bg-[#09090b] flex items-center justify-center text-zinc-500 font-bold text-xs">
                          {getIniciais(nomeCli)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white"><span>{nomeCli}</span></h4>
                          <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider"><span>{corte.tipo_corte}</span></p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-zinc-400"><span>{horaCorte}</span></p>
                        <p className="text-[10px] text-zinc-600"><span>Registrado</span></p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="bg-[#121212] border border-[#27272a] border-dashed rounded-[20px] p-10 flex flex-col items-center justify-center text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600 mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <p className="text-zinc-500 text-sm font-medium"><span>Nenhum corte manual registrado neste dia.</span></p>
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          <section className="mb-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#CEAA6B]">Clientes</p>
                <h2 className="mt-1 text-xl font-black leading-tight text-white">
                  {agendamentoAtivo ? 'Planos e avulsos' : 'Controle de planos'}
                </h2>
              </div>
              <span className={`mt-1 shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${agendamentoAtivo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#CEAA6B]/10 text-[#CEAA6B]'}`}>
                {agendamentoAtivo ? 'Agenda ativa' : 'Agenda pausada'}
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {!agendamentoAtivo && (
                <div className="min-w-[92px] rounded-2xl border border-[#27272a] bg-[#121212] px-3 py-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Cortes hoje</p>
                  <p className="mt-1 text-xl font-black text-white">{cortesHoje.length}</p>
                </div>
              )}
              <div className="min-w-[76px] rounded-2xl border border-[#27272a] bg-[#121212] px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Ativos</p>
                <p className="mt-1 text-xl font-black text-white">{clientesAtivos.length}</p>
              </div>
              <div className="min-w-[92px] rounded-2xl border border-[#27272a] bg-[#121212] px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Pendentes</p>
                <p className="mt-1 text-xl font-black text-white">{clientesPendentes.length}</p>
              </div>
              <div className="min-w-[88px] rounded-2xl border border-[#27272a] bg-[#121212] px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Vencendo</p>
                <p className="mt-1 text-xl font-black text-white">{clientesVencendo.length}</p>
              </div>
              <div className="min-w-[88px] rounded-2xl border border-[#27272a] bg-[#121212] px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Inativos</p>
                <p className="mt-1 text-xl font-black text-white">{clientesInativos.length}</p>
              </div>
              {agendamentoAtivo && (
                <div className="min-w-[88px] rounded-2xl border border-[#27272a] bg-[#121212] px-3 py-2.5">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Avulsos</p>
                  <p className="mt-1 text-xl font-black text-white">{clientesAvulsos.length}</p>
                </div>
              )}
            </div>
          </section>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              type="button"
              onClick={() => setAbaAtiva('ativos')}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition-colors ${abaAtiva === 'ativos' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
            >
              Ativos ({clientesAtivos.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('vencendo')}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition-colors ${abaAtiva === 'vencendo' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
            >
              Vencendo ({clientesVencendo.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('pendentes')}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition-colors ${abaAtiva === 'pendentes' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
            >
              Pendentes ({clientesPendentes.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('inativos')}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition-colors ${abaAtiva === 'inativos' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
            >
              Inativos ({clientesInativos.length})
            </button>
            {agendamentoAtivo && (
              <button
                type="button"
                onClick={() => setAbaAtiva('avulsos')}
                className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition-colors ${abaAtiva === 'avulsos' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
              >
                Avulsos ({clientesAvulsos.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setAbaAtiva('todos')}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-black transition-colors ${abaAtiva === 'todos' ? 'bg-[#CEAA6B] text-black' : 'border border-[#27272a] bg-[#121212] text-zinc-500'}`}
            >
              Todos ({clientesProcessados.length})
            </button>
          </div>

          <div className="relative mb-6">
            <svg className="absolute left-4 top-4 text-zinc-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder="Buscar cliente..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-[#121212] border border-[#27272a] rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#CEAA6B] text-sm text-white placeholder-zinc-600 transition-colors"
            />
          </div>

          <div className="space-y-4">
            {listaClientesFiltrada.map(cliente => {
              const estilo = estilosCliente[cliente.classificacao] || estilosCliente.avulso;
              
              return (
                <div key={cliente.id} className={`bg-[#121212] border ${estilo.border} rounded-[24px] p-5`}>
                  <div className="flex items-center gap-4 border-b border-[#27272a] pb-4 mb-4">
                    <div className="w-12 h-12 rounded-full border border-[#27272a] bg-[#09090b] flex items-center justify-center text-zinc-500 font-bold text-sm shrink-0">
                      {getIniciais(cliente.nome)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg leading-none"><span>{cliente.nome}</span></h3>
                        <div className="flex gap-2">
                          {cliente.assinatura && (
                            <button 
                              onClick={() => confirmarExclusaoAssinatura(cliente.assinatura.id, cliente.nome)}
                              className="p-1.5 text-zinc-600 hover:text-red-500 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          )}
                          <span className={`${estilo.badge} text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider`}>
                            {estilo.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-zinc-500 text-xs mt-1.5">
                        <span>{detalhePrincipalCliente(cliente)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className={`flex items-center gap-1.5 ${estilo.icon}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span className="font-medium"><span>{detalheUsoCliente(cliente)}</span></span>
                    </div>
                    <span className="text-zinc-500 font-medium">
                      <span>{detalheDataCliente(cliente)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
            {listaClientesFiltrada.length === 0 && <p className="text-center text-zinc-600 text-sm py-10"><span>Nenhum cliente encontrado.</span></p>}
          </div>
        </>
      )}
    </div>
  );
}
