import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function ModalPlanos({ isOpen, onClose, onRefresh }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen) buscarPlanos();
  }, [isOpen]);

  const buscarPlanos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('planos')
      .select('*')
      .order('preco', { ascending: true });
    
    if (!error) setPlanos(data);
    setLoading(false);
  };

  const handleInputChange = (id, campo, valor) => {
    setPlanos(planos.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  };

  const salvarAlteracoes = async () => {
    setSalvando(true);
    try {
      for (const plano of planos) {
        const { error } = await supabase
          .from('planos')
          .update({
            nome: plano.nome,
            preco: parseFloat(plano.preco),
            limite: parseInt(plano.limite)
          })
          .eq('id', plano.id);
        
        if (error) throw error;
      }
      onRefresh(); // Atualiza os dados no dashboard principal
      onClose();   // Fecha o modal
    } catch (error) {
      alert("Erro ao salvar planos: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>

      {/* Box do Modal */}
      <div className="relative w-full max-w-md bg-[#121212] border border-[#27272a] rounded-[32px] overflow-hidden animate-[zoomIn_0.2s_ease-out]">
        <header className="p-6 border-b border-[#27272a] flex justify-between items-center bg-[#09090b]">
          <div>
            <h3 className="text-xl font-bold text-white">Gerenciar Planos</h3>
            <p className="text-[10px] text-[#CEAA6B] font-bold uppercase tracking-widest mt-0.5">Ajuste valores e limites</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-[#1c1c1e] text-zinc-500 rounded-full hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </header>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6 custom-scrollbar">
          {loading ? (
            <div className="py-10 text-center text-[#CEAA6B] font-bold animate-pulse uppercase text-xs tracking-widest">Carregando dados...</div>
          ) : (
            planos.map((plano) => (
              <div key={plano.id} className="space-y-3 p-4 bg-[#09090b] border border-[#27272a] rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">ID: {plano.slug}</span>
                   <div className={`w-2 h-2 rounded-full ${plano.ativo ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Nome do Plano</label>
                  <input 
                    type="text"
                    value={plano.nome}
                    onChange={(e) => handleInputChange(plano.id, 'nome', e.target.value)}
                    className="w-full bg-[#121212] border border-[#27272a] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#CEAA6B]/50 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Preço (R$)</label>
                    <input 
                      type="number"
                      value={plano.preco}
                      onChange={(e) => handleInputChange(plano.id, 'preco', e.target.value)}
                      className="w-full bg-[#121212] border border-[#27272a] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#CEAA6B]/50 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Qtd. Cortes</label>
                    <input 
                      type="number"
                      value={plano.limite}
                      onChange={(e) => handleInputChange(plano.id, 'limite', e.target.value)}
                      className="w-full bg-[#121212] border border-[#27272a] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#CEAA6B]/50 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="p-6 bg-[#09090b] border-t border-[#27272a]">
          <button 
            onClick={salvarAlteracoes}
            disabled={salvando || loading}
            className="w-full bg-[#CEAA6B] text-black font-black text-xs uppercase tracking-widest py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {salvando ? 'Salvando alterações...' : 'Confirmar e Salvar'}
          </button>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
      `}} />
    </div>
  );
}