import { useState } from 'react';

export default function DrawerAdmin({ isOpen, onClose, onOpenPlanos, onLogout, dadosFinanceiros }) {
  const [modalFinanceiro, setModalFinanceiro] = useState(false);

  if (!isOpen) return null;

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-72 bg-[#09090b] border-l border-[#27272a] z-[70] p-6 flex flex-col animate-[slideIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-[#CEAA6B] font-bold uppercase tracking-widest text-sm">Menu Admin</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav className="flex-1 space-y-3">
          <button 
            onClick={() => { setModalFinanceiro(true); }} 
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B] group-hover:bg-[#CEAA6B] group-hover:text-black transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div className="text-left">
              <span className="block font-bold text-sm">Financeiro</span>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Renda e Previsão</span>
            </div>
          </button>

          <button 
            onClick={() => { onOpenPlanos(); onClose(); }} 
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B] hover:bg-[#18181b] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <div className="text-left">
              <span className="block font-bold text-sm">Planos</span>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Gerenciar Valores</span>
            </div>
          </button>
        </nav>

        <button onClick={onLogout} className="mt-auto w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/5 text-red-500/60 font-bold text-xs uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sair do Painel
        </button>
      </div>

      {/* Modal Financeiro Premium - Escala Ajustada */}
      {modalFinanceiro && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#27272a] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            
            {/* Header do Modal */}
            <div className="relative p-6 pb-0">
              <button 
                onClick={() => setModalFinanceiro(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#CEAA6B] flex items-center justify-center text-black shadow-[0_0_15px_rgba(206,170,107,0.2)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">Financeiro</h3>
              </div>
            </div>

            <div className="p-6 pt-2 space-y-4">
              {/* Card Faturamento Atual */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#121212] to-[#09090b] p-5 rounded-[24px] border border-[#27272a] group">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#CEAA6B]/5 rounded-full blur-2xl group-hover:bg-[#CEAA6B]/10 transition-all" />
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1.5">Faturamento Atual</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white tracking-tighter">
                    {formatarMoeda(dadosFinanceiros?.faturamentoMensal || 0).split(',')[0]}
                  </span>
                  <span className="text-base font-bold text-[#CEAA6B]">
                    ,{formatarMoeda(dadosFinanceiros?.faturamentoMensal || 0).split(',')[1]}
                  </span>
                </div>
              </div>

              {/* Card Previsão */}
              <div className="bg-[#121212]/50 p-5 rounded-[24px] border border-[#27272a] flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-0.5">Previsão Próximo Mês</p>
                  <p className="text-lg font-black text-emerald-500 tracking-tight">{formatarMoeda(dadosFinanceiros?.previsaoProximoMes || 0)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                </div>
              </div>

              {/* Info Adicional Simples */}
              <div className="flex justify-between items-center px-4 py-3 bg-[#121212] rounded-xl border border-[#27272a]">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Assinantes Ativos</span>
                <span className="text-xs font-black text-white">{dadosFinanceiros?.totalAtivos || 0}</span>
              </div>

              <button 
                onClick={() => setModalFinanceiro(false)} 
                className="w-full bg-white text-black font-black py-4 rounded-[20px] uppercase tracking-[0.2em] text-[9px] active:scale-95 transition-all shadow-[0_8px_15px_rgba(255,255,255,0.1)]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
