import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function ModalServicos({ isOpen, onClose, onRefresh }) {
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoServico, setNovoServico] = useState({ nome: '', preco: '', duracao_minutos: 30 });
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isOpen) carregarServicos();
  }, [isOpen]);

  const carregarServicos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error) setServicos(data || []);
    setLoading(false);
  };

  const salvarNovoServico = async () => {
    if (!novoServico.nome.trim()) {
      setErro('O nome do serviço é obrigatório.');
      return;
    }
    const preco = parseFloat(novoServico.preco);
    if (!novoServico.preco || isNaN(preco) || preco <= 0) {
      setErro('Informe um preço avulso válido.');
      return;
    }
    const duracao = parseInt(novoServico.duracao_minutos);
    if (!duracao || duracao < 5) {
      setErro('A duração mínima é de 5 minutos.');
      return;
    }
    setSalvando(true);
    setErro('');
    const { error } = await supabase
      .from('servicos')
      .insert([{ nome: novoServico.nome.trim(), preco, duracao_minutos: duracao }]);

    if (error) {
      setErro('Erro ao salvar. Tente novamente.');
    } else {
      setNovoServico({ nome: '', preco: '', duracao_minutos: 30 });
      setAdicionando(false);
      await carregarServicos();
      if (onRefresh) onRefresh();
    }
    setSalvando(false);
  };

  const toggleAtivo = async (servico) => {
    const { error } = await supabase
      .from('servicos')
      .update({ ativo: !servico.ativo })
      .eq('id', servico.id);

    if (!error) {
      carregarServicos();
      if (onRefresh) onRefresh();
    }
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Serviços</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Gerenciar Serviços Avulsos</p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 pt-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando...</p>
          ) : (
            <>
              {servicos.length === 0 && !adicionando && (
                <div className="text-center py-6 border border-dashed border-[#27272a] rounded-2xl">
                  <p className="text-zinc-600 text-xs italic">Nenhum serviço cadastrado.</p>
                </div>
              )}

              {servicos.map((servico) => (
                <div key={servico.id} className="bg-[#121212] border border-[#27272a] rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">{servico.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-[#CEAA6B] font-bold">
                        R$ {Number(servico.preco).toFixed(2).replace('.', ',')}
                      </p>
                      <span className="text-zinc-600 text-[10px]">•</span>
                      <p className="text-[10px] text-zinc-500">{servico.duracao_minutos} min</p>
                    </div>
                  </div>
                  {/* Toggle ativo/inativo */}
                  <button
                    onClick={() => toggleAtivo(servico)}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${servico.ativo ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${servico.ativo ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}

              {/* Formulário de novo serviço */}
              {adicionando && (
                <div className="bg-[#121212] border border-[#CEAA6B]/30 rounded-2xl p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Nome do serviço * (ex: Corte de Cabelo)"
                    value={novoServico.nome}
                    onChange={(e) => setNovoServico(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CEAA6B]/50 placeholder-zinc-600 transition-colors"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Preço Avulso (R$) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={novoServico.preco}
                        onChange={(e) => setNovoServico(prev => ({ ...prev, preco: e.target.value }))}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CEAA6B]/50 placeholder-zinc-600 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Duração (min)</label>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        placeholder="30"
                        value={novoServico.duracao_minutos}
                        onChange={(e) => setNovoServico(prev => ({ ...prev, duracao_minutos: e.target.value }))}
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CEAA6B]/50 placeholder-zinc-600 transition-colors"
                      />
                    </div>
                  </div>
                  {erro && <p className="text-red-500 text-[11px] font-medium">{erro}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAdicionando(false); setErro(''); setNovoServico({ nome: '', preco: '', duracao_minutos: 30 }); }}
                      className="flex-1 py-3 rounded-xl border border-[#27272a] text-zinc-500 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvarNovoServico}
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
              + Novo Serviço
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
