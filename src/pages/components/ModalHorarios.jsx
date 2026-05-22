/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function ModalHorarios({ isOpen, onClose, empresaId }) {
  const [filiais, setFiliais] = useState([]);
  const [filialSelecionada, setFilialSelecionada] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const selecionarFilial = useCallback(async (filial) => {
    setFilialSelecionada(filial);
    setLoading(true);
    
    const { data, error } = await supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('filial_id', filial.id);

    // Estrutura padrão da semana
    const baseHorarios = Array.from({ length: 7 }, (_, i) => ({
      dia_semana: i,
      aberto: i >= 1 && i <= 5, // Seg a Sex abertos por padrão
      horario_inicio: '08:00',
      horario_fim: '19:00',
      intervalo_inicio: '',
      intervalo_fim: ''
    }));

    if (!error && data && data.length > 0) {
      data.forEach(h => {
        baseHorarios[h.dia_semana] = {
          id: h.id,
          dia_semana: h.dia_semana,
          aberto: h.aberto,
          horario_inicio: h.horario_inicio ? h.horario_inicio.substring(0, 5) : '08:00',
          horario_fim: h.horario_fim ? h.horario_fim.substring(0, 5) : '19:00',
          intervalo_inicio: h.intervalo_inicio ? h.intervalo_inicio.substring(0, 5) : '',
          intervalo_fim: h.intervalo_fim ? h.intervalo_fim.substring(0, 5) : ''
        };
      });
    }

    setHorarios(baseHorarios);
    setLoading(false);
  }, [empresaId]);

  const carregarFiliais = useCallback(async () => {
    setLoading(true);
    setErro('');
    const { data, error } = await supabase
      .from('filiais')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativa', true)
      .order('nome');

    if (error) {
      setErro('Erro ao carregar filiais.');
      setLoading(false);
      return;
    }

    setFiliais(data || []);
    
    // Lógica Inteligente: Se houver apenas 1 filial ativa, já seleciona ela direto!
    if (data && data.length === 1) {
      selecionarFilial(data[0]);
    } else {
      setLoading(false);
    }
  }, [empresaId, selecionarFilial]);

  useEffect(() => {
    if (isOpen && empresaId) {
      carregarFiliais();
    } else {
      setFilialSelecionada(null);
      setHorarios([]);
      setErro('');
    }
  }, [isOpen, empresaId, carregarFiliais]);
  const handleHorarioChange = (index, campo, valor) => {
    const novos = [...horarios];
    novos[index][campo] = valor;
    setHorarios(novos);
  };

  const toggleAbertoDia = (index) => {
    const novos = [...horarios];
    novos[index].aberto = !novos[index].aberto;
    setHorarios(novos);
  };

  const salvarHorarios = async () => {
    setSalvando(true);
    setErro('');
    
    try {
      for (const h of horarios) {
        const payload = {
          filial_id: filialSelecionada.id,
          empresa_id: empresaId,
          dia_semana: h.dia_semana,
          aberto: h.aberto,
          horario_inicio: h.aberto && h.horario_inicio ? `${h.horario_inicio}:00` : null,
          horario_fim: h.aberto && h.horario_fim ? `${h.horario_fim}:00` : null,
          intervalo_inicio: h.aberto && h.intervalo_inicio ? `${h.intervalo_inicio}:00` : null,
          intervalo_fim: h.aberto && h.intervalo_fim ? `${h.intervalo_fim}:00` : null,
        };

        if (h.id) {
          await supabase.from('horarios_funcionamento').update(payload).eq('id', h.id).eq('empresa_id', empresaId);
        } else {
          const { data, error } = await supabase.from('horarios_funcionamento').insert([payload]).select();
          if (error) throw error;
          if (data && data[0]) h.id = data[0].id;
        }
      }
      
      // Se tiver mais de uma filial, volta pra lista. Se for única, fecha o modal.
      if (filiais.length > 1) {
        setFilialSelecionada(null);
      } else {
        onClose();
      }
    } catch (error) {
      setErro('Erro ao salvar horários: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[#09090b] border border-[#27272a] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out]">

        {/* Header */}
        <div className="relative p-6 pb-0">
          {(!filialSelecionada || filiais.length === 1) && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Expediente</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                {filialSelecionada ? filialSelecionada.nome : 'Selecione a Filial'}
              </p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 pt-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {erro && <p className="text-red-500 text-[11px] font-medium text-center pb-2">{erro}</p>}

          {loading ? (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando...</p>
          ) : !filialSelecionada ? (
            /* Lista de Filiais (só aparece se tiver > 1) */
            <div className="space-y-2">
              {filiais.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-[#27272a] rounded-2xl">
                  <p className="text-zinc-600 text-xs italic">Nenhuma filial ativa encontrada.</p>
                </div>
              ) : (
                filiais.map(f => (
                  <button
                    key={f.id}
                    onClick={() => selecionarFilial(f)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#121212] border border-[#27272a] hover:border-[#CEAA6B]/30 transition-all text-left"
                  >
                    <span className="font-bold text-sm text-white">{f.nome}</span>
                    <svg className="text-zinc-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Formulário de 7 dias */
            <div className="space-y-3">
              {horarios.map((dia, idx) => (
                <div key={idx} className={`bg-[#121212] border ${dia.aberto ? 'border-[#CEAA6B]/30' : 'border-[#27272a]'} rounded-2xl p-4 transition-all`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-bold text-sm ${dia.aberto ? 'text-white' : 'text-zinc-500'}`}>
                      {DIAS_SEMANA[dia.dia_semana]}
                    </span>
                    <button
                      onClick={() => toggleAbertoDia(idx)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${dia.aberto ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${dia.aberto ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {dia.aberto && (
                    <div className="mt-3 pt-3 border-t border-[#27272a] space-y-3 animate-[fadeIn_0.2s_ease-out]">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Abertura</label>
                          <input
                            type="time"
                            value={dia.horario_inicio}
                            onChange={(e) => handleHorarioChange(idx, 'horario_inicio', e.target.value)}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Fechamento</label>
                          <input
                            type="time"
                            value={dia.horario_fim}
                            onChange={(e) => handleHorarioChange(idx, 'horario_fim', e.target.value)}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Início Pausa</label>
                          <input
                            type="time"
                            value={dia.intervalo_inicio}
                            onChange={(e) => handleHorarioChange(idx, 'intervalo_inicio', e.target.value)}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Fim Pausa</label>
                          <input
                            type="time"
                            value={dia.intervalo_fim}
                            onChange={(e) => handleHorarioChange(idx, 'intervalo_fim', e.target.value)}
                            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 space-y-2">
          {filialSelecionada ? (
            <div className="flex gap-2">
              {filiais.length > 1 && (
                <button
                  onClick={() => { setFilialSelecionada(null); setErro(''); }}
                  className="flex-1 py-3.5 rounded-xl border border-[#27272a] text-zinc-500 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors"
                >
                  Voltar
                </button>
              )}
              <button
                onClick={salvarHorarios}
                disabled={salvando}
                className="flex-1 py-3.5 rounded-xl bg-[#CEAA6B] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-opacity"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full bg-white text-black font-black py-4 rounded-[20px] uppercase tracking-[0.2em] text-[9px] active:scale-95 transition-all shadow-[0_8px_15px_rgba(255,255,255,0.1)]"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
