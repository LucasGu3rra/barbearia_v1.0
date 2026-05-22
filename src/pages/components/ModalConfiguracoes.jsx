/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

const DIAS_SEMANA = [
  { id: 0, label: 'Dom' }, { id: 1, label: 'Seg' }, { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }
];

export default function ModalConfiguracoes({ isOpen, onClose, onRefresh, onConfigChange, empresaId }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [totalFiliaisAtivas, setTotalFiliaisAtivas] = useState(0);
  const [totalBarbeirosAtivos, setTotalBarbeirosAtivos] = useState(0);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);

  // Estados do Expediente
  const [listaFiliais, setListaFiliais] = useState([]);
  const [filialSelecionada, setFilialSelecionada] = useState(''); 
  const [horariosOriginais, setHorariosOriginais] = useState([]);
  const [diasAtivos, setDiasAtivos] = useState([1, 2, 3, 4, 5]);
  const [padraoAbertura, setPadraoAbertura] = useState('08:00');
  const [padraoFechamento, setPadraoFechamento] = useState('19:00');
  const [padraoPausaInicio, setPadraoPausaInicio] = useState('');
  const [padraoPausaFim, setPadraoPausaFim] = useState('');

  const carregarDadosBase = useCallback(async () => {
    try {
      const [
        { count: countFiliais },
        { count: countBarbeiros },
        { data: config },
        { data: filiaisData }
      ] = await Promise.all([
        supabase.from('filiais').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('ativa', true),
        supabase.from('barbeiros').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('ativo', true),
        supabase.from('configuracoes').select('valor').eq('empresa_id', empresaId).eq('chave', 'fluxo_agendamento').maybeSingle(),
        supabase.from('filiais').select('id, nome').eq('empresa_id', empresaId).eq('ativa', true).order('nome'),
      ]);

      setTotalFiliaisAtivas(countFiliais || 0);
      setTotalBarbeirosAtivos(countBarbeiros || 0);
      
      const filiaisAtivas = filiaisData || [];
      setListaFiliais(filiaisAtivas);

      if (config?.valor) {
        setAgendamentoAtivo(config.valor.agendamento_ativo ?? false);
      }

      if (filiaisAtivas.length > 0) {
        setFilialSelecionada(filiaisAtivas[0].id);
      } else {
        setLoading(false);
      }
    } catch {
      setErro('Erro ao carregar configurações.');
      setLoading(false);
    }
  }, [empresaId]);

  const carregarExpediente = useCallback(async (filialId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('horarios_funcionamento')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('filial_id', filialId);
      if (error) throw error;
      setHorariosOriginais(data || []);

      if (data && data.length > 0) {
        const diaExemplo = data.find(d => d.aberto) || data[0];
        setPadraoAbertura(diaExemplo.horario_inicio ? diaExemplo.horario_inicio.substring(0, 5) : '08:00');
        setPadraoFechamento(diaExemplo.horario_fim ? diaExemplo.horario_fim.substring(0, 5) : '19:00');
        setPadraoPausaInicio(diaExemplo.intervalo_inicio ? diaExemplo.intervalo_inicio.substring(0, 5) : '');
        setPadraoPausaFim(diaExemplo.intervalo_fim ? diaExemplo.intervalo_fim.substring(0, 5) : '');
        setDiasAtivos(data.filter(d => d.aberto).map(d => d.dia_semana));
      } else {
        setDiasAtivos([1, 2, 3, 4, 5]);
        setPadraoAbertura('08:00');
        setPadraoFechamento('19:00');
        setPadraoPausaInicio('');
        setPadraoPausaFim('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (isOpen && empresaId) {
      setErro('');
      setSalvando(false);
      setLoading(true);
      setFilialSelecionada('');
      carregarDadosBase();
    }
  }, [isOpen, empresaId, carregarDadosBase]);

  useEffect(() => {
    if (filialSelecionada) {
      carregarExpediente(filialSelecionada);
    }
  }, [filialSelecionada, carregarExpediente]);

  // PONTE IMEDIATA: Atualiza na hora o Dashboard (Optimistic UI) 0ms de espera.
  const toggleAgendamento = async () => {
    const novoValor = !agendamentoAtivo;
    setAgendamentoAtivo(novoValor);
    
    // Grita pro AdminDashboard que mudou antes do banco salvar!
    if (onConfigChange) onConfigChange(novoValor);

    try {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          chave: 'fluxo_agendamento',
          empresa_id: empresaId,
          valor: { agendamento_ativo: novoValor },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'empresa_id,chave' });

      if (error) throw error;
      
      // Força recarregar os dados no background sem travar a tela
      if (onRefresh) onRefresh(); 
      
    } catch (e) {
      console.error(e);
      setAgendamentoAtivo(!novoValor);
      if (onConfigChange) onConfigChange(!novoValor); // Reverte se der erro na internet
      setErro('Erro ao ligar/desligar agendamento.');
    }
  };

  const toggleDia = (diaId) => {
    setDiasAtivos(prev => prev.includes(diaId) ? prev.filter(d => d !== diaId) : [...prev, diaId].sort());
  };

  const salvarTudo = async () => {
    setSalvando(true);
    setErro('');
    try {
      if (filialSelecionada) {
        for (let i = 0; i < 7; i++) {
          const isAberto = diasAtivos.includes(i);
          const payload = {
            filial_id: filialSelecionada,
            empresa_id: empresaId,
            dia_semana: i,
            aberto: isAberto,
            horario_inicio: isAberto && padraoAbertura ? `${padraoAbertura}:00` : null,
            horario_fim: isAberto && padraoFechamento ? `${padraoFechamento}:00` : null,
            intervalo_inicio: isAberto && padraoPausaInicio ? `${padraoPausaInicio}:00` : null,
            intervalo_fim: isAberto && padraoPausaFim ? `${padraoPausaFim}:00` : null,
          };
          
          const existente = horariosOriginais.find(h => h.dia_semana === i);
          if (existente) {
            await supabase.from('horarios_funcionamento').update(payload).eq('id', existente.id).eq('empresa_id', empresaId);
          } else {
            await supabase.from('horarios_funcionamento').insert([payload]);
          }
        }
      }
      if (onRefresh) onRefresh();
      onClose();
    } catch {
      setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const selecaoFilialAtiva = totalFiliaisAtivas > 1;
  const selecaoBarbeiroAtiva = totalBarbeirosAtivos > 1;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[#09090b] border border-[#27272a] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out]">
        <div className="relative p-6 pb-0">
          <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Jornada</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Fluxo e Expediente</p>
            </div>
          </div>
        </div>

        <div className="p-6 pt-2 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
          {erro && <p className="text-red-500 text-[11px] font-medium text-center">{erro}</p>}

          {loading ? (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando...</p>
          ) : (
            <>
              {/* CHAVE INSTANTÂNEA: Agendamento Online */}
              <div className="bg-[#121212] border border-[#27272a] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-white">Agendamento Online</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                      {agendamentoAtivo ? 'Clientes podem agendar pelo app.' : 'Agendamento pausado. Retirada de senha manual.'}
                    </p>
                  </div>
                  <button
                    onClick={toggleAgendamento}
                    className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${agendamentoAtivo ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${agendamentoAtivo ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#27272a]"></div>
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Expediente Padrão</span>
                <div className="flex-1 h-px bg-[#27272a]"></div>
              </div>

              {listaFiliais.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-[#27272a] rounded-2xl">
                  <p className="text-zinc-600 text-[10px] italic">Nenhuma filial ativa para configurar expediente.</p>
                </div>
              ) : (
                <div className="bg-[#121212] border border-[#27272a] rounded-2xl p-4 space-y-4">
                  {listaFiliais.length > 1 && (
                    <select
                      value={filialSelecionada}
                      onChange={(e) => setFilialSelecionada(e.target.value)}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#CEAA6B]/50 transition-colors appearance-none"
                    >
                      {listaFiliais.map(f => (
                        <option key={f.id} value={f.id} className="bg-[#09090b]">{f.nome}</option>
                      ))}
                    </select>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Abertura</label>
                      <input type="time" value={padraoAbertura} onChange={e => setPadraoAbertura(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Fechamento</label>
                      <input type="time" value={padraoFechamento} onChange={e => setPadraoFechamento(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Início Pausa</label>
                      <input type="time" value={padraoPausaInicio} onChange={e => setPadraoPausaInicio(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Fim Pausa</label>
                      <input type="time" value={padraoPausaFim} onChange={e => setPadraoPausaFim(e.target.value)} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#CEAA6B]/50 transition-colors" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Dias de Funcionamento</label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                      {DIAS_SEMANA.map(dia => {
                        const ativo = diasAtivos.includes(dia.id);
                        return (
                          <button
                            key={dia.id}
                            onClick={() => toggleDia(dia.id)}
                            className={`flex-1 min-w-[38px] py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                              ativo ? 'bg-[#CEAA6B] text-black shadow-[0_0_10px_rgba(206,170,107,0.2)]' : 'bg-[#09090b] border border-[#27272a] text-zinc-600 hover:border-[#CEAA6B]/30'
                            }`}
                          >
                            {dia.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#27272a]"></div>
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Automático</span>
                <div className="flex-1 h-px bg-[#27272a]"></div>
              </div>

              <div className={`bg-[#121212] border rounded-2xl p-4 ${selecaoFilialAtiva ? 'border-[#CEAA6B]/30' : 'border-[#27272a]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm text-white">Seleção de Filial</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${selecaoFilialAtiva ? 'bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'bg-[#27272a] text-zinc-500'}`}>
                        {selecaoFilialAtiva ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      {selecaoFilialAtiva ? `${totalFiliaisAtivas} filiais ativas — o cliente escolherá a unidade.` : `${totalFiliaisAtivas} filial ativa — etapa ignorada.`}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`bg-[#121212] border rounded-2xl p-4 ${selecaoBarbeiroAtiva ? 'border-[#CEAA6B]/30' : 'border-[#27272a]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm text-white">Seleção de Barbeiro</p>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${selecaoBarbeiroAtiva ? 'bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'bg-[#27272a] text-zinc-500'}`}>
                        {selecaoBarbeiroAtiva ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      {selecaoBarbeiroAtiva ? `${totalBarbeirosAtivos} barbeiros ativos — o cliente escolherá.` : `${totalBarbeirosAtivos} barbeiro ativo — etapa ignorada.`}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 pt-0 mt-2">
          <button
            onClick={salvarTudo}
            disabled={salvando || loading}
            className="w-full bg-[#CEAA6B] text-black font-black py-4 rounded-[20px] uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-[0_8px_15px_rgba(206,170,107,0.1)] disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar Expediente'}
          </button>
        </div>
      </div>
    </div>
  );
}
