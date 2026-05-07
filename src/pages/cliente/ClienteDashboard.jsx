import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import ModalAlerta from "../components/ModalAlerta";
import { useAuth } from '../../contexts/AuthContext';
import DrawerClientes from './DrawerClientes'; 

// Garante que o usuário não deslogue ao recarregar a página
const getClienteId = () => {
  const id = localStorage.getItem('clienteId') || sessionStorage.getItem('clienteId');
  if (id) {
    localStorage.setItem('clienteId', id);
    sessionStorage.setItem('clienteId', id);
  }
  return id;
};

// Limpa a sujeira do Supabase (microsegundos) para o iOS/celulares não travarem
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

  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [pixCopiado, setPixCopiado] = useState(false);

  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const LIMITE_ALTERACOES = 2;

  const CHAVE_PIX = "81988468182"; 
  const WHATSAPP_JOAO = "5581988468182"; 

  const [configModalAlerta, setConfigModalAlerta] = useState({ 
    isOpen: false, type: 'alert', title: '', message: '', onConfirm: null 
  });

  const [planosDb, setPlanosDb] = useState([]);
  const [mapaPlanos, setMapaPlanos] = useState({});

 useEffect(() => {
    if (authLoading) return; 

    const clienteId = getClienteId();
    if (!clienteId) {
      navigate('/');
    } else {
      carregarDados(clienteId);
    }
  }, [navigate, authLoading]); 

  useEffect(() => {
    const verificarCancelamento = () => {
      if (historicoMes.length > 0) {
        const ultimoCorte = historicoMes[0];
        const dataUltimoCorte = parseDataSupabase(ultimoCorte.created_at).getTime();
        const agora = new Date().getTime();
        
        const diferencaMinutos = (agora - dataUltimoCorte) / 60000;
        
        if (diferencaMinutos >= 0 && diferencaMinutos <= 15) {
          setCorteCancelavel(ultimoCorte);
        } else {
          setCorteCancelavel(null);
        }
      } else {
        setCorteCancelavel(null);
      }
    };

    verificarCancelamento();
    const interval = setInterval(verificarCancelamento, 5000);
    return () => clearInterval(interval);
  }, [historicoMes]);

  async function carregarDados(id) {
    try {
      const { data: dadosPlanos, error: errPlanos } = await supabase
        .from('planos')
        .select('*');
      
      if (errPlanos) throw errPlanos;

      const mapa = {};
      dadosPlanos.forEach(p => { mapa[p.slug] = p; });
      setPlanosDb(dadosPlanos);
      setMapaPlanos(mapa);

      const { data: cli, error: erroSupabase } = await supabase
        .from('clientes')
        .select(`
          nome, whatsapp, alteracoes_nome,
          assinaturas(status, data_vencimento, plano_escolhido, proximo_plano, upgrade_pendente),
          historico_cortes(id, created_at, tipo_corte)
        `)
        .eq('id', id).single();

      if (erroSupabase) throw erroSupabase;
      const ass = cli.assinaturas?.[0];
      if (!ass?.plano_escolhido) return navigate('/planos');

      const hoje = new Date();
      const cortesDoMes = cli.historico_cortes?.filter(corte => {
        const d = parseDataSupabase(corte.created_at);
        return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
      }) || [];
      
      cortesDoMes.sort((a, b) => parseDataSupabase(b.created_at) - parseDataSupabase(a.created_at));
      setHistoricoMes(cortesDoMes);

      const planoInfo = mapa[ass.plano_escolhido];
      const limitePlano = planoInfo?.limite || 4;

      setDados({
        nome: cli.nome, 
        whatsapp: cli.whatsapp, 
        iniciais: cli.nome.substring(0, 2).toUpperCase(),
        alteracoesNome: cli.alteracoes_nome || 0,
        status: ass.status || 'pendente', 
        limiteTotal: limitePlano,
        cortesRestantes: Math.max(0, limitePlano - cortesDoMes.length),
        vencimentoFormatado: ass.data_vencimento ? new Date(ass.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--',
        planoId: ass.plano_escolhido, 
        planoNome: planoInfo?.nome || 'Plano',
        precoPlano: planoInfo?.preco || 0,
        proximoPlano: ass.proximo_plano,
        upgradePendente: ass.upgrade_pendente
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const copiarPix = () => {
    navigator.clipboard.writeText(CHAVE_PIX);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 3000);
  };

  const fecharModalAlerta = () => setConfigModalAlerta({ ...configModalAlerta, isOpen: false });
  const exibirAlerta = (title, message) => setConfigModalAlerta({ isOpen: true, type: 'alert', title, message, onConfirm: null });
  const exibirConfirmacao = (title, message, acao) => setConfigModalAlerta({ isOpen: true, type: 'confirm', title, message, onConfirm: acao });

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
      exibirConfirmacao(
        'Agendar Mudança',
        `Você já possui o plano ${dados.planoNome} ativo. A mudança para ${mapaPlanos[novoPlanoId].nome} será agendada para seu próximo vencimento (${dados.vencimentoFormatado}).`,
        () => efetuarAgendamentoDowngrade(novoPlanoId)
      );
    } else {
      const diferenca = valorNovo - valorAtual;
      exibirConfirmacao(
        'Fazer Upgrade',
        `Deseja mudar para ${mapaPlanos[novoPlanoId].nome}? Pague apenas a diferença de R$ ${diferenca},00 para liberar hoje mesmo.`,
        () => prepararUpgrade(novoPlanoId, diferenca)
      );
    }
  };

  const cancelarAgendamento = () => {
    exibirConfirmacao(
      'Cancelar Agendamento',
      `Deseja cancelar a mudança agendada e manter seu plano atual (${dados.planoNome})?`,
      efetuarCancelamentoAgendamento
    );
  };

  const efetuarCancelamentoAgendamento = async () => {
    fecharModalAlerta();
    const { error } = await supabase.from('assinaturas').update({ proximo_plano: null }).eq('cliente_id', getClienteId());
    if (!error) carregarDados(getClienteId());
  };

  const efetuarMudancaPlanoDireta = async (novoPlano) => {
    const { error } = await supabase.from('assinaturas').update({ plano_escolhido: novoPlano }).eq('cliente_id', getClienteId());
    if (!error) carregarDados(getClienteId());
  };

  const efetuarAgendamentoDowngrade = async (proximo) => {
    fecharModalAlerta();
    const { error } = await supabase.from('assinaturas').update({ proximo_plano: proximo }).eq('cliente_id', getClienteId());
    if (!error) carregarDados(getClienteId());
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
      mensagem += `Estou solicitando o Upgrade para o plano *${mapaPlanos[dados.planoUpgradeId].nome}*! 🚀\n`;
      mensagem += `Pagamento via: *${metodoPagamento.toUpperCase()}*`;
      await supabase.from('assinaturas').update({ upgrade_pendente: dados.planoUpgradeId }).eq('cliente_id', getClienteId());
    } else {
      mensagem += `Estou solicitando a ativação do *Plano ${dados.planoNome}*.\n`;
      mensagem += `Pagamento via: *${metodoPagamento.toUpperCase()}*`;
    }
    
    window.open(`https://wa.me/${WHATSAPP_JOAO}?text=${encodeURIComponent(mensagem)}`, '_blank');
    setModalCheckoutAberto(false);
    if (isUpgrade) carregarDados(getClienteId());
  };

  const salvarNovoNome = async () => {
    if (!novoNome.trim() || novoNome === dados.nome) return setEditandoNome(false);
    try {
      await supabase.from('clientes').update({ nome: novoNome, alteracoes_nome: dados.alteracoesNome + 1 }).eq('id', getClienteId());
      carregarDados(getClienteId());
      setEditandoNome(false);
    } catch (e) { console.error(e); }
  };

  const handleConfirmarCorte = () => {
    if (dados.status !== 'ativa') return exibirAlerta('Acesso Restrito', 'Sua assinatura precisa estar ATIVA.');
    if (dados.cortesRestantes <= 0) return exibirAlerta('Limite Atingido', 'Cortes esgotados este mês.');

    if (historicoMes.length > 0) {
      const dataUltimoCorte = parseDataSupabase(historicoMes[0].created_at).toLocaleDateString('pt-BR');
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      if (dataUltimoCorte === dataHoje) return exibirAlerta('Atenção', 'Você já registrou um corte hoje! Retorne amanhã.');
    }

    exibirConfirmacao('Confirmar Serviço', `Deseja registrar "${dados.planoNome}" agora? \n\n(Você poderá cancelar este registro em até 15 minutos se necessário).`, efetuarCorteNoBanco);
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
    exibirConfirmacao('Cancelar Corte', 'Tem certeza que deseja cancelar? O limite de corte será devolvido à sua conta.', efetuarCancelamentoCorte);
  };

  const efetuarCancelamentoCorte = async () => {
    if (salvandoCorte) return;
    setSalvandoCorte(true);
    fecharModalAlerta();
    try {
      const { error } = await supabase.from('historico_cortes').delete().eq('id', corteCancelavel.id);
      if (!error) {
        await carregarDados(getClienteId());
        exibirAlerta('Cancelado', 'Seu corte foi cancelado e o limite retornado à sua conta.');
      } else {
        exibirAlerta('Erro', 'Não foi possível cancelar. O prazo de 15 minutos pode ter expirado.');
      }
    } catch (e) { console.error(e); } finally { setSalvandoCorte(false); }
  };

  const fecharMenu = () => {
    setMenuAberto(false);
    setEditandoNome(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut(); 
    localStorage.clear(); 
    sessionStorage.clear(); 
    navigate('/'); 
  };

  if (loading || !dados) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-[#CEAA6B] font-bold uppercase tracking-widest text-xs">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-5 font-sans flex flex-col relative overflow-hidden">
      <ModalAlerta isOpen={configModalAlerta.isOpen} onClose={fecharModalAlerta} onConfirm={configModalAlerta.onConfirm} title={configModalAlerta.title} message={configModalAlerta.message} type={configModalAlerta.type} />

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

      {/* DRAWER */}
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
      />

      {/* STATUS BANNER */}
      {(dados.status !== 'ativa' || dados.upgradePendente) && (
        <div className="p-5 rounded-2xl border mb-5 bg-[#1a120b] border-orange-500/20">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Atenção</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></div>
            <span className="text-[13px] font-black uppercase tracking-wide text-orange-500">
              {dados.upgradePendente ? 'Upgrade em Análise' : 'Aguardando Ativação'}
            </span>
          </div>
          <p className="text-zinc-400 text-[12px] leading-relaxed">
            {dados.upgradePendente ? `Aguardando aprovação do upgrade para ${mapaPlanos[dados.upgradePendente]?.nome}.` : 'Efetue o pagamento para liberar seu acesso.'}
          </p>
        </div>
      )}

      {/* INFO CARDS */}
      <div className="bg-[#121212] border border-[#27272a] rounded-[20px] p-4 flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full border border-[#CEAA6B]/30 flex items-center justify-center text-[#CEAA6B] font-medium text-lg">{dados.iniciais}</div>
        <div>
          <h2 className="font-bold text-base text-white">{dados.nome}</h2>
          <div className="inline-block mt-1 border border-[#CEAA6B]/30 rounded-md px-2 py-1"><p className="text-[#CEAA6B] text-[10px] font-medium uppercase">Plano {dados.planoNome}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#121212] border border-[#27272a] p-4 rounded-[20px] flex flex-col items-center">
          <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mb-3">Cortes Restantes</p>
          <div className="flex flex-wrap justify-center gap-1.5 mb-2">
            {[...Array(dados.limiteTotal)].map((_, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-[3px] ${i < dados.cortesRestantes ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}></div>
            ))}
          </div>
          <p className="text-2xl font-bold text-[#CEAA6B]">{dados.cortesRestantes} <span className="text-zinc-500 text-[10px] font-normal">de {dados.limiteTotal}</span></p>
        </div>
        <div className="bg-[#121212] border border-[#27272a] p-4 rounded-[20px] flex flex-col items-center justify-center">
          <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mb-2">Vencimento</p>
          <p className="text-[26px] font-bold text-white">{dados.vencimentoFormatado}</p>
        </div>
      </div>

      {/* ÁREA DE HISTÓRICO ATUALIZADA (COM SCROLL E HORÁRIO) */}
      <div className="mb-6 flex-grow flex flex-col min-h-0">
        <div className="flex justify-between items-end mb-3 pl-1">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Histórico do mês</p>
          {historicoMes.length > 0 && (
            <p className="text-[#CEAA6B] text-[9px] font-bold uppercase tracking-widest bg-[#CEAA6B]/10 px-2 py-0.5 rounded">
              {historicoMes.length} {historicoMes.length === 1 ? 'corte' : 'cortes'}
            </p>
          )}
        </div>
        
        {/* Container que permite o deslize (scroll) com altura máxima definida */}
        <div className="space-y-2 overflow-y-auto pr-1 pb-1 max-h-[220px] flex-1">
          {historicoMes.length > 0 ? historicoMes.map((c, i) => {
            const dataCorte = parseDataSupabase(c.created_at);
            const dataFormatada = dataCorte.toLocaleDateString('pt-BR');
            const horaFormatada = dataCorte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-[#121212] border border-[#27272a]">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#1a120b] border border-[#CEAA6B]/20 flex items-center justify-center text-[#CEAA6B]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{c.tipo_corte}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                      <span className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        {dataFormatada}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        {horaFormatada}
                      </span>
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
              <p className="text-zinc-600 text-xs italic">Nenhum serviço registrado neste mês.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {dados.status === 'ativa' ? (
          corteCancelavel ? (
            <button disabled={salvandoCorte} onClick={handleCancelarCorte} className="w-full bg-red-500/10 text-red-500 border border-red-500/50 font-bold py-4 rounded-2xl transition-all">
              {salvandoCorte ? 'Cancelando...' : 'Cancelar Corte (Até 15 min)'}
            </button>
          ) : (
            <button disabled={dados.cortesRestantes === 0 || salvandoCorte} onClick={handleConfirmarCorte} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl transition-all">
              {salvandoCorte ? 'Registrando...' : dados.cortesRestantes > 0 ? 'Confirmar Serviço' : 'Limites Esgotados'}
            </button>
          )
        ) : (
          <button onClick={() => { setDados(prev => ({ ...prev, valorUpgrade: null })); setModalCheckoutAberto(true); }} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl">
            Pagar e Ativar Plano
          </button>
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
                  • R$ {dados.valorUpgrade || dados.precoPlano},00
                </p>
              </div>
              <button onClick={() => setModalCheckoutAberto(false)} className="w-8 h-8 flex items-center justify-center bg-[#27272a] text-zinc-400 rounded-full">X</button>
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
      <style dangerouslySetInnerHTML={{ __html: `@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}} />
    </div>
  );
}