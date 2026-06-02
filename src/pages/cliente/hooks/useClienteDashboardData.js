/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
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
        supabase.from('agendamentos').select('*, servicos(nome, preco), filiais(nome), barbeiros(nome)').eq('empresa_id', empresaId).eq('cliente_id', id).order('created_at', { ascending: false }).limit(20),
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
          nome, whatsapp, alteracoes_nome,
          assinaturas(status, data_vencimento, plano_escolhido, proximo_plano, upgrade_pendente, created_at),
          historico_cortes(id, created_at, tipo_corte, status, origem, plano_slug, cancelavel_ate, cancelado_em)
        `)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .single();

      if (error) throw error;

      const assinaturasOrdenadas = ordenarAssinaturasRecentes(cli.assinaturas || []);
      const assinaturaAtiva = assinaturasOrdenadas.find(a => a.plano_escolhido && assinaturaEstaVigente(a));
      const assinaturaPendente = assinaturasOrdenadas.find(a => a.plano_escolhido && a.status === 'pendente');
      const ass = assinaturaAtiva || assinaturaPendente || assinaturasOrdenadas.find(a => a.plano_escolhido) || null;
      const temPlano = !!ass?.plano_escolhido;
      const statusAss = ass?.status;
      const tipo = assinaturaAtiva ? 'ativo' : assinaturaPendente ? 'pendente' : 'avulso';

      setTipoCliente(tipo);

      const hoje = new Date();
      const cortesDoMes = (cli.historico_cortes || [])
        .filter(c => String(c.status || 'feito').toLowerCase() !== 'cancelado')
        .filter(c => {
          const d = parseDataSupabase(c.created_at);
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        })
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));
      const agendamentosPlanoMes = (dadosAgendamentos || [])
        .filter(a => {
          const status = String(a.status || '').toLowerCase();
          const tipoAgendamento = String(a.tipo_cliente || '').toLowerCase();
          const d = parseDataSupabase(a.data_hora || a.created_at);
          return tipoAgendamento === 'assinante'
            && !['cancelado', 'cancelada'].includes(status)
            && d.getMonth() === hoje.getMonth()
            && d.getFullYear() === hoje.getFullYear();
        })
        .map(a => ({
          id: a.id,
          created_at: a.data_hora || a.created_at,
          tipo_corte: a.servicos?.nome || 'Servico do plano',
          status: a.status || 'agendado',
        }));
      const cortesUsoPlanoMes = [...cortesDoMes, ...agendamentosPlanoMes]
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));
      const todosCortes = (cli.historico_cortes || [])
        .filter(c => String(c.status || 'feito').toLowerCase() !== 'cancelado')
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));

      const planoInfo = tipo !== 'avulso' && temPlano ? mapa[ass.plano_escolhido] : null;
      const ilimitado = Boolean(planoInfo?.ilimitado);
      const limite = ilimitado ? 0 : planoInfo?.limite || 5;
      setHistoricoMes(tipo === 'ativo' ? cortesUsoPlanoMes : []);
      setHistoricoCompleto(todosCortes);

      const dataCadastro = parseDataSupabase(vinculoEmpresa?.created_at);
      setDados({
        nome: cli.nome,
        whatsapp: cli.whatsapp,
        iniciais: cli.nome.substring(0, 2).toUpperCase(),
        clienteDesde: dataCadastro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        alteracoesNome: cli.alteracoes_nome || 0,
        status: tipo === 'avulso' ? null : statusAss || null,
        ilimitado,
        limiteTotal: limite,
        cortesRestantes: ilimitado ? null : tipo === 'ativo' ? Math.max(0, limite - cortesUsoPlanoMes.length) : limite,
        vencimentoFormatado: ass?.data_vencimento
          ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '--/--',
        planoId: tipo === 'avulso' ? null : ass?.plano_escolhido || null,
        planoNome: planoInfo?.nome || 'Plano',
        servicoId: planoInfo?.servico_id || null,
        duracaoMinutos: Number(planoInfo?.duracao_minutos || 30),
        precoPlano: planoInfo?.preco || 0,
        proximoPlano: ass?.proximo_plano,
        upgradePendente: ass?.upgrade_pendente,
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
    clienteIdAtual,
    carregarDados,
  };
}
