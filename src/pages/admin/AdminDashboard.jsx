import { useState, useEffect, forwardRef } from 'react';
import ModalFiliais from '../components/ModalFiliais';
import ModalBarbeiros from '../components/ModalBarbeiros';
import ModalServicos from '../components/ModalServicos';
import ModalConfiguracoes from '../components/ModalConfiguracoes';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import ModalAlerta from "../components/ModalAlerta";
import ModalPlanos from "../components/ModalPlanos";
import DrawerAdmin from "./DrawerAdmin";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ptBR } from 'date-fns/locale';

// Botão customizado que disfarça o input para enganar o celular e não abrir o teclado
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

export default function AdminDashboard() {
  const [clientes, setClientes] = useState([]);
  const [cortesGerais, setCortesGerais] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planosInfo, setPlanosInfo] = useState({});
  
  const [abaAtiva, setAbaAtiva] = useState('todos'); 
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

  const navigate = useNavigate();
 

  const fecharModal = () => setModalConfig({ ...modalConfig, isOpen: false });
  const showConfirm = (title, message, acao) => setModalConfig({ isOpen: true, type: 'confirm', title, message, onConfirm: acao });
  const showAlert = (title, message) => setModalConfig({ isOpen: true, type: 'alert', title, message, onConfirm: null });

  const carregarDados = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    
    try {
      const { data: dadosPlanos, error: errPlanos } = await supabase
        .from('planos')
        .select('*');
      
      if (errPlanos) throw errPlanos;

      const mapaPlanos = {};
      dadosPlanos?.forEach(p => {
        mapaPlanos[p.slug] = { 
          nome: p.nome, 
          limite: p.limite, 
          preco: `R$ ${Number(p.preco).toFixed(2).replace('.', ',')}/mês` 
        };
      });
      setPlanosInfo(mapaPlanos);

      const { data: dadosClientes, error: errClientes } = await supabase
        .from('clientes')
        .select(`
          id, nome, whatsapp,
          assinaturas ( id, plano_escolhido, status, data_vencimento, created_at )
        `)
        .eq('eh_admin', false) 
        .order('nome');

      if (errClientes) throw errClientes;

      const { data: dadosCortes, error: errCortes } = await supabase
        .from('historico_cortes')
        .select(`
          id, created_at, tipo_corte, cliente_id,
          clientes ( nome, whatsapp )
        `)
        .order('created_at', { ascending: false });

      if (errCortes) throw errCortes;

      setClientes(dadosClientes || []);
      setCortesGerais(dadosCortes || []);

    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setRefreshing(false), 600);
      }
    }
  };

useEffect(() => { 
    let isMounted = true;

    // 1. A FUNÇÃO DO "SEGURANÇA DA PORTA"
    const checarAdminReal = async () => {
      // Pega a sessão atual direto do servidor do Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return navigate('/');

      // Vai no banco de dados e checa a verdade absoluta
      const { data } = await supabase
        .from('clientes')
        .select('eh_admin')
        .eq('id', user.id)
        .single();

      // Se o cara fraudou o LocalStorage, a gente corrige e chuta ele pra fora
      if (!data?.eh_admin) {
        localStorage.setItem('isAdmin', 'false');
        return navigate('/dashboard');
      }

      // Se for admin de verdade, CARREGA OS DADOS!
      if (isMounted) {
        carregarDados();
      }
    };

    // 2. EXECUTA A CHECAGEM IMEDIATAMENTE
    checarAdminReal(); 

    // 3. MANTÉM OS SEUS OLHEIROS (Tempo Real) FUNCIONANDO
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => carregarDados()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assinaturas' },
        () => carregarDados()
      )
      .subscribe();

    // 4. LIMPA TUDO SE SAIR DA TELA
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('clienteId');
    navigate('/');
  };

  const confirmarAtivacao = (assinaturaId, nomeCliente) => {
    showConfirm(
      'Ativar Assinatura', 
      `Confirmar recebimento e ativar o plano de ${nomeCliente} por 30 dias?`, 
      () => efetuarAtivacao(assinaturaId)
    );
  };

  const efetuarAtivacao = async (assinaturaId) => {
    fecharModal();
    try {
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      const { error } = await supabase
        .from('assinaturas')
        .update({ status: 'ativa', data_vencimento: dataVencimento.toISOString() })
        .eq('id', assinaturaId);

      if (error) throw error;
      carregarDados(); 
      showAlert('Sucesso', 'A assinatura foi ativada e o acesso do cliente está liberado.');
    } catch (error) {
      showAlert('Erro', 'Não foi possível ativar a assinatura: ' + error.message);
    }
  };

  const confirmarExclusaoAssinatura = (assinaturaId, nomeCliente) => {
    showConfirm(
      'Excluir Assinatura',
      `Tem certeza que deseja remover a assinatura de ${nomeCliente}? O cliente voltará para a tela de escolha de planos.`,
      () => efetuarExclusaoAssinatura(assinaturaId)
    );
  };

  const efetuarExclusaoAssinatura = async (assinaturaId) => {
    fecharModal();
    try {
      const { error } = await supabase
        .from('assinaturas')
        .delete()
        .eq('id', assinaturaId);

      if (error) throw error;
      carregarDados();
      showAlert('Removida', 'A assinatura foi excluída com sucesso.');
    } catch (error) {
      showAlert('Erro', 'Não foi possível excluir a assinatura.');
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

  const clientesProcessados = clientes.map(cliente => {
    const todasAssinaturas = cliente.assinaturas || [];
    const assinatura = todasAssinaturas.find(a => a.status === 'ativa') || 
                       todasAssinaturas.find(a => a.status === 'pendente') || 
                       [...todasAssinaturas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || 
                       null;

    const planoDetalhe = assinatura ? planosInfo[assinatura.plano_escolhido] : null;

    const cortesNoMes = cortesGerais.filter(corte => {
      const ehDesteCliente = corte.cliente_id === cliente.id; 
      const dataCorte = new Date(corte.created_at);
      const ehNesteMes = dataCorte.getMonth() === mesAtual && dataCorte.getFullYear() === anoAtual;
      return ehDesteCliente && ehNesteMes;
    }).length;

    return { ...cliente, assinatura, planoDetalhe, cortesNoMes };
  });

  const aguardandoAtivacao = [];
  clientes.forEach(cliente => {
    const pendentes = (cliente.assinaturas || []).filter(a => a.status === 'pendente');
    pendentes.forEach(assinaturaPendente => {
      aguardandoAtivacao.push({
        ...cliente,
        assinatura: assinaturaPendente
      });
    });
  });

  // LÓGICA DE CÁLCULO DE RENDA
  const calcularRenda = () => {
    let faturamentoMensal = 0;
    let previsaoProximoMes = 0;
    
    clientesProcessados.forEach(cliente => {
      if (cliente.assinatura?.status === 'ativa' && cliente.planoDetalhe) {
        const valor = parseFloat(cliente.planoDetalhe.preco.replace('R$ ', '').replace('.', '').replace(',', '.'));
        faturamentoMensal += valor;
        previsaoProximoMes += valor;
      }
    });

    return { faturamentoMensal, previsaoProximoMes };
  };

  const { faturamentoMensal, previsaoProximoMes } = calcularRenda();
  
let listaClientesFiltrada = clientesProcessados.filter(c => {
    // Converte para string e garante que não vai quebrar se for null
    const nomeSeguro = c.nome ? String(c.nome).toLowerCase() : '';
    const whatsappSeguro = c.whatsapp ? String(c.whatsapp) : '';
    const buscaSegura = busca ? String(busca).toLowerCase() : '';
    
    return nomeSeguro.includes(buscaSegura) || whatsappSeguro.includes(buscaSegura);
  });

  if (abaAtiva === 'ativos') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => c.assinatura?.status === 'ativa');
  } else if (abaAtiva === 'inativos') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => !c.assinatura || c.assinatura?.status !== 'ativa');
  } else if (abaAtiva === 'pendentes') {
    listaClientesFiltrada = listaClientesFiltrada.filter(c => c.assinatura?.status === 'pendente');
  }

  const listaCortesFiltrada = cortesGerais.filter(corte => {
    if (!dataFiltro) return true; 
    const d = new Date(corte.created_at);
    return d.getDate() === dataFiltro.getDate() && 
           d.getMonth() === dataFiltro.getMonth() && 
           d.getFullYear() === dataFiltro.getFullYear();
  });

const getIniciais = (nome) => {
    if (!nome) return '??';
    // Garante que é string antes de tentar usar o .split()
    const partes = String(nome).split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return partes[0].substring(0, 2).toUpperCase();
  };

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-[#CEAA6B]">Carregando painel...</div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans pb-20">
      
      <DrawerAdmin 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        onLogout={handleLogout}
        dadosFinanceiros={{ 
          faturamentoMensal, 
          previsaoProximoMes, 
          totalAtivos: clientesProcessados.filter(c => c.assinatura?.status === 'ativa').length 
        }}
<<<<<<< HEAD
        onOpenPlanos={() => setModalPlanosAberto(true)}
=======
>>>>>>> 4c36692a0a1ea82a40481eea5fa9c621959b9324
        onOpenFiliais={() => setModalFiliaisAberto(true)}
        onOpenBarbeiros={() => setModalBarbeirosAberto(true)}
        onOpenServicos={() => setModalServicosAberto(true)}
        onOpenConfiguracoes={() => setModalConfiguracoesAberto(true)}
      />
      <ModalPlanos 
        isOpen={modalPlanosAberto} 
        onClose={() => setModalPlanosAberto(false)} 
        onRefresh={carregarDados}
      />
      <ModalFiliais
        isOpen={modalFiliaisAberto}
        onClose={() => setModalFiliaisAberto(false)}
      />
      <ModalBarbeiros
        isOpen={modalBarbeirosAberto}
        onClose={() => setModalBarbeirosAberto(false)}
      />
      <ModalServicos
        isOpen={modalServicosAberto}
        onClose={() => setModalServicosAberto(false)}
        onRefresh={carregarDados}
      />
      <ModalConfiguracoes
        isOpen={modalConfiguracoesAberto}
        onClose={() => setModalConfiguracoesAberto(false)}
      />

      <ModalAlerta 
        isOpen={modalConfig.isOpen} 
        onClose={fecharModal} 
        onConfirm={modalConfig.onConfirm} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        type={modalConfig.type} 
      />

      <header className="flex justify-between items-center mb-8 mt-4">
        <h1 className="text-[#CEAA6B] font-black text-xl tracking-widest uppercase">Painel ADMIN</h1>
        <div className="flex gap-3">
          <button 
            onClick={() => carregarDados(true)} 
            disabled={refreshing}
            className="w-10 h-10 rounded-full border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-[#CEAA6B] transition-colors active:scale-95 disabled:opacity-50"
          >
            <svg 
              className={`${refreshing ? 'animate-spin text-[#CEAA6B]' : ''}`}
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            </svg>
          </button>
          
          <button onClick={() => setDrawerOpen(true)} className="w-10 h-10 rounded-full border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors active:scale-95">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>
      </header>

      {abaAtiva !== 'historico' && aguardandoAtivacao.length > 0 && (
        <section className="mb-8">
          <button 
            onClick={() => setMostrarAguardando(!mostrarAguardando)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4 outline-none active:scale-[0.98] transition-transform"
          >
            <span>Aguardando Ativação ({aguardandoAtivacao.length})</span>
            <svg 
              className={`transition-transform duration-300 ${mostrarAguardando ? 'rotate-180' : ''}`} 
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          {mostrarAguardando && (
            <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
              {aguardandoAtivacao.map((item, index) => (
                <div key={`${item.id}-${index}`} className="bg-[#121212] border border-[#27272a] rounded-[20px] p-5 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{item.nome}</h3>
                    <p className="text-[#CEAA6B] text-[10px] font-bold uppercase mt-1">
                      {planosInfo[item.assinatura.plano_escolhido]?.nome || 'Plano Antigo'} • Solicitado às {formatarHora(item.assinatura.created_at)}
                    </p>
                    <p className="text-zinc-500 text-[10px] mt-1">WhatsApp: {item.whatsapp}</p>
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

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
        <button onClick={() => setAbaAtiva('todos')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'todos' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Todos ({clientesProcessados.length})
        </button>
        <button onClick={() => setAbaAtiva('ativos')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'ativos' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Ativos ({clientesProcessados.filter(c => c.assinatura?.status === 'ativa').length})
        </button>
        <button onClick={() => setAbaAtiva('pendentes')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'pendentes' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Pendentes ({clientesProcessados.filter(c => c.assinatura?.status === 'pendente').length})
        </button>
        <button onClick={() => setAbaAtiva('inativos')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'inativos' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Inativos ({clientesProcessados.filter(c => !c.assinatura || c.assinatura?.status !== 'ativa').length})
        </button>
        <button onClick={() => setAbaAtiva('historico')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'historico' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Histórico de Cortes
        </button>
      </div>

      {abaAtiva !== 'historico' ? (
        <>
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
              const statusAtivo = cliente.assinatura?.status === 'ativa';
              const statusPendente = cliente.assinatura?.status === 'pendente';
              
              return (
                <div key={cliente.id} className="bg-[#121212] border border-[#27272a] rounded-[24px] p-5">
                  <div className="flex items-center gap-4 border-b border-[#27272a] pb-4 mb-4">
                    <div className="w-12 h-12 rounded-full border border-[#27272a] bg-[#09090b] flex items-center justify-center text-zinc-500 font-bold text-sm shrink-0">
                      {getIniciais(cliente.nome)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg leading-none">{cliente.nome}</h3>
                        <div className="flex gap-2">
                          {cliente.assinatura && (
                            <button 
                              onClick={() => confirmarExclusaoAssinatura(cliente.assinatura.id, cliente.nome)}
                              className="p-1.5 text-zinc-600 hover:text-red-500 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          )}
                          {statusAtivo ? (
                            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Ativo</span>
                          ) : statusPendente ? (
                            <span className="bg-[#CEAA6B]/10 text-[#CEAA6B] text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Pendente</span>
                          ) : (
                            <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Inativo</span>
                          )}
                        </div>
                      </div>
                      <p className="text-zinc-500 text-xs mt-1.5">
                        {cliente.planoDetalhe ? `${cliente.planoDetalhe.limite} Cortes/mês • ${cliente.planoDetalhe.preco}` : 'Nenhum plano escolhido'}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span className="font-medium">{cliente.cortesNoMes} de {cliente.planoDetalhe?.limite || 0} cortes no mês</span>
                    </div>
                    <span className="text-zinc-500 font-medium">
                      {statusPendente ? 'Aguardando Ativação' : `Vence ${formatarData(cliente.assinatura?.data_vencimento)}`}
                    </span>
                  </div>
                </div>
              );
            })}
            {listaClientesFiltrada.length === 0 && <p className="text-center text-zinc-600 text-sm py-10">Nenhum cliente encontrado.</p>}
          </div>
        </>

      ) : (

        <div className="animate-[fadeIn_0.2s_ease-out]">
          
          <div className="flex justify-between items-center mb-6 bg-[#121212] p-4 rounded-2xl border border-[#27272a]">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Filtrar por data</p>
              <h2 className="text-[#CEAA6B] font-bold text-lg">
                {dataFiltro && dataFiltro.toDateString() === new Date().toDateString() ? 'Cortes de Hoje' : formatarData(dataFiltro)}
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

          <div className="space-y-3">
            {listaCortesFiltrada.length > 0 ? (
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
                        <h4 className="font-bold text-sm text-white">{nomeCli}</h4>
                        <p className="text-[10px] text-[#CEAA6B] font-medium uppercase tracking-wider">{corte.tipo_corte}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-zinc-400">{horaCorte}</p>
                      <p className="text-[10px] text-zinc-600">Registrado</p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="bg-[#121212] border border-[#27272a] border-dashed rounded-[20px] p-10 flex flex-col items-center justify-center text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600 mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <p className="text-zinc-500 text-sm font-medium">Nenhum corte registrado<br/>neste dia.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
