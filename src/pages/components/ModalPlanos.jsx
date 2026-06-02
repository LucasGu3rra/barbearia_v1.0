/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const criarSlugPlano = (nome) => {
  const base = String(nome || 'novo-plano')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-plano';

  return `${base}-${Date.now().toString(36)}`;
};

export default function ModalPlanos({ isOpen, onClose, onRefresh, empresaId }) {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [planoAbertoId, setPlanoAbertoId] = useState(null);
  const [erroOperacao, setErroOperacao] = useState('');

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

  const adicionarPlano = async () => {
    if (adicionando) return;
    setErroOperacao('');
    setAdicionando(true);
    const nome = 'Novo Plano';
    const slug = criarSlugPlano(nome);
    const { data, error } = await supabase
      .from('planos')
      .insert([{
        empresa_id: empresaId,
        slug,
        nome,
        preco: 0,
        limite: 1,
        duracao_minutos: 30,
        ilimitado: false,
        ativo: true,
      }])
      .select('*')
      .single();

    if (error) {
      setErroOperacao('Nao foi possivel adicionar o plano. Tente novamente.');
      setAdicionando(false);
      return;
    }

    setPlanos([...planos, data]);
    setPlanoAbertoId(data.id);
    setAdicionando(false);
  };

  const salvarAlteracoes = async () => {
    setErroOperacao('');
    const planoInvalido = planos.find((plano) => {
      const nomeValido = String(plano.nome || '').trim().length > 0;
      const precoValido = Number.isFinite(Number(plano.preco)) && Number(plano.preco) >= 0;
      const limiteValido = Boolean(plano.ilimitado) || (Number.isInteger(Number(plano.limite)) && Number(plano.limite) > 0);
      const duracaoValida = Number.isInteger(Number(plano.duracao_minutos)) && Number(plano.duracao_minutos) > 0;
      return !nomeValido || !precoValido || !limiteValido || !duracaoValida;
    });

    if (planoInvalido) {
      setErroOperacao('Revise os planos: nome, valor, duracao e limite precisam ser validos.');
      setPlanoAbertoId(planoInvalido.id);
      return;
    }

    setSalvando(true);
    try {
      for (const plano of planos) {
        const { error } = await supabase
          .from('planos')
          .update({
            nome: String(plano.nome || '').trim(),
            preco: Number(plano.preco),
            limite: plano.ilimitado ? 0 : Number(plano.limite),
            duracao_minutos: Number(plano.duracao_minutos),
            servico_id: null,
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-hidden overscroll-none">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>

      {/* Box do Modal */}
      <div className="relative w-full max-w-md max-h-[92vh] bg-[#121212] border border-[#27272a] rounded-[32px] overflow-hidden animate-[zoomIn_0.2s_ease-out] flex flex-col">
        <header className="px-6 py-5 border-b border-[#27272a] flex justify-between items-center bg-[#09090b] flex-shrink-0">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Gerenciar Planos</h3>
            <p className="text-[9px] text-[#CEAA6B] font-bold uppercase tracking-widest mt-0.5">Valores, limites e duracao</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#1c1c1e] text-zinc-500 rounded-full hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </header>

        <div className="p-[8px] flex-1 min-h-[360px] overflow-y-auto space-y-[8px] custom-scrollbar overscroll-contain">
          {loading ? (
            <div className="py-10 text-center text-[#CEAA6B] font-bold animate-pulse uppercase text-xs tracking-widest">Carregando dados...</div>
          ) : (
            planos.length === 0 ? (
              <div className="h-full min-h-[260px] flex items-center justify-center text-center border border-dashed border-[#27272a] rounded-2xl p-4">
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Nenhum plano ativo cadastrado ainda. Clique em <strong className="text-[#CEAA6B]">Adicionar plano</strong> abaixo para criar o primeiro.
                </p>
              </div>
            ) : planos.map((plano) => {
              const aberto = planoAbertoId === plano.id;

              return (
                <div key={plano.id} className="space-y-[8px] p-3 bg-[#09090b] border border-[#27272a] rounded-[18px]">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setPlanoAbertoId(aberto ? null : plano.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPlanoAbertoId(aberto ? null : plano.id);
                      }
                    }}
                    className="w-full flex justify-between items-center gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <h4 className="text-white text-[15px] font-black truncate">{aberto ? `Editando: ${plano.nome}` : plano.nome}</h4>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1.5">
                        R$ {Number(plano.preco || 0).toFixed(0)} · {plano.ilimitado ? 'Ilimitado' : `${plano.limite} cortes`} · {plano.duracao_minutos || 30} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleInputChange(plano.id, 'ativo', !plano.ativo);
                        }}
                        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${plano.ativo ? 'bg-emerald-500' : 'bg-[#27272a]'}`}
                        title={plano.ativo ? 'Desativar plano' : 'Ativar plano'}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${plano.ativo ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                      <span className={`text-zinc-500 text-sm transition-transform ${aberto ? 'rotate-180' : ''}`}>⌄</span>
                    </div>
                  </div>

                  {aberto && (
                    <>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-500 uppercase ml-1">Nome</label>
                        <input
                          type="text"
                          value={plano.nome}
                          onChange={(e) => handleInputChange(plano.id, 'nome', e.target.value)}
                          className="w-full h-8 bg-[#121212] border border-[#27272a] rounded-[10px] px-2.5 text-white text-sm focus:border-[#CEAA6B]/50 outline-none transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-zinc-500 uppercase ml-1">Preco</label>
                          <input
                            type="number"
                            value={plano.preco}
                            onChange={(e) => handleInputChange(plano.id, 'preco', e.target.value)}
                            className="w-full h-8 bg-[#121212] border border-[#27272a] rounded-[10px] px-2.5 text-white text-sm font-bold focus:border-[#CEAA6B]/50 outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-500 uppercase ml-1">Cortes</label>
                          <input
                            type="number"
                            value={plano.ilimitado ? '' : plano.limite}
                            disabled={plano.ilimitado}
                            onChange={(e) => handleInputChange(plano.id, 'limite', e.target.value)}
                            className="w-full h-8 bg-[#121212] border border-[#27272a] rounded-[10px] px-2.5 text-white text-sm font-bold focus:border-[#CEAA6B]/50 outline-none transition-colors disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-zinc-500 uppercase ml-1">Duracao</label>
                          <input
                            type="number"
                            min="1"
                            value={plano.duracao_minutos || 30}
                            onChange={(e) => handleInputChange(plano.id, 'duracao_minutos', e.target.value)}
                            className="w-full h-8 bg-[#121212] border border-[#27272a] rounded-[10px] px-2.5 text-white text-sm font-bold focus:border-[#CEAA6B]/50 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_1.15fr] gap-2 items-stretch">
                        <button
                          type="button"
                          onClick={() => handleInputChange(plano.id, 'ilimitado', !plano.ilimitado)}
                          className={`h-8 px-2.5 rounded-[10px] border flex items-center justify-between gap-2 transition-colors ${plano.ilimitado ? 'border-[#CEAA6B]/40 bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'border-[#27272a] bg-[#121212] text-zinc-500'}`}
                          title="Plano ilimitado"
                        >
                          <span className="text-[9px] font-bold uppercase tracking-widest">Ilimitado</span>
                          <span className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${plano.ilimitado ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${plano.ilimitado ? 'translate-x-4' : 'translate-x-0'}`} />
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => excluirPlano(plano)}
                          className="h-8 rounded-[10px] border border-red-500/20 bg-red-500/5 text-red-400 text-[9px] font-bold uppercase tracking-widest"
                        >
                          Excluir plano
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <footer className="p-6 pt-4 bg-[#09090b] border-t border-[#27272a] space-y-2 flex-shrink-0">
          {erroOperacao && (
            <p className="text-red-400 text-[10px] font-bold text-center">{erroOperacao}</p>
          )}
          <button
            type="button"
            onClick={adicionarPlano}
            disabled={loading || salvando || adicionando}
            className="w-full h-9 rounded-xl border border-[#CEAA6B]/30 bg-[#CEAA6B]/10 text-[#CEAA6B] text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {adicionando ? 'Adicionando...' : 'Adicionar plano'}
          </button>
          <button 
            onClick={salvarAlteracoes}
            disabled={salvando || loading}
            className="w-full bg-[#CEAA6B] text-black font-black text-xs uppercase tracking-widest py-3 rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
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
