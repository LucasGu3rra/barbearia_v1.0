import React from 'react';

export default function DrawerAdmin({ isOpen, onClose, onOpenPlanos, onLogout }) {
  return (
    <>
      {/* Fundo escuro (Overlay) */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>

      {/* Menu Lateral (Drawer) */}
      <div 
        className={`fixed top-0 right-0 h-full w-72 bg-[#121212] border-l border-[#27272a] z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-[#CEAA6B] font-bold text-sm tracking-widest uppercase">Configurações</h2>
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-[#09090b] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {/* Botão Gerenciar Planos */}
            <button 
              onClick={() => {
                onOpenPlanos(); 
                onClose();      
              }}
              className="w-full flex items-center gap-3 bg-[#09090b] border border-[#27272a] p-4 rounded-2xl hover:border-[#CEAA6B]/50 transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center group-hover:border-[#CEAA6B]/50 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CEAA6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </div>
              <div>
                <span className="block text-sm font-bold text-white">Gerenciar Planos</span>
                <span className="block text-[10px] text-zinc-500 mt-0.5">Ajuste nomes, preços e limites</span>
              </div>
            </button>

            {/* Botão Agendamento (Em breve) */}
            <button 
              disabled
              className="w-full flex items-center gap-3 bg-[#09090b]/50 border border-[#27272a] p-4 rounded-2xl opacity-60 cursor-not-allowed text-left"
            >
              <div className="w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
              <div>
                <span className="block text-sm font-bold text-zinc-400">Agendamento</span>
                <span className="block text-[10px] text-[#CEAA6B] font-bold uppercase mt-0.5 tracking-wider">Em breve</span>
              </div>
            </button>
          </div>

          {/* Botão de Logout no final */}
          <div className="pt-6 border-t border-[#27272a]">
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 bg-red-500/5 border border-red-500/20 p-4 rounded-2xl hover:bg-red-500/10 transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-[#121212] border border-red-500/20 flex items-center justify-center group-hover:border-red-500/40 transition-colors text-red-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </div>
              <div>
                <span className="block text-sm font-bold text-red-500">Sair da Conta</span>
                <span className="block text-[10px] text-zinc-600 mt-0.5">Encerrar sessão atual</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}