import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import ModalAlerta from "../components/ModalAlerta";
import ModalAgendamento from "../components/ModalAgendamento";
import { useAuth } from '../../contexts/AuthContext';
import DrawerClientes from './DrawerClientes';

const getClienteId = () => {
  const id = localStorage.getItem('clienteId') || sessionStorage.getItem('clienteId');
  if (id) {
    localStorage.setItem('clienteId', id);
    sessionStorage.setItem('clienteId', id);
  }
  return id;
};

const parseDataSupabase = (dataStr) => {
  if (!dataStr) return new Date();
  const dataLimpa = dataStr.split('.')[0].replace(' ', 'T') + 'Z';
  return new Date(dataLimpa);
};

export default function ClienteDashboard() {
  const { loading: authLoading } = useAuth();
  const [dados, setDados] = useState(null);
  const [historicoMes, setHistoricoMes] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvandoCorte, setSalvandoCorte] = useState(false);
  const [corteCancelavel, setCorteCancelavel] = useState(null);
  const navigate = useNavigate();

  // Estados de tipo e configuração
  const [tipoCliente, setTipoCliente] = useState(null); // 'avulso' | 'pendente' | 'ativo'
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);

  // Modal de agendamento
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);

  // Serviços e agendamentos (avulso)
  const [servicosAvulsos, setServicosAvulsos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [planosDb, setPlanosDb] = useState([]);
  const [mapaPlanos, setMapaPlanos] = useState({});
  const [melhorPlano, setMelhorPlano] = useState(null);

  // Checkout (assinante pendente/ativo)
  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [pixCopiado, setPixCopiado] = useState(false);

  // Edição de nome
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const LIMITE_ALTERACOES = 2;

  const CHAVE_PIX = "81988468182";
  const WHATSAPP_JOAO = "5581988468182";

  const [configModalAlerta, setConfigModalAlerta] = useState({
    isOpen: false, type: 'alert', title: '', message: '', onConfirm: null
  });

  useEffect(() => {
    if (authLoading) return;
    const clienteId = getClienteId();
    if (!clienteId) { navigate('/'); return; }
    carregarDados(clienteId);
  }, [navigate, authLoading]);

  // Controle de cancelamento de corte (somente assinante ativo)
  useEffect(() => {
    if (tipoCliente !== 'ativo') return;
    const verificar = () => {
      if (historicoMes.length > 0) {
        const ultimo = historicoMes[0];
        const diff = (new Date().getTime() - parseDataSupabase(ultimo.created_at).getTime()) / 60000;
        setCorteCancelavel(diff >= 0 && diff <= 15 ? ultimo : null);
      } else {
        setCorteCancelavel(null);
      }
    };
    verificar();
    const interval = setInterval(verificar, 5000);
    return () => clearInterval(interval);
  }, [historicoMes, tipoCliente]);

  async function carregarDados(id) {
    try {
      const [
        { data: dadosPlanos },
        { data: dadosServicos },
        { data: dadosAgendamentos },
        { data: cfg },
      ] = await Promise.all([
        supabase.from('planos').select('*').eq('ativo', true),
        supabase.from('servicos').select('*').eq('ativo', true).order('created_at', { ascending: true }),
        supabase.from('agendamentos').select('*, servicos(nome), filiais(nome), barbeiros(nome)').eq('cliente_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('configuracoes').select('valor').eq('chave', 'fluxo_agendamento').single(),
      ]);

      const mapa = {};
      (dadosPlanos || []).forEach(p => { mapa[p.slug] = p; });
      setPlanosDb(dadosPlanos || []);
      setMapaPlanos(mapa);
      setServicosAvulsos(dadosServicos || []);
      setAgendamentos(dadosAgendamentos || []);
      setAgendamentoAtivo(cfg?.valor?.agendamento_ativo === true);

      // Plano mais barato para comparação
      const planos = dadosPlanos || [];
      if (planos.length > 0) {
        const mais_barato = planos.reduce((a, b) => a.preco < b.preco ? a : b);
        setMelhorPlano(mais_barato);
      }

      const { data: cli, error } = await supabase
        .from('clientes')
        .select(`
          nome, whatsapp, alteracoes_nome,
          assinaturas(status, data_vencimento, plano_escolhido, proximo_plano, upgrade_pendente),
          historico_cortes(id, created_at, tipo_corte)
        `)
        .eq('id', id).single();

      if (error) throw error;

      const ass = cli.assinaturas?.[0];
      const temPlano = !!ass?.plano_escolhido;
      const statusAss = ass?.status;

      // Determina tipo do cliente
      let tipo = 'avulso';
      if (temPlano && statusAss === 'ativa') tipo = 'ativo';
      else if (temPlano) tipo = 'pendente';

      // Se agendamento desativado e cliente avulso → força ir para planos
      if (!cfg?.valor?.agendamento_ativo && tipo === 'avulso') {
        navigate('/planos');
        return;
      }

      setTipoCliente(tipo);

      if (tipo === 'ativo') {
        const hoje = new Date();
        const cortesDoMes = (cli.historico_cortes || []).filter(c => {
          const d = parseDataSupabase(c.created_at);
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        });
        cortesDoMes.sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));
        setHistoricoMes(cortesDoMes);

        const planoInfo = mapa[ass.plano_escolhido];
        const limite = planoInfo?.limite || 4;

        setDados({
          nome: cli.nome,
          whatsapp: cli.whatsapp,
          iniciais: cli.nome.substring(0, 2).toUpperCase(),
          alteracoesNome: cli.alteracoes_nome || 0,
          status: statusAss,
          limiteTotal: limite,
          cortesRestantes: Math.max(0, limite - cortesDoMes.length),
          vencimentoFormatado: ass.data_vencimento
            ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : '--/--',
          planoId: ass.plano_escolhido,
          planoNome: planoInfo?.nome || 'Plano',
          precoPlano: planoInfo?.preco || 0,
          proximoPlano: ass.proximo_plano,
          upgradePendente: ass.upgrade_pendente,
        });
      } else {
        // pendente ou avulso: dados básicos
        const planoInfo = temPlano ? mapa[ass.plano_escolhido] : null;
        const limite = planoInfo?.limite || 4;
        setDados({
          nome: cli.nome,
          whatsapp: cli.whatsapp,
          iniciais: cli.nome.substring(0, 2).toUpperCase(),
          alteracoesNome: cli.alteracoes_nome || 0,
          status: statusAss || null,
          limiteTotal: limite,
          cortesRestantes: limite,
          vencimentoFormatado: ass?.data_vencimento
            ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : '--/--',
          planoId: ass?.plano_escolhido || null,
          planoNome: planoInfo?.nome || 'Plano',
          precoPlano: planoInfo?.preco || 0,
          upgradePendente: ass?.upgrade_pendente,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const fecharModalAlerta = () => setConfigModalAlerta(p => ({ ...p, isOpen: false }));
  const exibirAlerta = (title, message) => setConfigModalAlerta({ isOpen: true, type: 'alert', title, message, onConfirm: null });
  const exibirConfirmacao = (title, message, acao) => setConfigModalAlerta({ isOpen: true, type: 'confirm', title, message, onConfirm: acao });

  const copiarPix = () => {
    navigator.clipboard.writeText(CHAVE_PIX);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 3000);
  };

  // ---- Funções assinante ativo ----
  const alterarPlano = (novoPlanoId) => {
    if (novoPlanoId === dados.planoId) return;
    setMenuAberto(false);
    if (dados.status !== 'ativa') { efetuarMudancaPlanoDireta(novoPlanoId); return; }
    const valorNovo = mapaPlanos[novoPlanoId].preco;
    const valorAtual = mapaPlanos[dados.planoId].preco;
    if (valorNovo < valorAtual) {
      exibirConfirmacao('Agendar Mudança', `Você já possui o plano ${dados.planoNome} ativo. A mudança para ${mapaPlanos[novoPlanoId].nome} será agendada para seu próximo vencimento (${dados.vencimentoFormatado}).`, () => efetuarAgendamentoDowngrade(novoPlanoId));
    } else {
      const diferenca = valorNovo - valorAtual;
      exibirConfirmacao('Fazer Upgrade', `Deseja mudar para ${mapaPlanos[novoPlanoId].nome}? Pague apenas a diferença de R$ ${diferenca},00 para liberar hoje mesmo.`, () => prepararUpgrade(novoPlanoId, diferenca));
    }
  };

  const cancelarAgendamento = () => {
    exibirConfirmacao('Cancelar Agendamento', `Deseja cancelar a mudança agendada e manter seu plano atual (${dados.planoNome})?`, async () => {
      fecharModalAlerta();
      await supabase.from('assinaturas').update({ proximo_plano: null }).eq('cliente_id', getClienteId());
      carregarDados(getClienteId());
    });
  };

  const efetuarMudancaPlanoDireta = async (novoPlano) => {
    await supabase.from('assinaturas').update({ plano_escolhido: novoPlano }).eq('cliente_id', getClienteId());
    carregarDados(getClienteId());
  };

  const efetuarAgendamentoDowngrade = async (proximo) => {
    fecharModalAlerta();
    await supabase.from('assinaturas').update({ proximo_plano: proximo }).eq('cliente_id', getClienteId());
    carregarDados(getClienteId());
  };

  const prepararUpgrade = (planoUpgrade, valorDiferenca) => {
    fecharModalAlerta();
    setDados(prev => ({ ...prev, valorUpgrade: valorDiferenca, planoUpgradeId: planoUpgrade }));
    setModalCheckoutAberto(true);
  };

  const abrirWhatsappPagamento = async () => {
    const isUpgrade = !!dados.valorUpgrade;
    let mensagem = `Olá João! Me chamo *${dados.nome}*.\n`;
    if (isUpgrade) {
      mensagem += `Estou solicitando o Upgrade para o plano *${mapaPlanos[dados.planoUpgradeId].nome}*! 🚀\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
      await supabase.from('assinaturas').update({ upgrade_pendente: dados.planoUpgradeId }).eq('cliente_id', getClienteId());
    } else {
      mensagem += `Estou solicitando a ativação do *Plano ${dados.planoNome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
    }
    window.open(`https://wa.me/${WHATSAPP_JOAO}?text=${encodeURIComponent(mensagem)}`, '_blank');
    setModalCheckoutAberto(false);
    if (isUpgrade) carregarDados(getClienteId());
  };

  const salvarNovoNome = async () => {
    if (!novoNome.trim() || novoNome === dados.nome) return setEditandoNome(false);
    await supabase.from('clientes').update({ nome: novoNome, alteracoes_nome: dados.alteracoesNome + 1 }).eq('id', getClienteId());
    carregarDados(getClienteId());
    setEditandoNome(false);
  };

  const handleConfirmarCorte = () => {
    if (dados.cortesRestantes <= 0) return exibirAlerta('Limite Atingido', 'Cortes esgotados este mês.');
    if (historicoMes.length > 0) {
      const dataUltimo = parseDataSupabase(historicoMes[0].created_at).toLocaleDateString('pt-BR');
      if (dataUltimo === new Date().toLocaleDateString('pt-BR')) return exibirAlerta('Atenção', 'Você já registrou um corte hoje! Retorne amanhã.');
    }
    exibirConfirmacao('Confirmar Serviço', `Deseja registrar "${dados.planoNome}" agora?\n\n(Você poderá cancelar em até 15 minutos.)`, efetuarCorteNoBanco);
  };

  const efetuarCorteNoBanco = async () => {
    if (salvandoCorte) return;
    setSalvandoCorte(true);
    try {
      await supabase.from('historico_cortes').insert([{ cliente_id: getClienteId(), tipo_corte: dados.planoNome }]);
      fecharModalAlerta();
      navigate('/confirmado');
    } catch (e) {
      fecharModalAlerta();
      setSalvandoCorte(false);
    }
  };

  const handleCancelarCorte = () => {
    exibirConfirmacao('Cancelar Corte', 'Tem certeza? O limite de corte será devolvido.', async () => {
      if (salvandoCorte) return;
      setSalvandoCorte(true);
      fecharModalAlerta();
      const { error } = await supabase.from('historico_cortes').delete().eq('id', corteCancelavel.id);
      if (!error) {
        await carregarDados(getClienteId());
        exibirAlerta('Cancelado', 'Seu corte foi cancelado e o limite retornado.');
      } else {
        exibirAlerta('Erro', 'Não foi possível cancelar. O prazo de 15 minutos pode ter expirado.');
      }
      setSalvandoCorte(false);
    });
  };

  const handleFechamentoAgendamento = (resultado) => {
    setModalAgendamentoAberto(false);
    if (resultado?.sucesso) {
      exibirAlerta('Agendado!', 'Seu agendamento foi confirmado. Te esperamos na barbearia!');
      carregarDados(getClienteId());
    }
    if (resultado?.irParaPlanos) navigate('/planos');
  };

  const fecharMenu = () => { setMenuAberto(false); setEditandoNome(false); };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    navigate('/');
  };

  if (loading || !dados) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-[#CEAA6B] font-bold uppercase tracking-widest text-xs">
      Carregando...
    </div>
  );

  // =============================================
  // RENDER: CLIENTE AVULSO (agendamento ativo)
  // =============================================
  if (tipoCliente === 'avulso') {
    return (
      <div className="min-h-screen bg-[#09090b] text-white font-sans flex flex-col">
        <ModalAlerta isOpen={configModalAlerta.isOpen} onClose={fecharModalAlerta} onConfirm={configModalAlerta.onConfirm} title={configModalAlerta.title} message={configModalAlerta.message} type={configModalAlerta.type} />
        <ModalAgendamento
          isOpen={modalAgendamentoAberto}
          onClose={handleFechamentoAgendamento}
          clienteId={getClienteId()}
          clienteNome={dados.nome}
          tipoCliente="avulso"
        />

        {/* HEADER */}
        <div className="flex justify-between items-center px-5 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#CEAA6B] rounded-full"></div>
            <span className="text-[#CEAA6B] text-[10px] font-bold tracking-[0.2em] uppercase">joao barber</span>
          </div>
          <button onClick={() => setMenuAberto(true)} className="w-10 h-10 rounded-full border border-[#CEAA6B]/30 flex items-center justify-center bg-[#121212] text-[#CEAA6B] font-bold text-sm">
            {dados.iniciais}
          </button>
        </div>

        <DrawerClientes isOpen={menuAberto} onClose={fecharMenu} dados={dados} editandoNome={editandoNome} setEditandoNome={setEditandoNome} novoNome={novoNome} setNovoNome={setNovoNome} salvarNovoNome={salvarNovoNome} LIMITE_ALTERACOES={LIMITE_ALTERACOES} planosDb={planosDb} alterarPlano={alterarPlano} cancelarAgendamento={cancelarAgendamento} onLogout={handleLogout} />

        <div className="flex-1 overflow-y-auto px-5 pb-32 space-y-5">
          {/* Saudação */}
          <div className="pt-2">
            <p className="text-zinc-500 text-xs">Bem-vindo de volta,</p>
            <h1 className="text-2xl font-black text-white">{dados.nome.split(' ')[0]} 👋</h1>
          </div>

          {/* Serviços */}
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Serviços disponíveis</p>
            <div className="space-y-3">
              {servicosAvulsos.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[#27272a] rounded-2xl">
                  <p className="text-zinc-600 text-xs italic">Nenhum serviço disponível no momento.</p>
                </div>
              ) : servicosAvulsos.map(s => (
                <div key={s.id} className="bg-[#121212] border border-[#27272a] rounded-[20px] p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-black text-base text-white">{s.nome}</p>
                      <p className="text-zinc-600 text-[10px] mt-0.5">{s.duracao_minutos} min</p>
                    </div>
                    <span className="text-[#CEAA6B] font-black text-xl">R$ {Number(s.preco).toFixed(0)}</span>
                  </div>
                  {/* Comparação com plano */}
                  {melhorPlano && (
                    <div className="bg-[#0f0a05] border border-[#CEAA6B]/15 rounded-xl p-3">
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        Fazendo <span className="text-white font-bold">4x no mês</span> você gastaria{' '}
                        <span className="line-through text-red-400/60">R$ {(Number(s.preco) * 4).toFixed(0)}</span>.{' '}
                        No <span className="text-[#CEAA6B] font-bold">Plano {melhorPlano.nome}</span> você paga{' '}
                        <span className="text-[#CEAA6B] font-bold">R$ {Number(melhorPlano.preco).toFixed(0)}/mês</span> e economiza{' '}
                        <span className="text-emerald-400 font-bold">R$ {Math.max(0, (Number(s.preco) * 4) - Number(melhorPlano.preco)).toFixed(0)}</span>.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Banner plano mensal */}
          <div className="bg-gradient-to-r from-[#1a120b] to-[#120d06] border border-[#CEAA6B]/25 rounded-[20px] p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-[#CEAA6B] uppercase tracking-widest mb-1">Plano Mensal</p>
              <p className="text-xs text-zinc-400 leading-relaxed">Economize com uma mensalidade fixa e ilimitada.</p>
            </div>
            <button onClick={() => navigate('/planos')} className="flex-shrink-0 bg-[#CEAA6B] text-black font-black text-[9px] uppercase tracking-widest px-4 py-2.5 rounded-xl active:scale-95 transition-all">
              Ver Planos
            </button>
          </div>

          {/* Histórico de agendamentos */}
          {agendamentos.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Meus agendamentos</p>
              <div className="space-y-2">
                {agendamentos.map((ag, i) => {
                  const dataAg = ag.data_hora ? new Date(ag.data_hora) : null;
                  const statusColor = ag.status === 'agendado' ? 'text-[#CEAA6B]' : ag.status === 'concluido' ? 'text-emerald-500' : 'text-red-500';
                  return (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-[#121212] border border-[#27272a]">
                      <div>
                        <p className="text-sm font-bold text-white">{ag.servicos?.nome || 'Serviço'}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {dataAg ? `${dataAg.toLocaleDateString('pt-BR')} às ${dataAg.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Sem data'}
                          {ag.barbeiros?.nome ? ` • ${ag.barbeiros.nome}` : ''}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${statusColor}`}>{ag.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Botão fixo no rodapé */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent">
          <button
            onClick={() => setModalAgendamentoAberto(true)}
            className="w-full bg-[#CEAA6B] text-black font-black py-4 rounded-2xl uppercase tracking-wider text-sm active:scale-95 transition-all shadow-[0_0_30px_rgba(206,170,107,0.25)]"
          >
            Agendar Serviço
          </button>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER: CLIENTE COM PLANO (pendente ou ativo)
  // =============================================
  const isPendente = tipoCliente === 'pendente';

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-5 font-sans flex flex-col relative overflow-hidden">
      <ModalAlerta isOpen={configModalAlerta.isOpen} onClose={fecharModalAlerta} onConfirm={configModalAlerta.onConfirm} title={configModalAlerta.title} message={configModalAlerta.message} type={configModalAlerta.type} />
      {agendamentoAtivo && (
        <ModalAgendamento
          isOpen={modalAgendamentoAberto}
          onClose={handleFechamentoAgendamento}
          clienteId={getClienteId()}
          clienteNome={dados.nome}
          tipoCliente="assinante"
        />
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#CEAA6B] rounded-full"></div>
          <span className="text-[#CEAA6B] text-[10px] font-bold tracking-[0.2em] uppercase">joao barber</span>
        </div>
        <button onClick={() => setMenuAberto(true)} className="w-10 h-10 rounded-full border border-[#CEAA6B]/30 flex items-center justify-center bg-[#121212] text-[#CEAA6B] font-bold text-sm">
          {dados.iniciais}
        </button>
      </div>

      <DrawerClientes isOpen={menuAberto} onClose={fecharMenu} dados={dados} editandoNome={editandoNome} setEditandoNome={setEditandoNome} novoNome={novoNome} setNovoNome={setNovoNome} salvarNovoNome={salvarNovoNome} LIMITE_ALTERACOES={LIMITE_ALTERACOES} planosDb={planosDb} alterarPlano={alterarPlano} cancelarAgendamento={cancelarAgendamento} onLogout={handleLogout} />

      {/* BANNER PENDENTE */}
      {isPendente && (
        <div className="p-4 rounded-2xl border mb-5 bg-[#1a120b] border-orange-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></div>
            <span className="text-[13px] font-black uppercase tracking-wide text-orange-500">
              {dados.upgradePendente ? 'Upgrade em Análise' : 'Aguardando Ativação'}
            </span>
          </div>
          <p className="text-zinc-400 text-[12px] leading-relaxed">
            {dados.upgradePendente
              ? `Aguardando aprovação do upgrade para ${mapaPlanos[dados.upgradePendente]?.nome}.`
              : 'Efetue o pagamento para liberar seu acesso. Veja abaixo como ficará seu plano!'}
          </p>
        </div>
      )}

      {/* INFO CARDS */}
      <div className={`bg-[#121212] border border-[#27272a] rounded-[20px] p-4 flex items-center gap-4 mb-4 ${isPendente ? 'opacity-60' : ''}`}>
        <div className="w-14 h-14 rounded-full border border-[#CEAA6B]/30 flex items-center justify-center text-[#CEAA6B] font-medium text-lg">{dados.iniciais}</div>
        <div>
          <h2 className="font-bold text-base text-white">{dados.nome}</h2>
          <div className="inline-block mt-1 border border-[#CEAA6B]/30 rounded-md px-2 py-1">
            <p className="text-[#CEAA6B] text-[10px] font-medium uppercase">Plano {dados.planoNome}</p>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-3 mb-6 ${isPendente ? 'opacity-60' : ''}`}>
        <div className="bg-[#121212] border border-[#27272a] p-4 rounded-[20px] flex flex-col items-center relative overflow-hidden">
          {isPendente && <div className="absolute inset-0 bg-[#09090b]/40 backdrop-blur-[1px] rounded-[20px] z-10 flex items-center justify-center"><span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Bloqueado</span></div>}
          <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mb-3">Cortes Restantes</p>
          <div className="flex flex-wrap justify-center gap-1.5 mb-2">
            {[...Array(dados.limiteTotal)].map((_, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-[3px] ${i < dados.cortesRestantes ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}></div>
            ))}
          </div>
          <p className="text-2xl font-bold text-[#CEAA6B]">{dados.cortesRestantes} <span className="text-zinc-500 text-[10px] font-normal">de {dados.limiteTotal}</span></p>
        </div>
        <div className={`bg-[#121212] border border-[#27272a] p-4 rounded-[20px] flex flex-col items-center justify-center relative overflow-hidden`}>
          {isPendente && <div className="absolute inset-0 bg-[#09090b]/40 backdrop-blur-[1px] rounded-[20px] z-10 flex items-center justify-center"><span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Bloqueado</span></div>}
          <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mb-2">Vencimento</p>
          <p className="text-[26px] font-bold text-white">{dados.vencimentoFormatado}</p>
        </div>
      </div>

      {/* HISTÓRICO */}
      <div className={`mb-6 flex-grow flex flex-col min-h-0 ${isPendente ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-end mb-3 pl-1">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Histórico do mês</p>
          {historicoMes.length > 0 && (
            <p className="text-[#CEAA6B] text-[9px] font-bold uppercase tracking-widest bg-[#CEAA6B]/10 px-2 py-0.5 rounded">
              {historicoMes.length} {historicoMes.length === 1 ? 'corte' : 'cortes'}
            </p>
          )}
        </div>
        <div className="space-y-2 overflow-y-auto pr-1 pb-1 max-h-[200px]">
          {historicoMes.length > 0 ? historicoMes.map((c, i) => {
            const dataCorte = parseDataSupabase(c.created_at);
            return (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-[#121212] border border-[#27272a]">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#1a120b] border border-[#CEAA6B]/20 flex items-center justify-center text-[#CEAA6B]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{c.tipo_corte}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                      <span>{dataCorte.toLocaleDateString('pt-BR')}</span>
                      <span>•</span>
                      <span>{dataCorte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="w-2 h-2 bg-[#22c55e] rounded-full shadow-[0_0_6px_rgba(34,197,94,0.6)]"></div>
                  <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider">Feito</span>
                </div>
              </div>
            );
          }) : (
            <div className="p-6 text-center border border-dashed border-[#27272a] rounded-2xl">
              <p className="text-zinc-600 text-xs italic">
                {isPendente ? 'Ative seu plano para começar a registrar cortes.' : 'Nenhum serviço registrado neste mês.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* BOTÃO PRINCIPAL */}
      <div className="mt-4 space-y-2">
        {isPendente ? (
          <button onClick={() => { setDados(prev => ({ ...prev, valorUpgrade: null })); setModalCheckoutAberto(true); }} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl active:scale-95 transition-all">
            Pagar e Ativar Plano
          </button>
        ) : corteCancelavel ? (
          <button disabled={salvandoCorte} onClick={handleCancelarCorte} className="w-full bg-red-500/10 text-red-500 border border-red-500/50 font-bold py-4 rounded-2xl transition-all">
            {salvandoCorte ? 'Cancelando...' : 'Cancelar Corte (Até 15 min)'}
          </button>
        ) : (
          <>
            <button disabled={dados.cortesRestantes === 0 || salvandoCorte} onClick={handleConfirmarCorte} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl transition-all disabled:opacity-50">
              {salvandoCorte ? 'Registrando...' : dados.cortesRestantes > 0 ? 'Confirmar Serviço' : 'Limite Esgotado'}
            </button>
            {agendamentoAtivo && (
              <button onClick={() => setModalAgendamentoAberto(true)} className="w-full bg-transparent border border-[#CEAA6B]/40 text-[#CEAA6B] font-bold py-3 rounded-2xl text-sm transition-all active:scale-95">
                Agendar Horário
              </button>
            )}
          </>
        )}
      </div>

      {/* MODAL DE CHECKOUT */}
      {modalCheckoutAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-0">
          <div className="bg-[#121212] border border-[#27272a] rounded-t-[32px] sm:rounded-[32px] w-full max-w-[400px] p-6 pb-10 animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Pagamento</h3>
                <p className="text-[#CEAA6B] font-bold">
                  {dados.valorUpgrade ? `Upgrade para ${mapaPlanos[dados.planoUpgradeId]?.nome}` : `Plano ${dados.planoNome}`}
                  {' '}• R$ {dados.valorUpgrade || dados.precoPlano},00
                </p>
              </div>
              <button onClick={() => setModalCheckoutAberto(false)} className="w-8 h-8 flex items-center justify-center bg-[#27272a] text-zinc-400 rounded-full">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {['pix', 'cartao', 'dinheiro'].map(m => (
                <button key={m} onClick={() => setMetodoPagamento(m)} className={`py-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${metodoPagamento === m ? 'border-[#CEAA6B] bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'border-[#27272a] bg-[#09090b] text-zinc-500'}`}>{m}</button>
              ))}
            </div>
            {metodoPagamento === 'pix' ? (
              <>
                <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 mb-4 flex gap-2 items-center">
                  <input readOnly value={CHAVE_PIX} className="flex-1 bg-transparent text-[#25D366] text-sm outline-none" />
                  <button onClick={copiarPix} className="text-xs font-bold text-white bg-[#27272a] px-3 py-2 rounded-lg">{pixCopiado ? 'Copiado!' : 'Copiar'}</button>
                </div>
                <button onClick={abrirWhatsappPagamento} className="w-full bg-[#25D366] text-black font-bold py-4 rounded-xl mb-3">Enviar Comprovante</button>
              </>
            ) : (
              <div className="mb-4 text-center">
                <p className="text-zinc-400 text-xs leading-relaxed mb-4">
                  O pagamento via {metodoPagamento === 'cartao' ? 'cartão' : 'dinheiro'} deve ser realizado diretamente com o João na barbearia.
                </p>
                <button onClick={abrirWhatsappPagamento} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-xl mb-3">
                  Avisar João no WhatsApp
                </button>
              </div>
            )}
            <button onClick={() => { setModalCheckoutAberto(false); setMenuAberto(true); }} className="w-full text-zinc-500 text-xs font-bold uppercase py-2 hover:text-white transition-colors">Escolher outro plano</button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }` }} />
    </div>
  );
}
