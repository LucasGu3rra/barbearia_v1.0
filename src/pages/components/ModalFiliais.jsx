/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function ModalFiliais({ isOpen, onClose, empresaId }) {
  const [filiais, setFiliais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novaFilial, setNovaFilial] = useState({ nome: '', endereco: '' });
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarFiliais = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('filiais')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true });

    if (!error) setFiliais(data || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    if (isOpen && empresaId) carregarFiliais();
  }, [isOpen, empresaId, carregarFiliais]);

  const salvarNovaFilial = async () => {
    if (!novaFilial.nome.trim()) {
      setErro('O nome da filial é obrigatório.');
      return;
    }
    setSalvando(true);
    setErro('');
    const { error } = await supabase
      .from('filiais')
      .insert([{ nome: novaFilial.nome.trim(), endereco: novaFilial.endereco.trim(), empresa_id: empresaId }]);

    if (error) {
      setErro('Erro ao salvar. Tente novamente.');
    } else {
      setNovaFilial({ nome: '', endereco: '' });
      setAdicionando(false);
      await carregarFiliais();
    }
    setSalvando(false);
  };

  const toggleAtiva = async (filial) => {
    const { error } = await supabase
      .from('filiais')
      .update({ ativa: !filial.ativa })
      .eq('id', filial.id)
      .eq('empresa_id', empresaId);

    if (!error) carregarFiliais();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[#09090b] border border-[#27272a] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out]">

        {/* Header */}
        <div className="relative p-6 pb-0">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Filiais</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Gerenciar Unidades</p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 pt-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando...</p>
          ) : (
            <>
              {filiais.length === 0 && !adicionando && (
                <div className="text-center py-6 border border-dashed border-[#27272a] rounded-2xl">
                  <p className="text-zinc-600 text-xs italic">Nenhuma filial cadastrada.</p>
                </div>
              )}

              {filiais.map((filial) => (
                <div key={filial.id} className="bg-[#121212] border border-[#27272a] rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">{filial.nome}</p>
                    {filial.endereco && (
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">{filial.endereco}</p>
                    )}
                  </div>
                  {/* Toggle ativa/inativa */}
                  <button
                    onClick={() => toggleAtiva(filial)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${filial.ativa ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${filial.ativa ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}

              {/* Formulário de nova filial */}
              {adicionando && (
                <div className="bg-[#121212] border border-[#CEAA6B]/30 rounded-2xl p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Nome da filial *"
                    value={novaFilial.nome}
                    onChange={(e) => setNovaFilial(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CEAA6B]/50 placeholder-zinc-600 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Endereço (opcional)"
                    value={novaFilial.endereco}
                    onChange={(e) => setNovaFilial(prev => ({ ...prev, endereco: e.target.value }))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CEAA6B]/50 placeholder-zinc-600 transition-colors"
                  />
                  {erro && <p className="text-red-500 text-[11px] font-medium">{erro}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAdicionando(false); setErro(''); setNovaFilial({ nome: '', endereco: '' }); }}
                      className="flex-1 py-3 rounded-xl border border-[#27272a] text-zinc-500 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvarNovaFilial}
                      disabled={salvando}
                      className="flex-1 py-3 rounded-xl bg-[#CEAA6B] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-opacity"
                    >
                      {salvando ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 space-y-2">
          {!adicionando && (
            <button
              onClick={() => { setAdicionando(true); setErro(''); }}
              className="w-full bg-[#CEAA6B]/10 text-[#CEAA6B] border border-[#CEAA6B]/20 font-bold py-3.5 rounded-[20px] text-xs uppercase tracking-widest hover:bg-[#CEAA6B]/20 transition-colors"
            >
              + Nova Filial
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full bg-white text-black font-black py-4 rounded-[20px] uppercase tracking-[0.2em] text-[9px] active:scale-95 transition-all shadow-[0_8px_15px_rgba(255,255,255,0.1)]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
