/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function ModalPlanos({ isOpen, onClose, onRefresh, empresaId }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const buscarPlanos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('planos')
      .select('*')
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .order('preco', { ascending: true });
    
    if (!error) setPlanos(data);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    if (isOpen && empresaId) buscarPlanos();
  }, [isOpen, empresaId, buscarPlanos]);

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
            limite: plano.ilimitado ? 0 : parseInt(plano.limite),
            ilimitado: Boolean(plano.ilimitado),
            ativo: Boolean(plano.ativo)
          })
          .eq('id', plano.id)
          .eq('empresa_id', empresaId);
        
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

  const excluirPlano = async (plano) => {
    if (!window.confirm(`Excluir o plano "${plano.nome}"? Clientes com esse plano podem ficar sem referência.`)) return;
    const { error } = await supabase
      .from('planos')
      .update({ ativo: false, deleted_at: new Date().toISOString() })
      .eq('id', plano.id)
      .eq('empresa_id', empresaId);

    if (error) {
      alert('Erro ao excluir plano: ' + error.message);
      return;
    }

    await buscarPlanos();
    if (onRefresh) onRefresh();
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
                   <button
                    type="button"
                    onClick={() => handleInputChange(plano.id, 'ativo', !plano.ativo)}
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${plano.ativo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
                   >
                    {plano.ativo ? 'Ativo' : 'Inativo'}
                   </button>
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
                      value={plano.ilimitado ? '' : plano.limite}
                      disabled={plano.ilimitado}
                      onChange={(e) => handleInputChange(plano.id, 'limite', e.target.value)}
                      className="w-full bg-[#121212] border border-[#27272a] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#CEAA6B]/50 outline-none transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleInputChange(plano.id, 'ilimitado', !plano.ilimitado)}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors ${plano.ilimitado ? 'border-[#CEAA6B]/40 bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'border-[#27272a] bg-[#121212] text-zinc-500'}`}
                >
                  <span className="text-xs font-bold uppercase tracking-widest">Plano ilimitado</span>
                  <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${plano.ilimitado ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${plano.ilimitado ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => excluirPlano(plano)}
                  className="w-full p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold uppercase tracking-widest"
                >
                  Excluir plano
                </button>
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
