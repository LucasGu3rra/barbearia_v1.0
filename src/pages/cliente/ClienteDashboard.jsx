import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function ClienteDashboard() {
  const [dados, setDados] = useState(null);
  const [historicoMes, setHistoricoMes] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erroMsg, setErroMsg] = useState(null); // NOVO: Estado para capturar o erro
  const navigate = useNavigate();

  const precos = { cabelo: 70, barba: 50, completo: 110 };
  const nomesPlanos = { cabelo: 'Só Cabelo', barba: 'Só Barba', completo: 'Cabelo & Barba' };

  useEffect(() => {
    const clienteId = localStorage.getItem('clienteId');
    if (!clienteId) navigate('/');
    else carregarDados(clienteId);
  }, [navigate]);

  async function carregarDados(id) {
    try {
      setErroMsg(null); // Limpa erros antigos ao tentar recarregar

      const { data: cli, error: erroSupabase } = await supabase
        .from('clientes')
        .select(`
          nome, 
          whatsapp,
          assinaturas(status, data_vencimento, plano_escolhido),
          historico_cortes(id, created_at, tipo_corte)
        `)
        .eq('id', id).single();

      // Se der erro no banco (como a falta da coluna created_at), ele cai aqui
      if (erroSupabase) throw erroSupabase;
      if (!cli) throw new Error("Cliente não encontrado.");

      const plano = cli.assinaturas?.[0]?.plano_escolhido;

      // Trava: se não tiver plano, joga pra tela de escolha
      if (!plano) {
        navigate('/planos');
        return;
      }

      const statusBd = cli.assinaturas?.[0]?.status || 'pendente';
      const vencimentoBD = cli.assinaturas?.[0]?.data_vencimento;
      
      const hoje = new Date();
      
      // O '?' evita que o app quebre se historico_cortes vier nulo
      const cortesDoMes = cli.historico_cortes?.filter(corte => {
        if (!corte.created_at) return false; // Proteção extra caso a data venha nula
        const d = new Date(corte.created_at);
        return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
      }) || [];
      
      cortesDoMes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setHistoricoMes(cortesDoMes);

      let diasRestantes = null;
      let vencimentoFormatado = '--/--';
      
      if (vencimentoBD) {
        const dataVenc = new Date(vencimentoBD);
        vencimentoFormatado = dataVenc.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const diffTime = dataVenc.getTime() - hoje.getTime();
        diasRestantes = Math.ceil(diffTime / (1000 * 3600 * 24));
      }

      setDados({
        nome: cli.nome,
        whatsapp: cli.whatsapp,
        iniciais: cli.nome.substring(0, 2).toUpperCase(),
        status: statusBd,
        cortesUsados: cortesDoMes.length,
        cortesRestantes: Math.max(0, 4 - cortesDoMes.length),
        vencimentoFormatado,
        diasRestantes,
        planoId: plano,
        planoNome: nomesPlanos[plano]
      });
    } catch (err) {
      console.error("Erro no carregamento:", err.message);
      setErroMsg(err.message); // Salva o erro para mostrar na tela
    } finally {
      setLoading(false);
    }
  }

  async function alterarPlano(novoPlano) {
    if (novoPlano === dados.planoId) return;

    const diferenca = precos[novoPlano] - precos[dados.planoId];
    const mensagem = diferenca > 0 
      ? `Para mudar para ${nomesPlanos[novoPlano]}, a diferença é de R$ ${diferenca}. O vencimento continua o mesmo. Confirma?`
      : `Deseja mudar para ${nomesPlanos[novoPlano]}? A mudança valerá imediatamente. Confirma?`;

    if (window.confirm(mensagem)) {
      const id = localStorage.getItem('clienteId');
      const { error } = await supabase
        .from('assinaturas')
        .update({ plano_escolhido: novoPlano })
        .eq('cliente_id', id);

      if (!error) {
        alert("Plano alterado! Fale com o João caso haja diferença de valor.");
        carregarDados(id);
      }
    }
  }

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // ==========================================
  // TELA DE PROTEÇÃO (Se houver erro, não fica tela preta)
  // ==========================================
  if (erroMsg) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado.</h2>
        <p className="text-zinc-500 text-sm mb-8">Não conseguimos carregar seus dados no momento.</p>
        
        <button onClick={() => { localStorage.clear(); navigate('/'); }} className="bg-[#121212] border border-[#27272a] px-6 py-3 rounded-xl font-bold text-sm text-[#CEAA6B]">
          Voltar para o Login
        </button>
      </div>
    );
  }

  if (loading || !dados) return <div className="min-h-screen bg-[#09090b]"></div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-5 font-sans flex flex-col relative overflow-hidden">
      
      <div className="flex justify-between items-center mb-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#CEAA6B] rounded-full"></div>
          <span className="text-[#CEAA6B] text-[10px] font-bold tracking-[0.2em] uppercase">Barbearia do João</span>
        </div>
        <button 
          onClick={() => setMenuAberto(true)}
          className="w-10 h-10 rounded-full border border-[#CEAA6B]/30 flex items-center justify-center bg-[#121212] text-[#CEAA6B] font-bold text-sm active:scale-95 transition-transform"
        >
          {dados.iniciais}
        </button>
      </div>

      <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${menuAberto ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuAberto(false)}></div>
        
        <div className={`absolute right-0 top-0 bottom-0 w-4/5 max-w-[320px] bg-[#0c0c0e] border-l border-[#27272a] p-6 flex flex-col transition-transform duration-300 ease-out ${menuAberto ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold text-white">Minha Conta</h2>
            <button onClick={() => setMenuAberto(false)} className="text-zinc-500 hover:text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="mb-8">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Nome</p>
            <p className="font-medium mb-4">{dados.nome}</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">WhatsApp</p>
            <p className="font-medium">{dados.whatsapp}</p>
          </div>

          <h3 className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3">Mudar Meu Plano</h3>
          <div className="space-y-2 mb-auto">
            {Object.keys(precos).map(p => (
              <button key={p} onClick={() => alterarPlano(p)} className={`w-full p-3 rounded-xl border text-left flex justify-between items-center ${dados.planoId === p ? 'border-[#CEAA6B] bg-[#1a120b]' : 'border-[#27272a] bg-[#121212]'}`}>
                <div>
                  <p className={`font-bold text-sm ${dados.planoId === p ? 'text-[#CEAA6B]' : 'text-white'}`}>{nomesPlanos[p]}</p>
                  <p className="text-[10px] text-zinc-500">R$ {precos[p]}/mês</p>
                </div>
                {dados.planoId === p && <span className="bg-[#CEAA6B] text-black text-[9px] font-black px-2 py-1 rounded uppercase">Atual</span>}
              </button>
            ))}
          </div>

          <button onClick={handleLogout} className="mt-8 py-4 text-red-500 text-xs font-bold uppercase tracking-widest border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors">
            Sair do Sistema
          </button>
        </div>
      </div>

      <div className={`p-5 rounded-2xl border mb-5 ${dados.status === 'ativa' ? 'bg-[#121212] border-[#27272a]' : dados.status === 'pendente' ? 'bg-[#1a120b] border-orange-500/20' : 'bg-[#1a0b0b] border-red-500/20'}`}>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Status do Plano</p>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${dados.status === 'ativa' ? 'bg-[#22c55e]' : dados.status === 'pendente' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
          <span className={`text-[13px] font-black uppercase tracking-wide ${dados.status === 'ativa' ? 'text-[#22c55e]' : dados.status === 'pendente' ? 'text-orange-500' : 'text-red-500'}`}>
            {dados.status === 'ativa' ? 'Assinatura Ativa' : dados.status === 'pendente' ? 'Aguardando Ativação' : 'Assinatura Vencida'}
          </span>
        </div>
        <p className="text-zinc-400 text-[13px] leading-relaxed">
          {dados.status === 'ativa' ? 'Seu acesso está liberado!' : dados.status === 'pendente' ? 'Fale com o João para ativar sua mensalidade inicial.' : 'Seu plano venceu. Renove para continuar cortando.'}
        </p>
      </div>

      <div className="bg-[#121212] border border-[#27272a] rounded-[20px] p-4 flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full border border-[#CEAA6B]/30 flex items-center justify-center text-[#CEAA6B] font-medium text-lg">
          {dados.iniciais}
        </div>
        <div>
          <h2 className="font-bold text-base text-white">{dados.nome}</h2>
          <div className="inline-block mt-1 border border-[#CEAA6B]/30 rounded-md px-2 py-1">
            <p className="text-[#CEAA6B] text-[10px] font-medium uppercase tracking-tight">Plano {dados.planoNome}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full mb-6">
        <div className="bg-[#121212] border border-[#27272a] p-4 rounded-[20px] flex flex-col items-center">
          <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mb-3">Quantidade de Cortes</p>
          <div className="flex gap-1.5 mb-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`w-4 h-4 rounded-[3px] ${i < dados.cortesRestantes ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}></div>
            ))}
          </div>
          <p className="text-2xl font-bold text-[#CEAA6B]">{dados.cortesRestantes} <span className="text-zinc-500 text-[10px] font-normal tracking-wide">de 4</span></p>
        </div>

        <div className="bg-[#121212] border border-[#27272a] p-4 rounded-[20px] flex flex-col items-center text-center justify-center">
          <p className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mb-2">Vencimento</p>
          <p className="text-[26px] font-bold text-white leading-none">{dados.vencimentoFormatado}</p>
          <p className="text-zinc-500 text-[10px] mt-1">
            {dados.diasRestantes > 0 ? `em ${dados.diasRestantes} dias` : dados.diasRestantes === 0 ? 'Vence hoje' : dados.diasRestantes < 0 ? 'Vencido' : ''}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3 pl-1">Histórico do mês</p>
        <div className="bg-[#121212] border border-[#27272a] rounded-[20px] p-2 space-y-1">
          {historicoMes.length > 0 ? (
            historicoMes.map((corte, index) => {
              const dataC = new Date(corte.created_at);
              return (
                <div key={index} className="flex items-center justify-between p-3 rounded-2xl bg-[#09090b]/50">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full border border-[#27272a] bg-[#121212] flex items-center justify-center text-zinc-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{corte.tipo_corte || 'Corte realizado'}</p>
                      <p className="text-[10px] text-zinc-500">{dataC.toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}, {dataC.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</p>
                    </div>
                  </div>
                  <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full mr-2"></div>
                </div>
              )
            })
          ) : (
            <div className="p-4 text-center text-zinc-600 text-xs">Nenhum corte registrado neste mês.</div>
          )}
        </div>
      </div>

      <div className="flex-grow"></div>

      {dados.status === 'ativa' ? (
        <button 
          disabled={dados.cortesRestantes === 0}
          onClick={() => navigate('/confirmado')}
          className="w-full bg-[#CEAA6B] hover:bg-[#c09d60] disabled:bg-[#27272a] disabled:text-zinc-500 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-4"
        >
          {dados.cortesRestantes > 0 ? 'Confirmar Corte' : 'Cortes Esgotados'}
        </button>
      ) : dados.status === 'pendente' ? (
        <a href="https://wa.me/55" target="_blank" rel="noreferrer" className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center mt-4">
          Falar com o João
        </a>
      ) : (
        <a href="https://wa.me/55" target="_blank" rel="noreferrer" className="w-full bg-[#25D366] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-4">
          Renovar Assinatura no WhatsApp
        </a>
      )}
    </div>
  );
}