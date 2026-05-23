/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import ModalAlerta from '../components/ModalAlerta';
import ModalAgendamento from '../components/ModalAgendamento';
import { useAuth } from '../../contexts/useAuth';
import DrawerClientes from './DrawerClientes';
import { limparSessaoPreservandoEmpresa, montarRotaEmpresa, normalizarTelefoneBrasil } from '../../services/empresa';
import ClienteDashboardAvulso from './ClienteDashboardAvulso';
import ClienteDashboardPlano from './ClienteDashboardPlano';
import { parseDataSupabase } from './clienteDashboardUtils';

const getClienteId = (userId) => {
  const id = userId || localStorage.getItem('clienteId') || sessionStorage.getItem('clienteId');
  if (id) {
    localStorage.setItem('clienteId', id);
    sessionStorage.setItem('clienteId', id);
  }
  return id;
};

function Icon({ name, className = 'w-5 h-5' }) {
  const icons = {
    menu: <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    crown: <><path d="m2 8 4 10h12l4-10-6 4-4-7-4 7-6-4z" /><path d="M6 18h12" /></>,
    scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9" /><path d="M14.5 14.5 20 20" /><path d="M8.1 8.1 12 12" /></>,
    tool: <><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.8-2.8 2.2-2.6z" /></>,
    sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="m5 3 .7 2.3L8 6l-2.3.7L5 9l-.7-2.3L2 6l2.3-.7L5 3z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" /></>,
    calendar: <><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></>,
    calendarOff: <><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h7" /><path d="M14 10h7" /><path d="M10 21H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" /><path d="m16 16 5 5" /><path d="m21 16-5 5" /></>,
    check: <><path d="M20 6 9 17l-5-5" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    whatsapp: <><path d="M3 21 4.8 16.3A8.5 8.5 0 1 1 8 19.2L3 21z" /><path d="M9 9c.2 3 2.8 5.3 6 6" /></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><rect x="2" y="2" width="13" height="13" rx="2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    money: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v4h1" /></>,
    store: <><path d="M3 9h18l-1-5H4L3 9z" /><path d="M5 9v10h14V9" /><path d="M9 19v-6h6v6" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.sparkles}
    </svg>
  );
}

function TopBar({ onMenu, empresaNome }) {
  return (
    <div className="client-topbar">
      <button onClick={onMenu} className="ib">
        <Icon name="menu" />
      </button>
      <div className="client-brand">
        {empresaNome}
      </div>
      <button className="ib notif-dot">
        <Icon name="bell" />
      </button>
    </div>
  );
}

function ClienteShell({ children, onMenu, empresaNome }) {
  return (
    <div className="client-page-root">
      <div className="client-device">
        <TopBar onMenu={onMenu} empresaNome={empresaNome} />
        {children}
      </div>
    </div>
  );
}

export default function ClienteDashboard() {
  const { user, loading: authLoading, empresaAtual } = useAuth();
  const { empresaSlug } = useParams();
  const empresaId = empresaAtual?.id;
  const slugEmpresa = empresaAtual?.slug || empresaSlug;
  const navigate = useNavigate();

  const [dados, setDados] = useState(null);
  const [historicoMes, setHistoricoMes] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tipoCliente, setTipoCliente] = useState(null);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [servicoAgendamentoInicial, setServicoAgendamentoInicial] = useState(null);
  const [modoAgendamento, setModoAgendamento] = useState('avulso');
  const [servicosAvulsos, setServicosAvulsos] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [historicoCompleto, setHistoricoCompleto] = useState([]);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [planosDb, setPlanosDb] = useState([]);
  const [mapaPlanos, setMapaPlanos] = useState({});
  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);
  const [metodoPagamento] = useState('pix');
  const [pixCopiado, setPixCopiado] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const LIMITE_ALTERACOES = 2;

  const CHAVE_PIX = empresaAtual?.chave_pix || '81988468182';
  const WHATSAPP_JOAO = normalizarTelefoneBrasil(empresaAtual?.whatsapp || '5581988468182');
  const empresaNome = (empresaAtual?.nome || 'JOAO BARBER').toUpperCase();
  const clienteIdAtual = useCallback(() => getClienteId(user?.id), [user?.id]);

  const [configModalAlerta, setConfigModalAlerta] = useState({
    isOpen: false, type: 'alert', title: '', message: '', onConfirm: null,
  });

  const carregarDados = useCallback(async (id) => {
    try {
      const [
        { data: todosPlanos },
        { data: dadosPlanos },
        { data: dadosServicos },
        { data: dadosAgendamentos },
        { data: cfg },
        { data: vinculoEmpresa },
      ] = await Promise.all([
        supabase.from('planos').select('*').eq('empresa_id', empresaId),
        supabase.from('planos').select('*').eq('empresa_id', empresaId).eq('ativo', true).is('deleted_at', null).order('preco', { ascending: true }),
        supabase.from('servicos').select('*, servico_categorias(nome), servico_subcategorias(nome)').eq('empresa_id', empresaId).eq('ativo', true).is('deleted_at', null).order('created_at', { ascending: true }),
        supabase.from('agendamentos').select('*, servicos(nome), filiais(nome), barbeiros(nome)').eq('empresa_id', empresaId).eq('cliente_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('configuracoes').select('valor').eq('empresa_id', empresaId).eq('chave', 'fluxo_agendamento').maybeSingle(),
        supabase.from('usuarios_empresas').select('created_at').eq('empresa_id', empresaId).eq('user_id', id).maybeSingle(),
      ]);

      const mapa = {};
      (todosPlanos || []).forEach(p => { mapa[p.slug] = p; });
      setPlanosDb(dadosPlanos || []);
      setMapaPlanos(mapa);
      setServicosAvulsos(dadosServicos || []);
      setAgendamentos(dadosAgendamentos || []);
      setAgendamentoAtivo(cfg?.valor?.agendamento_ativo === true);
      const { data: cli, error } = await supabase
        .from('clientes')
        .select(`
          nome, whatsapp, alteracoes_nome,
          assinaturas(status, data_vencimento, plano_escolhido, proximo_plano, upgrade_pendente),
          historico_cortes(id, created_at, tipo_corte)
        `)
        .eq('empresa_id', empresaId)
        .eq('id', id)
        .single();

      if (error) throw error;

      const ass = cli.assinaturas?.find(a => a.plano_escolhido) || null;
      const temPlano = !!ass?.plano_escolhido;
      const statusAss = ass?.status;
      const tipo = temPlano && statusAss === 'ativa' ? 'ativo' : temPlano ? 'pendente' : 'avulso';

      setTipoCliente(tipo);

      const hoje = new Date();
      const cortesDoMes = (cli.historico_cortes || [])
        .filter(c => {
          const d = parseDataSupabase(c.created_at);
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        })
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));
      const todosCortes = (cli.historico_cortes || [])
        .sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));

      const planoInfo = temPlano ? mapa[ass.plano_escolhido] : null;
      const ilimitado = Boolean(planoInfo?.ilimitado);
      const limite = ilimitado ? 0 : planoInfo?.limite || 5;
      setHistoricoMes(tipo === 'ativo' ? cortesDoMes : []);
      setHistoricoCompleto(todosCortes);
      const dataCadastro = parseDataSupabase(vinculoEmpresa?.created_at);
      setDados({
        nome: cli.nome,
        whatsapp: cli.whatsapp,
        iniciais: cli.nome.substring(0, 2).toUpperCase(),
        clienteDesde: dataCadastro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        alteracoesNome: cli.alteracoes_nome || 0,
        status: statusAss || null,
        ilimitado,
        limiteTotal: limite,
        cortesRestantes: ilimitado ? null : tipo === 'ativo' ? Math.max(0, limite - cortesDoMes.length) : limite,
        vencimentoFormatado: ass?.data_vencimento
          ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '--/--',
        planoId: ass?.plano_escolhido || null,
        planoNome: planoInfo?.nome || 'Plano',
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

  const fecharModalAlerta = () => setConfigModalAlerta(p => ({ ...p, isOpen: false }));
  const exibirAlerta = (title, message) => setConfigModalAlerta({ isOpen: true, type: 'alert', title, message, onConfirm: null });
  const exibirConfirmacao = (title, message, acao) => setConfigModalAlerta({ isOpen: true, type: 'confirm', title, message, onConfirm: acao });

  const copiarPix = () => {
    navigator.clipboard.writeText(CHAVE_PIX);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 3000);
  };

  const alterarPlano = (novoPlanoId) => {
    if (novoPlanoId === dados.planoId) return;
    setMenuAberto(false);
    if (dados.status !== 'ativa') {
      efetuarMudancaPlanoDireta(novoPlanoId);
      return;
    }
    const valorNovo = mapaPlanos[novoPlanoId].preco;
    const valorAtual = mapaPlanos[dados.planoId].preco;
    if (valorNovo < valorAtual) {
      exibirConfirmacao('Agendar Mudança', `A mudança para ${mapaPlanos[novoPlanoId].nome} será agendada para seu próximo vencimento (${dados.vencimentoFormatado}).`, () => efetuarAgendamentoDowngrade(novoPlanoId));
    } else {
      prepararUpgrade(novoPlanoId, valorNovo - valorAtual);
    }
  };

  const cancelarAgendamento = () => {
    exibirConfirmacao('Cancelar Agendamento', `Deseja cancelar a mudança agendada e manter seu plano atual (${dados.planoNome})?`, async () => {
      fecharModalAlerta();
      await supabase.from('assinaturas').update({ proximo_plano: null }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
      carregarDados(clienteIdAtual());
    });
  };

  const efetuarMudancaPlanoDireta = async (novoPlano) => {
    await supabase.from('assinaturas').update({ plano_escolhido: novoPlano }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
    carregarDados(clienteIdAtual());
  };

  const efetuarAgendamentoDowngrade = async (proximo) => {
    fecharModalAlerta();
    await supabase.from('assinaturas').update({ proximo_plano: proximo }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
    carregarDados(clienteIdAtual());
  };

  const prepararUpgrade = (planoUpgrade, valorDiferenca) => {
    fecharModalAlerta();
    setDados(prev => ({ ...prev, valorUpgrade: valorDiferenca, planoUpgradeId: planoUpgrade }));
    setModalCheckoutAberto(true);
  };

  const abrirWhatsappPagamento = async () => {
    const isUpgrade = !!dados.valorUpgrade;
    let mensagem = `Olá! Me chamo *${dados.nome}*.\n`;
    if (isUpgrade) {
      mensagem += `Estou solicitando o upgrade para o plano *${mapaPlanos[dados.planoUpgradeId].nome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
      await supabase.from('assinaturas').update({ upgrade_pendente: dados.planoUpgradeId }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
    } else {
      mensagem += `Estou solicitando a ativação do *Plano ${dados.planoNome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
    }
    if (!isUpgrade) {
      localStorage.setItem(`pagamento_plano_${empresaId}_${clienteIdAtual()}_${dados.planoId || 'sem-plano'}`, 'iniciado');
    }
    window.open(`https://wa.me/${WHATSAPP_JOAO}?text=${encodeURIComponent(mensagem)}`, '_blank');
    setModalCheckoutAberto(false);
    if (isUpgrade) carregarDados(clienteIdAtual());
  };

  const salvarNovoNome = async () => {
    if (!novoNome.trim() || novoNome === dados.nome) return setEditandoNome(false);
    await supabase.from('clientes').update({ nome: novoNome, alteracoes_nome: dados.alteracoesNome + 1 }).eq('empresa_id', empresaId).eq('id', clienteIdAtual());
    carregarDados(clienteIdAtual());
    setEditandoNome(false);
  };

  const handleFechamentoAgendamento = (resultado) => {
    setModalAgendamentoAberto(false);
    setModoAgendamento(tipoCliente === 'ativo' ? 'plano' : 'avulso');
    setServicoAgendamentoInicial(null);
    if (resultado?.sucesso) {
      exibirAlerta('Agendado!', 'Seu agendamento foi confirmado. Te esperamos na barbearia.');
      carregarDados(clienteIdAtual());
    }
    if (resultado?.irParaPlanos) navigate(montarRotaEmpresa(slugEmpresa, '/planos'));
  };

  const fecharMenu = () => { setMenuAberto(false); setEditandoNome(false); };
  const abrirPlanos = () => {
    setMenuAberto(false);
    navigate(montarRotaEmpresa(slugEmpresa, '/planos'));
  };
  const abrirAgendamento = () => {
    setMenuAberto(false);
    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento Indisponível', 'No momento esta barbearia não está aceitando agendamento online.');
      return;
    }
    setModoAgendamento(tipoCliente === 'ativo' ? 'plano' : 'avulso');
    setServicoAgendamentoInicial(null);
    setModalAgendamentoAberto(true);
  };
  const abrirCheckoutPlano = () => {
    setMenuAberto(false);
    setDados(prev => ({ ...prev, valorUpgrade: null }));
    setModalCheckoutAberto(true);
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    limparSessaoPreservandoEmpresa();
    navigate(montarRotaEmpresa(slugEmpresa, ''));
  };

  const modalBase = (
    <>
      <ModalAlerta isOpen={configModalAlerta.isOpen} onClose={fecharModalAlerta} onConfirm={configModalAlerta.onConfirm} title={configModalAlerta.title} message={configModalAlerta.message} type={configModalAlerta.type} />
      {agendamentoAtivo && (
        <ModalAgendamento
          isOpen={modalAgendamentoAberto}
          onClose={handleFechamentoAgendamento}
          clienteId={clienteIdAtual()}
          clienteNome={dados?.nome}
          tipoCliente={modoAgendamento === 'plano' ? 'assinante' : 'avulso'}
          empresaId={empresaId}
          planoCliente={modoAgendamento === 'plano' ? dados : null}
          servicoInicialId={servicoAgendamentoInicial}
        />
      )}
      <DrawerClientes
        isOpen={menuAberto}
        onClose={fecharMenu}
        dados={dados}
        editandoNome={editandoNome}
        setEditandoNome={setEditandoNome}
        novoNome={novoNome}
        setNovoNome={setNovoNome}
        salvarNovoNome={salvarNovoNome}
        LIMITE_ALTERACOES={LIMITE_ALTERACOES}
        planosDb={planosDb}
        alterarPlano={alterarPlano}
        cancelarAgendamento={cancelarAgendamento}
        onLogout={handleLogout}
        agendamentoAtivo={agendamentoAtivo}
        tipoCliente={tipoCliente}
        onAgendar={abrirAgendamento}
        onVerPlanos={abrirPlanos}
        onPagarPlano={abrirCheckoutPlano}
        onHistoricoCompleto={() => {
          setMenuAberto(false);
          setModalHistoricoAberto(true);
        }}
      />
    </>
  );

  const checkoutModal = modalCheckoutAberto && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-0">
      <div className="client-device rounded-t-[28px] sm:rounded-[28px] min-h-0 max-h-[92vh] overflow-y-auto">
        <div className="back-bar">
          <button className="back-btn" onClick={() => setModalCheckoutAberto(false)}>
            <Icon name="chevron" className="w-4 h-4 rotate-180" />
          </button>
          <span className="back-title">Pagamento</span>
        </div>

        <div className="scroll" style={{ paddingTop: 12 }}>
          <div className="card">
            <div className="stat-lbl">PLANO SELECIONADO</div>
            <div className="flex items-center justify-between mt-2 gap-3">
              <div className="text-white text-sm font-semibold">
                {dados.valorUpgrade ? `Upgrade para ${mapaPlanos[dados.planoUpgradeId]?.nome}` : `Plano ${dados.planoNome}`}
              </div>
              <div className="text-[#d5b451] text-[22px] font-black">
                R${dados.valorUpgrade || dados.precoPlano}
              </div>
            </div>
          </div>

          <div className="pix-box">
            <div className="pix-title">
              <div className="pix-title-ico">
                <Icon name="money" className="w-4 h-4" />
              </div>
              <div className="text-white text-sm font-semibold">Pagar via Pix</div>
            </div>

            <div className="pix-key">
              <span>{CHAVE_PIX}</span>
              <button type="button" className="pix-copy" onClick={copiarPix}>
                <Icon name="copy" className="w-3 h-3" />
                {pixCopiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <ul className="pix-steps">
              <li><div className="pix-n">1</div>Copie a chave Pix acima</li>
              <li><div className="pix-n">2</div>Abra seu banco e faça a transferência</li>
              <li><div className="pix-n">3</div>Tire print do comprovante</li>
              <li><div className="pix-n">4</div>Envie pelo botão abaixo no WhatsApp</li>
            </ul>
          </div>

          <button className="btn primary flex items-center justify-center gap-2" onClick={abrirWhatsappPagamento}>
            <Icon name="whatsapp" className="w-4 h-4" />
            Enviar comprovante no WhatsApp
          </button>

          <div className="alert warn">
            <Icon name="info" className="w-5 h-5 flex-shrink-0" />
            <div className="alert-txt">
              Seu plano será ativado em até <strong>24h</strong> após a confirmação do pagamento pelo barbeiro.
            </div>
          </div>

          <div className="sec">OUTRAS FORMAS</div>
          <div className="card">
            <div className="flex items-center gap-3">
              <Icon name="store" className="w-5 h-5 text-zinc-500" />
              <div>
                <div className="text-[#d8d3c8] text-sm font-semibold">Cartão ou dinheiro</div>
                <div className="text-zinc-500 text-xs mt-0.5">Pagamento presencial na barbearia</div>
              </div>
            </div>
          </div>

          <button onClick={() => setModalCheckoutAberto(false)} className="btn ghost">Fazer depois</button>
        </div>
      </div>
    </div>
  );

  const historicoModal = modalHistoricoAberto && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-0">
      <div className="client-device rounded-t-[28px] sm:rounded-[28px] min-h-0 max-h-[92vh] overflow-y-auto">
        <div className="back-bar">
          <button className="back-btn" onClick={() => setModalHistoricoAberto(false)}>
            <Icon name="chevron" className="w-4 h-4 rotate-180" />
          </button>
          <span className="back-title">Historico</span>
        </div>

        <div className="scroll" style={{ paddingTop: 12 }}>
          <div className="sec">CORTES</div>
          <div className="space-y-2">
            {historicoCompleto.length > 0 ? historicoCompleto.map((corte) => {
              const dataCorte = parseDataSupabase(corte.created_at);
              return (
                <div key={corte.id} className="bg-[#1b1b1b] border border-[#333] rounded-[10px] p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{corte.tipo_corte}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {dataCorte.toLocaleDateString('pt-BR')} as {dataCorte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Feito</span>
                </div>
              );
            }) : (
              <div className="p-6 text-center border border-dashed border-[#333] rounded-[12px]">
                <p className="text-zinc-600 text-xs italic">Nenhum corte registrado.</p>
              </div>
            )}
          </div>

          <div className="sec">AGENDAMENTOS</div>
          <div className="space-y-2">
            {agendamentos.length > 0 ? agendamentos.map((agendamento, index) => {
              const dataAgendamento = agendamento.data_hora ? new Date(agendamento.data_hora) : null;
              return (
                <div key={agendamento.id || index} className="bg-[#1b1b1b] border border-[#333] rounded-[10px] p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{agendamento.servicos?.nome || 'Servico'}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {dataAgendamento
                        ? `${dataAgendamento.toLocaleDateString('pt-BR')} as ${dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Sem data'}
                      {agendamento.barbeiros?.nome ? ` - ${agendamento.barbeiros.nome}` : ''}
                    </p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#d5b451]">{agendamento.status}</span>
                </div>
              );
            }) : (
              <div className="p-6 text-center border border-dashed border-[#333] rounded-[12px]">
                <p className="text-zinc-600 text-xs italic">Nenhum agendamento registrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading || !dados) {
    return (
      <div className="min-h-screen bg-[#090909] flex items-center justify-center text-[#d5b451] font-bold uppercase tracking-widest text-xs">
        Carregando...
      </div>
    );
  }

  const abrirAgendamentoSemPlano = (servicoId = null) => {
    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento indisponível', 'No momento esta barbearia não está aceitando agendamento online para clientes sem plano ativo.');
      return;
    }
    setModoAgendamento('avulso');
    setServicoAgendamentoInicial(servicoId);
    setModalAgendamentoAberto(true);
  };

  const abrirAgendamentoAvulsoPendente = (servicoId = null) => {
    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento indisponível', 'No momento esta barbearia não está aceitando agendamento online.');
      return;
    }
    setModoAgendamento('avulso');
    setServicoAgendamentoInicial(servicoId);
    setModalAgendamentoAberto(true);
  };

  const abrirAgendamentoComPlano = () => {
    if (tipoCliente !== 'ativo') {
      exibirAlerta('Plano pendente', 'Seu plano precisa ser ativado para agendar usando os beneficios do plano.');
      return;
    }

    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento indisponivel', 'No momento esta barbearia nao esta aceitando agendamento online.');
      return;
    }

    setModoAgendamento('plano');
    setServicoAgendamentoInicial(null);
    setModalAgendamentoAberto(true);
  };

  const pedidoRecente = (() => {
    const pedidos = [
      ...historicoCompleto.map((corte) => ({
        tipo: 'feito',
        nome: corte.tipo_corte,
        data: corte.created_at,
        status: 'feito',
      })),
      ...agendamentos.map((agendamento) => ({
        tipo: 'agendamento',
        nome: agendamento.servicos?.nome || 'Servico',
        data: agendamento.data_hora || agendamento.created_at,
        status: agendamento.status || 'agendado',
      })),
    ];

    return pedidos.sort((a, b) => parseDataSupabase(b.data) - parseDataSupabase(a.data))[0] || null;
  })();

  const renderDashboardPorTipo = () => {
    if (tipoCliente === 'avulso') {
      return (
        <ClienteDashboardAvulso
          dados={dados}
          servicosAvulsos={servicosAvulsos}
          agendamentos={agendamentos}
          onAbrirPlanos={abrirPlanos}
          onAbrirAgendamentoSemPlano={abrirAgendamentoSemPlano}
        />
      );
    }

    return (
      <ClienteDashboardPlano
        dados={dados}
        statusPlano={tipoCliente}
        historicoMes={historicoMes}
        pedidoRecente={pedidoRecente}
        agendamentoAtivo={agendamentoAtivo}
        onAbrirAgendamentoPlano={abrirAgendamentoComPlano}
        onAbrirOutroServico={abrirAgendamentoAvulsoPendente}
      />
    );
  };

  return (
    <ClienteShell onMenu={() => setMenuAberto(true)} empresaNome={empresaNome}>
      {modalBase}
      {renderDashboardPorTipo()}
      {checkoutModal}
      {historicoModal}
      <style dangerouslySetInnerHTML={{ __html: '@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' }} />
    </ClienteShell>
  );
}
