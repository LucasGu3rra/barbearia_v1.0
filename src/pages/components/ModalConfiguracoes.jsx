import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

export default function ModalConfiguracoes({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Dados do banco para exibição automática
  const [totalFiliaisAtivas, setTotalFiliaisAtivas] = useState(0);
  const [totalBarbeirosAtivos, setTotalBarbeirosAtivos] = useState(0);

  // Configuração de agendamento
  const [agendamentoAtivo, setAgendamentoAtivo] = useState(false);

  useEffect(() => {
    if (isOpen) carregarDados();
  }, [isOpen]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [
        { count: countFiliais },
        { count: countBarbeiros },
        { data: config },
      ] = await Promise.all([
        supabase.from('filiais').select('id', { count: 'exact', head: true }).eq('ativa', true),
        supabase.from('barbeiros').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('configuracoes').select('valor').eq('chave', 'fluxo_agendamento').single(),
      ]);

      setTotalFiliaisAtivas(countFiliais || 0);
      setTotalBarbeirosAtivos(countBarbeiros || 0);

      if (config?.valor) {
        setAgendamentoAtivo(config.valor.agendamento_ativo ?? false);
      }
    } catch (e) {
      console.error('Erro ao carregar configurações:', e);
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracoes = async (novoValorAgendamento) => {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          chave: 'fluxo_agendamento',
          valor: {
            agendamento_ativo: novoValorAgendamento,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chave' });

      if (!error) {
        setAgendamentoAtivo(novoValorAgendamento);
      }
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAgendamento = () => {
    const novoValor = !agendamentoAtivo;
    salvarConfiguracoes(novoValor);
  };

  // Lógica automática: derivada do banco, sem toggle manual
  const selecaoFilialAtiva = totalFiliaisAtivas > 1;
  const selecaoBarbeiroAtiva = totalBarbeirosAtivos > 1;

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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Configurações</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Fluxo de Agendamento</p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-6 pt-2 space-y-3">
          {loading ? (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando...</p>
          ) : (
            <>
              {/* Switch principal: Agendamento Online */}
              <div className="bg-[#121212] border border-[#27272a] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-white">Agendamento Online</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                      {agendamentoAtivo
                        ? 'Clientes podem agendar pelo app.'
                        : 'Agendamento desativado. Clientes registram corte na hora.'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleAgendamento}
                    disabled={salvando}
                    className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${agendamentoAtivo ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}
                  >
                    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${agendamentoAtivo ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Divisor */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#27272a]"></div>
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Automático</span>
                <div className="flex-1 h-px bg-[#27272a]"></div>
              </div>

              {/* Card: Seleção de Filial */}
              <div className={`bg-[#121212] border rounded-2xl p-4 ${selecaoFilialAtiva ? 'border-[#CEAA6B]/30' : 'border-[#27272a]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm text-white">Seleção de Filial</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${selecaoFilialAtiva ? 'bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'bg-[#27272a] text-zinc-500'}`}>
                        {selecaoFilialAtiva ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      {selecaoFilialAtiva
                        ? `${totalFiliaisAtivas} filiais ativas — o cliente escolherá a unidade.`
                        : `${totalFiliaisAtivas} filial ativa — etapa de seleção ignorada.`}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${selecaoFilialAtiva ? 'bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'bg-[#27272a] text-zinc-600'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                  </div>
                </div>
                <p className="text-[9px] text-zinc-600 mt-2 italic">
                  Ativado automaticamente quando há mais de 1 filial ativa.
                </p>
              </div>

              {/* Card: Seleção de Barbeiro */}
              <div className={`bg-[#121212] border rounded-2xl p-4 ${selecaoBarbeiroAtiva ? 'border-[#CEAA6B]/30' : 'border-[#27272a]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm text-white">Seleção de Barbeiro</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${selecaoBarbeiroAtiva ? 'bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'bg-[#27272a] text-zinc-500'}`}>
                        {selecaoBarbeiroAtiva ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      {selecaoBarbeiroAtiva
                        ? `${totalBarbeirosAtivos} barbeiros ativos — o cliente escolherá o profissional.`
                        : `${totalBarbeirosAtivos} barbeiro ativo — etapa de seleção ignorada.`}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${selecaoBarbeiroAtiva ? 'bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'bg-[#27272a] text-zinc-600'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </div>
                </div>
                <p className="text-[9px] text-zinc-600 mt-2 italic">
                  Ativado automaticamente quando há mais de 1 barbeiro ativo.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
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