/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function ModalBarbeiros({ isOpen, onClose, empresaId }) {
  const [barbeiros, setBarbeiros] = useState([]);
  const [filiais, setFiliais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoBarbeiro, setNovoBarbeiro] = useState({ nome: '', filial_id: '' });
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const [{ data: dadosBarbeiros }, { data: dadosFiliais }] = await Promise.all([
      supabase.from('barbeiros').select('*, filiais(nome)').eq('empresa_id', empresaId).order('created_at', { ascending: true }),
      supabase.from('filiais').select('id, nome').eq('empresa_id', empresaId).eq('ativa', true).order('nome'),
    ]);
    setBarbeiros(dadosBarbeiros || []);
    setFiliais(dadosFiliais || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    if (isOpen && empresaId) carregarDados();
  }, [isOpen, empresaId, carregarDados]);

  const salvarNovoBarbeiro = async () => {
    if (!novoBarbeiro.nome.trim()) {
      setErro('O nome do barbeiro é obrigatório.');
      return;
    }
    if (!novoBarbeiro.filial_id) {
      setErro('Selecione uma filial.');
      return;
    }
    setSalvando(true);
    setErro('');
    const { error } = await supabase
      .from('barbeiros')
      .insert([{ nome: novoBarbeiro.nome.trim(), filial_id: novoBarbeiro.filial_id, empresa_id: empresaId }]);

    if (error) {
      setErro('Erro ao salvar. Tente novamente.');
    } else {
      setNovoBarbeiro({ nome: '', filial_id: '' });
      setAdicionando(false);
      await carregarDados();
    }
    setSalvando(false);
  };

  const toggleAtivo = async (barbeiro) => {
    const { error } = await supabase
      .from('barbeiros')
      .update({ ativo: !barbeiro.ativo })
      .eq('id', barbeiro.id)
      .eq('empresa_id', empresaId);

    if (!error) carregarDados();
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Barbeiros</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Gerenciar Profissionais</p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 pt-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando...</p>
          ) : (
            <>
              {barbeiros.length === 0 && !adicionando && (
                <div className="text-center py-6 border border-dashed border-[#27272a] rounded-2xl">
                  <p className="text-zinc-600 text-xs italic">Nenhum barbeiro cadastrado.</p>
                </div>
              )}

              {barbeiros.map((barbeiro) => (
                <div key={barbeiro.id} className="bg-[#121212] border border-[#27272a] rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">{barbeiro.nome}</p>
                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {barbeiro.filiais?.nome || 'Filial não encontrada'}
                    </p>
                  </div>
                  {/* Toggle ativo/inativo */}
                  <button
                    onClick={() => toggleAtivo(barbeiro)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${barbeiro.ativo ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${barbeiro.ativo ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}

              {/* Formulário de novo barbeiro */}
              {adicionando && (
                <div className="bg-[#121212] border border-[#CEAA6B]/30 rounded-2xl p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Nome do barbeiro *"
                    value={novoBarbeiro.nome}
                    onChange={(e) => setNovoBarbeiro(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CEAA6B]/50 placeholder-zinc-600 transition-colors"
                  />
                  <select
                    value={novoBarbeiro.filial_id}
                    onChange={(e) => setNovoBarbeiro(prev => ({ ...prev, filial_id: e.target.value }))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors appearance-none"
                    style={{ color: novoBarbeiro.filial_id ? 'white' : '#52525b' }}
                  >
                    <option value="" disabled>Selecione a filial *</option>
                    {filiais.map(f => (
                      <option key={f.id} value={f.id} style={{ color: 'white', background: '#09090b' }}>{f.nome}</option>
                    ))}
                  </select>
                  {filiais.length === 0 && (
                    <p className="text-amber-500/80 text-[11px]">Cadastre uma filial antes de adicionar barbeiros.</p>
                  )}
                  {erro && <p className="text-red-500 text-[11px] font-medium">{erro}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAdicionando(false); setErro(''); setNovoBarbeiro({ nome: '', filial_id: '' }); }}
                      className="flex-1 py-3 rounded-xl border border-[#27272a] text-zinc-500 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvarNovoBarbeiro}
                      disabled={salvando || filiais.length === 0}
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
              + Novo Barbeiro
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
