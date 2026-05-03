import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function AdminDashboard() {
  const [pendentes, setPendentes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [historicoGlobal, setHistoricoGlobal] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [isExpandido, setIsExpandido] = useState(true);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    buscarDadosAdmin();
  }, []);

  async function buscarDadosAdmin() {
    try {
      // 1. Busca pendentes
      const { data: listPendentes } = await supabase
        .from('clientes')
        .select('*, assinaturas!inner(status)')
        .eq('assinaturas.status', 'pendente');

      // 2. Busca todos os clientes com seus históricos reais
      const { data: listTodos } = await supabase
        .from('clientes')
        .select(`
          *, 
          assinaturas(status, data_vencimento), 
          historico_cortes(id, created_at, tipo_corte)
        `);

      setPendentes(listPendentes || []);
      setClientes(listTodos || []);

      // 3. Monta o histórico global (para a aba de Histórico)
      let historicoMontado = [];
      if (listTodos) {
        listTodos.forEach(c => {
          if (c.historico_cortes) {
            c.historico_cortes.forEach(corte => {
              historicoMontado.push({
                ...corte,
                nome_cliente: c.nome
              });
            });
          }
        });
        // Ordena do mais recente pro mais antigo
        historicoMontado.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setHistoricoGlobal(historicoMontado);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Função para saber quantos cortes o cara fez ESTE MÊS
  const getCortesDoMes = (historicoArray) => {
    if (!historicoArray) return 0;
    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    return historicoArray.filter(corte => {
      const dataCorte = new Date(corte.created_at);
      return dataCorte.getMonth() === mesAtual && dataCorte.getFullYear() === anoAtual;
    }).length;
  };

  // Lógica de filtragem dos cards
  const clientesFiltrados = clientes.filter(c => {
    const status = c.assinaturas?.[0]?.status || 'inativa';
    const atendeBusca = c.nome.toLowerCase().includes(busca.toLowerCase()) || c.whatsapp.includes(busca);
    
    if (!atendeBusca) return false;

    if (filtroAtivo === 'Ativos') return status === 'ativa';
    if (filtroAtivo === 'Inativos') return status !== 'ativa';
    return true; // 'Todos'
  });

  const qtdAtivos = clientes.filter(c => c.assinaturas?.[0]?.status === 'ativa').length;
  const qtdInativos = clientes.length - qtdAtivos;

  const categorias = [
    { id: 'Todos', label: `Todos (${clientes.length})` },
    { id: 'Ativos', label: `Ativos (${qtdAtivos})` },
    { id: 'Inativos', label: `Inativos (${qtdInativos})` },
    { id: 'Histórico', label: 'Histórico de Cortes' }
  ];

  if (loading) return <div className="min-h-screen bg-[#09090b]"></div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col font-sans overflow-x-hidden">
      
      <div className="p-5 max-w-[400px] mx-auto w-full flex-grow">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-[#CEAA6B] font-black text-lg uppercase tracking-widest">Painel do João</h1>
          <button onClick={() => { localStorage.clear(); navigate('/'); }} className="w-8 h-8 bg-[#121212] border border-[#27272a] rounded-full flex items-center justify-center text-zinc-500">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </header>

        {/* AGUARDANDO ATIVAÇÃO */}
        {pendentes.length > 0 && (
          <div className="mb-8">
            <button onClick={() => setIsExpandido(!isExpandido)} className="flex items-center gap-2 mb-4">
              <h2 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Aguardando Ativação ({pendentes.length})</h2>
              <svg className={`text-zinc-500 transition-transform ${isExpandido ? 'rotate-180' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            
            <div className={`space-y-3 transition-all ${isExpandido ? 'block' : 'hidden'}`}>
              {pendentes.map(p => (
                <div key={p.id} className="bg-[#121212] border border-[#27272a] p-4 rounded-2xl flex justify-between items-center">
                  <div className="max-w-[60%]">
                    <p className="font-bold text-sm text-white truncate">{p.nome}</p>
                    <p className="text-[10px] text-[#CEAA6B] font-bold">WhatsApp: {p.whatsapp}</p>
                  </div>
                  <button className="bg-[#CEAA6B] text-black text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 transition-transform">
                    ATIVAR
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FILTROS DESLIZANTES */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide no-scrollbar mb-2">
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFiltroAtivo(cat.id)}
              className={`px-4 py-2 rounded-[14px] text-[11px] font-bold whitespace-nowrap transition-all border ${
                filtroAtivo === cat.id 
                ? 'bg-[#CEAA6B] text-black border-[#CEAA6B]' 
                : 'bg-[#121212] text-zinc-500 border-[#27272a]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* BUSCA (Só aparece se não estiver no Histórico) */}
        {filtroAtivo !== 'Histórico' && (
          <div className="relative mb-6">
            <input 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-[#121212] border border-[#27272a] rounded-[18px] p-4 pl-12 text-sm outline-none focus:border-[#CEAA6B] transition-colors placeholder:text-zinc-600 text-white"
              placeholder="Buscar cliente..."
            />
            <svg className="absolute left-4 top-4 text-zinc-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
        )}

        {/* RENDERIZAÇÃO: HISTÓRICO OU CLIENTES */}
        <div className="space-y-4 pb-10">
          
          {filtroAtivo === 'Histórico' ? (
            /* TELA DE HISTÓRICO GERAL */
            historicoGlobal.length > 0 ? (
              historicoGlobal.map(corte => {
                const data = new Date(corte.created_at);
                return (
                  <div key={corte.id} className="bg-[#121212] border border-[#27272a] p-4 rounded-[20px] flex justify-between items-center">
                    <div>
                      <p className="text-white font-bold text-sm">{corte.nome_cliente}</p>
                      <p className="text-[#CEAA6B] text-[10px] font-bold uppercase mt-1">{corte.tipo_corte || 'Cabelo'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-400 text-xs">{data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                      <p className="text-zinc-600 text-[10px] font-medium">{data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-center text-zinc-700 text-xs mt-10">Nenhum corte registrado ainda.</p>
            )

          ) : (
            /* TELA DE LISTAGEM DE CLIENTES (Cards Féis à Imagem) */
            clientesFiltrados.map(c => {
              const cortesMes = getCortesDoMes(c.historico_cortes);
              const vencimento = c.assinaturas?.[0]?.data_vencimento 
                ? new Date(c.assinaturas[0].data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                : '--/--';
              const estaAtivo = c.assinaturas?.[0]?.status === 'ativa';
              
              return (
                <div key={c.id} className="bg-[#121212] border border-[#27272a] rounded-[24px] p-5">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-4 max-w-[70%]">
                      {/* Círculo com Iniciais */}
                      <div className={`w-11 h-11 bg-transparent border rounded-full flex items-center justify-center font-bold text-xs ${estaAtivo ? 'border-[#1bc64d]/30 text-[#1bc64d]' : 'border-zinc-700 text-zinc-500'}`}>
                        {c.nome.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-base text-white truncate">{c.nome}</h3>
                        <p className="text-[10px] text-zinc-500 font-medium mt-0.5">4 Cortes/mês • R$ 90/mês</p>
                      </div>
                    </div>
                    {/* Badge de Status */}
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                      estaAtivo ? 'bg-[#0f2e1b] text-[#1bc64d]' : 'bg-[#3b1212] text-[#d93838]'
                    }`}>
                      {estaAtivo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  
                  <div className="h-[1px] bg-zinc-800/50 w-full mb-4"></div>
                  
                  <div className="flex justify-between items-center text-zinc-500 text-[11px] font-medium">
                    <div className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>{cortesMes} de 4 no mês</span>
                    </div>
                    <span>Vence {vencimento}</span>
                  </div>
                </div>
              );
            })
          )}
          
          {filtroAtivo !== 'Histórico' && clientesFiltrados.length === 0 && (
            <p className="text-center text-zinc-700 text-xs mt-10">Nenhum cliente encontrado.</p>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}