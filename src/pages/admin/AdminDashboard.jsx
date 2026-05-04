import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import ModalAlerta from "../components/ModalAlerta";

export default function AdminDashboard() {
  const [clientes, setClientes] = useState([]);
  const [cortesGerais, setCortesGerais] = useState([]); // NOVO: Armazena todos os cortes da barbearia
  const [loading, setLoading] = useState(true);
  
  // Abas e Filtros
  const [abaAtiva, setAbaAtiva] = useState('todos'); // 'todos', 'ativos', 'inativos', 'historico'
  const [busca, setBusca] = useState('');
  
  // NOVO: Controle de Data para o Histórico (padrão: hoje)
  const hojeFormatoInput = new Date().toISOString().split('T')[0];
  const [dataFiltro, setDataFiltro] = useState(hojeFormatoInput);

  // Estados do Modal
  const [modalConfig, setModalConfig] = useState({ 
    isOpen: false, type: 'alert', title: '', message: '', onConfirm: null 
  });

  const navigate = useNavigate();

  const planosInfo = {
    cabelo: { nome: 'Só Cabelo', limite: 4, preco: 'R$ 70/mês' },
    barba: { nome: 'Só Barba', limite: 4, preco: 'R$ 50/mês' },
    completo: { nome: 'Cabelo & Barba', limite: 4, preco: 'R$ 110/mês' }
  };

  const fecharModal = () => setModalConfig({ ...modalConfig, isOpen: false });
  const showConfirm = (title, message, acao) => setModalConfig({ isOpen: true, type: 'confirm', title, message, onConfirm: acao });
  const showAlert = (title, message) => setModalConfig({ isOpen: true, type: 'alert', title, message, onConfirm: null });

  const carregarDados = async () => {
    try {
      // 1. Busca os clientes
      const { data: dadosClientes, error: errClientes } = await supabase
        .from('clientes')
        .select(`
          id, nome, whatsapp,
          assinaturas ( id, plano_escolhido, status, data_vencimento )
        `)
        .eq('eh_admin', false) 
        .order('nome');

      if (errClientes) throw errClientes;

      // 2. NOVO: Busca TODOS os cortes de todos os clientes (com os nomes anexados)
      const { data: dadosCortes, error: errCortes } = await supabase
        .from('historico_cortes')
        .select(`
          id, created_at, tipo_corte,
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
    }
  };

  useEffect(() => { carregarDados(); }, []);

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

  // ==========================================
  // PROCESSAMENTO DE DADOS E FILTROS
  // ==========================================

  // Processa Clientes (para as abas Todos, Ativos, Inativos)
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  const clientesProcessados = clientes.map(cliente => {
    const assinatura = cliente.assinaturas?.[0] || null;
    const planoDetalhe = assinatura ? planosInfo[assinatura.plano_escolhido] : null;

    // Calcula os cortes no mês cruzando com os cortes gerais
    const cortesNoMes = cortesGerais.filter(corte => {
      // Verifica se o cliente tem cortes e se o objeto clientes existe (mesmo null-safe)
      if (!corte.clientes) return false;
      
      const ehDesteCliente = corte.clientes.nome === cliente.nome; // Maneira simples de cruzar já que o Supabase retorna aninhado
      const dataCorte = new Date(corte.created_at);
      const ehNesteMes = dataCorte.getMonth() === mesAtual && dataCorte.getFullYear() === anoAtual;
      
      return ehDesteCliente && ehNesteMes;
    }).length;

    return { ...cliente, assinatura, planoDetalhe, cortesNoMes };
  });

  const aguardandoAtivacao = clientesProcessados.filter(c => c.assinatura?.status === 'pendente');
  
  let listaClientesFiltrada = clientesProcessados.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) || c.whatsapp.includes(busca)
  );

  if (abaAtiva === 'ativos') listaClientesFiltrada = listaClientesFiltrada.filter(c => c.assinatura?.status === 'ativa');
  else if (abaAtiva === 'inativos') listaClientesFiltrada = listaClientesFiltrada.filter(c => !c.assinatura || c.assinatura?.status !== 'ativa');

  // Processa Cortes (para a aba Histórico)
  const listaCortesFiltrada = cortesGerais.filter(corte => {
    // Filtra pelo dia exato escolhido no input date
    const dataDoCorte = corte.created_at.split('T')[0];
    return dataDoCorte === dataFiltro;
  });

  // Funções de formatação
  const formatarData = (dataStr) => {
    if (!dataStr) return '--/--';
    return new Date(dataStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getIniciais = (nome) => {
    if (!nome) return '??';
    const partes = nome.split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return partes[0].substring(0, 2).toUpperCase();
  };

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-[#CEAA6B]">Carregando painel...</div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans pb-20">
      
      <ModalAlerta 
        isOpen={modalConfig.isOpen} 
        onClose={fecharModal} 
        onConfirm={modalConfig.onConfirm} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        type={modalConfig.type} 
      />

      <header className="flex justify-between items-center mb-8 mt-4">
        <h1 className="text-[#CEAA6B] font-black text-xl tracking-widest uppercase">Painel do João</h1>
        <button onClick={handleLogout} className="w-10 h-10 rounded-full border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        </button>
      </header>

      {/* Só mostra 'Aguardando Ativação' se NÃO estiver na aba de histórico */}
      {abaAtiva !== 'historico' && aguardandoAtivacao.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            Aguardando Ativação ({aguardandoAtivacao.length})
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </h2>
          
          <div className="space-y-3">
            {aguardandoAtivacao.map(cliente => (
              <div key={cliente.id} className="bg-[#121212] border border-[#27272a] rounded-[20px] p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg leading-tight">{cliente.nome}</h3>
                  <p className="text-[#CEAA6B] text-xs font-medium mt-1">WhatsApp: {cliente.whatsapp}</p>
                </div>
                <button 
                  onClick={() => confirmarAtivacao(cliente.assinatura.id, cliente.nome)}
                  className="bg-[#CEAA6B] text-black font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl active:scale-95 transition-transform"
                >
                  Ativar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ABAS DE NAVEGAÇÃO ATUALIZADAS COM "HISTÓRICO" */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-2">
        <button onClick={() => setAbaAtiva('todos')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'todos' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Todos ({clientesProcessados.length})
        </button>
        <button onClick={() => setAbaAtiva('ativos')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'ativos' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Ativos ({clientesProcessados.filter(c => c.assinatura?.status === 'ativa').length})
        </button>
        <button onClick={() => setAbaAtiva('inativos')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'inativos' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Inativos ({clientesProcessados.filter(c => !c.assinatura || c.assinatura?.status !== 'ativa').length})
        </button>
        {/* NOVA ABA: HISTÓRICO */}
        <button onClick={() => setAbaAtiva('historico')} className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${abaAtiva === 'historico' ? 'bg-[#CEAA6B] text-black' : 'bg-[#121212] text-zinc-500 border border-[#27272a]'}`}>
          Histórico de Cortes
        </button>
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL: TELA DE CLIENTES OU TELA DE HISTÓRICO */}
      {abaAtiva !== 'historico' ? (
        
        // --- TELA DE CLIENTES (Tudo que já existia) ---
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
              return (
                <div key={cliente.id} className="bg-[#121212] border border-[#27272a] rounded-[24px] p-5">
                  <div className="flex items-center gap-4 border-b border-[#27272a] pb-4 mb-4">
                    <div className="w-12 h-12 rounded-full border border-[#27272a] bg-[#09090b] flex items-center justify-center text-zinc-500 font-bold text-sm shrink-0">
                      {getIniciais(cliente.nome)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg leading-none">{cliente.nome}</h3>
                        {statusAtivo ? (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Ativo</span>
                        ) : (
                          <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Inativo</span>
                        )}
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
                    <span className="text-zinc-500 font-medium">Vence {formatarData(cliente.assinatura?.data_vencimento)}</span>
                  </div>
                </div>
              );
            })}
            {listaClientesFiltrada.length === 0 && <p className="text-center text-zinc-600 text-sm py-10">Nenhum cliente encontrado.</p>}
          </div>
        </>

      ) : (

        // --- NOVA TELA DE HISTÓRICO DE CORTES ---
        <div className="animate-[fadeIn_0.2s_ease-out]">
          
          {/* O SEGREDO DO CALENDÁRIO ESTÁ AQUI */}
          <div className="flex justify-between items-center mb-6 bg-[#121212] p-4 rounded-2xl border border-[#27272a]">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Filtrar por data</p>
              <h2 className="text-[#CEAA6B] font-bold text-lg">
                {dataFiltro === hojeFormatoInput ? 'Cortes de Hoje' : formatarData(dataFiltro)}
              </h2>
            </div>
            
            {/* O Input de Data Camuflado no Ícone */}
            <div className="relative w-12 h-12 flex items-center justify-center bg-[#09090b] border border-[#27272a] rounded-xl hover:border-[#CEAA6B]/50 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CEAA6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              {/* O input nativo ocupa todo o espaço do botão, mas é invisível. Quando tocado, abre a roleta do celular! */}
              <input 
                type="date" 
                value={dataFiltro}
                onChange={(e) => setDataFiltro(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-3">
            {listaCortesFiltrada.length > 0 ? (
              listaCortesFiltrada.map(corte => {
                const horaCorte = new Date(corte.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
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