/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../services/supabase';
import { montarRotaEmpresa } from '../../../services/empresa';
import { parseDataSupabase } from '../utils/clienteDashboardUtils';

const getClienteId = (userId) => {
  if (!userId) {
    localStorage.removeItem('clienteId');
    sessionStorage.removeItem('clienteId');
    return null;
  }

  localStorage.setItem('clienteId', userId);
  sessionStorage.setItem('clienteId', userId);
  return userId;
};

const assinaturaEstaVigente = (assinatura) => {
  if (!assinatura || assinatura.status !== 'ativa') return false;
  if (!assinatura.data_vencimento) return false;
  const vencimento = new Date(assinatura.data_vencimento);
  return !Number.isNaN(vencimento.getTime()) && vencimento >= new Date();
};

const assinaturaVencidaRecente = (assinatura) => {
  if (!assinatura?.plano_escolhido || assinatura.status === 'pendente') return false;
  if (!assinatura.data_vencimento) return false;
  const vencimento = new Date(assinatura.data_vencimento);
  if (Number.isNaN(vencimento.getTime())) return false;
  const limiteInativo = new Date();
  limiteInativo.setDate(limiteInativo.getDate() - 30);
  return vencimento < new Date() && vencimento >= limiteInativo;
};

const ordenarAssinaturasRecentes = (assinaturas = []) => (
  [...assinaturas].sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at))
);

export default function useClienteDashboardData({
  user,
  authLoading,
  empresaAtual,
  empresaSlug,
  navigate,
}) {
  const empresaId = empresaAtual?.id;
  const [dados, setDados] = useState(null);
  const [historicoMes, setHistoricoMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipoCliente, setTipoCliente] = useState(null);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);
  const [servicosAvulsos, setServicosAvulsos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [historicoCompleto, setHistoricoCompleto] = useState([]);
  const [planosDb, setPlanosDb] = useState([]);
  const [mapaPlanos, setMapaPlanos] = useState({});
  const [prazoCancelamentoMinutos, setPrazoCancelamentoMinutos] = useState(120);
  const [planoAtivadoEvento, setPlanoAtivadoEvento] = useState(null);
  const tipoClienteRef = useRef(null);
  const ativadaEmRef = useRef(null);
  const limparPlanoAtivadoEvento = useCallback(() => setPlanoAtivadoEvento(null), []);

  const clienteIdAtual = useCallback(() => getClienteId(user?.id), [user?.id]);

  const carregarDados = useCallback(async (id) => {
    try {
      const [
        { data: dadosPlanos },
        { data: dadosServicos },
        { data: dadosAgendamentos },
        { data: cfg },
        { data: vinculoEmpresa },
      ] = await Promise.all([
        supabase.from('planos').select('*').eq('empresa_id', empresaId).order('preco', { ascending: true }),
        supabase.from('servicos').select('*, servico_categorias(nome), servico_subcategorias(nome)').eq('empresa_id', empresaId).eq('ativo', true).is('deleted_at', null).order('created_at', { ascending: true }),
        supabase.from('agendamentos').select('*, servicos(nome, preco), planos(nome, preco), filiais(nome), barbeiros(nome)').eq('empresa_id', empresaId).eq('cliente_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('configuracoes').select('valor').eq('empresa_id', empresaId).eq('chave', 'fluxo_agendamento').maybeSingle(),
        supabase.from('usuarios_empresas').select('created_at').eq('empresa_id', empresaId).eq('user_id', id).maybeSingle(),
      ]);

      const todosPlanos = dadosPlanos || [];
      const planosAtivos = todosPlanos.filter((plano) => plano.ativo === true && !plano.deleted_at);
      const mapa = {};
      todosPlanos.forEach(p => { mapa[p.slug] = p; });
      setPlanosDb(planosAtivos);
      setMapaPlanos(mapa);
      setServicosAvulsos(dadosServicos || []);
      setAgendamentos(dadosAgendamentos || []);
      setAgendamentoAtivo(cfg?.valor?.agendamento_ativo === true);
      setPrazoCancelamentoMinutos(Number(
        cfg?.valor?.prazo_cancelamento_minutos
        ?? cfg?.valor?.cancelamento_minutos
        ?? 120
      ));

      const { data: cli, error } = await supabase
        .from('clientes')
        .select(`
          nome, whatsapp, email, alteracoes_nome,
          assinaturas(status, ativada_em, data_vencimento, plano_escolhido, proximo_plano, upgrade_pendente, created_at, solicitacao_plano_slug, solicitacao_plano_nome, solicitacao_plano_preco, solicitacao_tipo, solicitacao_forma_pagamento, solicitacao_em),
          historico_cortes(id, created_at, tipo_corte, status, origem, plano_slug, cancelavel_ate, cancelado_em)
        `)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .single();

      if (error) throw error;

      const assinaturasOrdenadas = ordenarAssinaturasRecentes(cli.assinaturas || []);
      const assinaturaAtiva = assinaturasOrdenadas.find(a => a.plano_escolhido && assinaturaEstaVigente(a));
      const assinaturaPendente = assinaturasOrdenadas.find(a => a.plano_escolhido && a.status === 'pendente');
      const assinaturaVencida = !assinaturaAtiva && !assinaturaPendente
        ? assinaturasOrdenadas.find(a => assinaturaVencidaRecente(a))
        : null;
      const ass = assinaturaAtiva || assinaturaPendente || assinaturaVencida || assinaturasOrdenadas.find(a => a.plano_escolhido) || null;
      const temPlano = !!ass?.plano_escolhido;
      const statusAss = ass?.status;
      const tipo = assinaturaAtiva ? 'ativo' : assinaturaPendente ? 'pendente' : assinaturaVencida ? 'vencido' : 'avulso';

      setTipoCliente(tipo);

      const inicioCiclo = assinaturaAtiva
        ? parseDataSupabase(
          assinaturaAtiva.ativada_em
          || new Date(new Date(assinaturaAtiva.data_vencimento).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        : null;
      const fimCiclo = assinaturaAtiva ? parseDataSupabase(assinaturaAtiva.data_vencimento) : null;
      const dentroDoCiclo = (valor) => {
        if (!inicioCiclo || !fimCiclo) return false;
        const data = parseDataSupabase(valor);
        return data >= inicioCiclo && data <= fimCiclo;
      };

      const cortesDoCiclo = (cli.historico_cortes || [])
        .filter(c => String(c.status || 'feito').toLowerCase() !== 'cancelado')
        .filter(c => Boolean(c.plano_slug) || c.origem === 'plano_confirmacao')
        .filter(c => dentroDoCiclo(c.created_at))
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));
      const agendamentosPlanoCiclo = (dadosAgendamentos || [])
        .filter(a => {
          const status = String(a.status || '').toLowerCase();
          const tipoAgendamento = String(a.tipo_cliente || '').toLowerCase();
          return tipoAgendamento === 'assinante'
            && !['cancelado', 'cancelada'].includes(status)
            && dentroDoCiclo(a.data_hora || a.created_at);
        })
        .map(a => ({
          id: a.id,
          created_at: a.data_hora || a.created_at,
          tipo_corte: a.planos?.nome || a.servicos?.nome || 'Servico do plano',
          status: a.status || 'agendado',
        }));
      const cortesUsoPlanoCiclo = [...cortesDoCiclo, ...agendamentosPlanoCiclo]
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));
      const todosCortes = (cli.historico_cortes || [])
        .filter(c => String(c.status || 'feito').toLowerCase() !== 'cancelado')
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));

      const planoInfo = tipo !== 'avulso' && temPlano ? mapa[ass.plano_escolhido] : null;
      const ilimitado = Boolean(planoInfo?.ilimitado);
      const limite = ilimitado ? 0 : planoInfo?.limite || 5;
      setHistoricoMes(tipo === 'ativo' ? cortesUsoPlanoCiclo : []);
      setHistoricoCompleto(todosCortes);

      const dataCadastro = parseDataSupabase(vinculoEmpresa?.created_at);
      setDados({
        nome: cli.nome,
        whatsapp: cli.whatsapp,
        email: cli.email,
        iniciais: cli.nome.substring(0, 2).toUpperCase(),
        clienteDesde: dataCadastro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        alteracoesNome: cli.alteracoes_nome || 0,
        status: tipo === 'vencido' ? 'vencido' : tipo === 'avulso' ? null : statusAss || null,
        ilimitado,
        limiteTotal: limite,
        cortesRestantes: ilimitado ? null : tipo === 'ativo' ? Math.max(0, limite - cortesUsoPlanoCiclo.length) : limite,
        vencimentoFormatado: ass?.data_vencimento
          ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '--/--',
        dataVencimento: ass?.data_vencimento || null,
        ativadaEm: ass?.ativada_em || null,
        planoId: tipo === 'avulso' ? null : ass?.plano_escolhido || null,
        planoNome: planoInfo?.nome || 'Plano',
        planoUuid: planoInfo?.id || null,
        duracaoMinutos: Number(planoInfo?.duracao_minutos || 30),
        precoPlano: planoInfo?.preco || 0,
        proximoPlano: ass?.proximo_plano,
        upgradePendente: ass?.upgrade_pendente,
        renovacaoPendente: ass?.solicitacao_tipo === 'renovacao',
        solicitacaoPlanoSlug: ass?.solicitacao_plano_slug || null,
        solicitacaoPlanoNome: ass?.solicitacao_plano_nome || null,
        planoVencido: tipo === 'vencido',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (authLoading) return;
    if (!empresaId) return;
    if (!empresaSlug || empresaAtual?.slug !== empresaSlug) {
      navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/');
      return;
    }

    const clienteId = clienteIdAtual();
    if (!clienteId) {
      navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/');
      return;
    }
    carregarDados(clienteId);
  }, [navigate, authLoading, empresaId, empresaSlug, empresaAtual?.slug, clienteIdAtual, carregarDados]);

  useEffect(() => {
    tipoClienteRef.current = tipoCliente;
    ativadaEmRef.current = dados?.ativadaEm || null;
  }, [dados?.ativadaEm, tipoCliente]);

  useEffect(() => {
    const clienteId = user?.id;
    if (!empresaId || !clienteId) return undefined;

    const channel = supabase
      .channel(`cliente-assinatura-${empresaId}-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'assinaturas',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload) => {
          const assinaturaNova = payload.new || {};
          if (assinaturaNova.cliente_id !== clienteId) return;

          const foiAtivada = assinaturaNova.status === 'ativa'
            && (
              tipoClienteRef.current !== 'ativo'
              || assinaturaNova.ativada_em !== ativadaEmRef.current
            );

          if (foiAtivada) {
            setPlanoAtivadoEvento({
              id: `${assinaturaNova.id}-${assinaturaNova.ativada_em || Date.now()}`,
              planoSlug: assinaturaNova.plano_escolhido,
            });
          }

          carregarDados(clienteId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarDados, empresaId, user?.id]);

  return {
    dados,
    setDados,
    historicoMes,
    loading,
    tipoCliente,
    agendamentoAtivo,
    servicosAvulsos,
    agendamentos,
    historicoCompleto,
    planosDb,
    mapaPlanos,
    prazoCancelamentoMinutos,
    planoAtivadoEvento,
    limparPlanoAtivadoEvento,
    clienteIdAtual,
    carregarDados,
  };
}
