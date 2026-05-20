import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const gerarHorarios = () => {
  const h = [];
  for (let i = 8; i < 19; i++) {
    h.push(`${String(i).padStart(2, '0')}:00`);
    h.push(`${String(i).padStart(2, '0')}:30`);
  }
  return h;
};

const gerarProximosDias = () => {
  const dias = [];
  const hoje = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    dias.push(d);
  }
  return dias;
};

const HORARIOS = gerarHorarios();
const DIAS = gerarProximosDias();

// Seção cascata individual
function Secao({ titulo, concluido, ativo, children, onEditar }) {
  return (
    <div className={`rounded-[20px] border transition-all duration-300 overflow-hidden ${ativo ? 'border-[#CEAA6B]/40 bg-[#121212]' : concluido ? 'border-[#27272a] bg-[#0d0d0d]' : 'border-[#1f1f1f] bg-[#0a0a0a] opacity-40'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${concluido ? 'bg-[#CEAA6B]' : ativo ? 'border-2 border-[#CEAA6B]' : 'border border-[#27272a]'}`}>
            {concluido && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            )}
          </div>
          <span className={`text-[11px] font-black uppercase tracking-widest ${ativo ? 'text-white' : concluido ? 'text-zinc-400' : 'text-zinc-700'}`}>{titulo}</span>
        </div>
        {concluido && !ativo && (
          <button onClick={onEditar} className="text-[9px] text-[#CEAA6B] font-bold uppercase tracking-widest hover:underline">Editar</button>
        )}
      </div>
      {ativo && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function ModalAgendamento({ isOpen, onClose, clienteId, clienteNome, tipoCliente }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Dados do banco
  const [filiais, setFiliais] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [melhorPlano, setMelhorPlano] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Seleções
  const [filialSelecionada, setFilialSelecionada] = useState(null);
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState(null);
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState(null);

  // Controle de qual seção está ativa
  const [etapaAtiva, setEtapaAtiva] = useState(null);

  const scrollRef = useRef(null);

  // Lógica de etapas
  const exibirFilial = filiais.length > 1;
  const exibirBarbeiro = barbeiros.length > 1;

  const etapas = (() => {
    const lista = [];
    if (exibirFilial) lista.push('filial');
    lista.push('servico');
    lista.push('data');
    if (exibirBarbeiro) lista.push('barbeiro');
    lista.push('confirmacao');
    return lista;
  })();

  const proximaEtapa = (atual) => {
    const idx = etapas.indexOf(atual);
    return idx < etapas.length - 1 ? etapas[idx + 1] : null;
  };

  const etapaConcluida = (etapa) => {
    if (etapa === 'filial') return !!filialSelecionada;
    if (etapa === 'servico') return !!servicoSelecionado;
    if (etapa === 'data') return !!(dataSelecionada && horarioSelecionado);
    if (etapa === 'barbeiro') return !!barbeiroSelecionado;
    return false;
  };

  const barbeirosFiltrados = filialSelecionada
    ? barbeiros.filter(b => b.filial_id === filialSelecionada.id)
    : barbeiros;

  useEffect(() => {
    if (isOpen) {
      setFilialSelecionada(null);
      setServicoSelecionado(null);
      setDataSelecionada(null);
      setHorarioSelecionado(null);
      setBarbeiroSelecionado(null);
      setErro('');
      carregarDados();
    }
  }, [isOpen]);

  // Scroll suave quando nova seção abre
  useEffect(() => {
    if (etapaAtiva && scrollRef.current) {
      setTimeout(() => {
        const el = scrollRef.current?.querySelector(`[data-etapa="${etapaAtiva}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [etapaAtiva]);

  const carregarDados = async () => {
    setCarregando(true);
    const [
      { data: fils },
      { data: barbs },
      { data: servs },
      { data: planos },
    ] = await Promise.all([
      supabase.from('filiais').select('*').eq('ativa', true),
      supabase.from('barbeiros').select('*').eq('ativo', true),
      supabase.from('servicos').select('*').eq('ativo', true).order('created_at', { ascending: true }),
      supabase.from('planos').select('*').eq('ativo', true),
    ]);

    const listaFiliais = fils || [];
    const listaBarbeiros = barbs || [];
    setFiliais(listaFiliais);
    setBarbeiros(listaBarbeiros);
    setServicos(servs || []);

    if (planos?.length > 0) {
      setMelhorPlano(planos.reduce((a, b) => a.preco < b.preco ? a : b));
    }

    // Define a primeira etapa ativa
    const primeiraEtapa = listaFiliais.length > 1 ? 'filial' : 'servico';

    // Auto-seleciona filial se só tiver 1
    if (listaFiliais.length === 1) setFilialSelecionada(listaFiliais[0]);

    setEtapaAtiva(primeiraEtapa);
    setCarregando(false);
  };

  const avancarEtapa = (etapaAtual) => {
    const prox = proximaEtapa(etapaAtual);
    if (prox) setEtapaAtiva(prox);
  };

  const confirmarAgendamento = async () => {
    setSalvando(true);
    setErro('');
    try {
      let dataHora = null;
      if (dataSelecionada && horarioSelecionado) {
        const [h, m] = horarioSelecionado.split(':');
        const d = new Date(dataSelecionada);
        d.setHours(parseInt(h), parseInt(m), 0, 0);
        dataHora = d.toISOString();
      }

      const { error } = await supabase.from('agendamentos').insert([{
        cliente_id: clienteId,
        filial_id: filialSelecionada?.id || null,
        servico_id: servicoSelecionado?.id || null,
        barbeiro_id: barbeiroSelecionado?.id || null,
        data_hora: dataHora,
        tipo_cliente: tipoCliente,
        status: 'agendado',
      }]);

      if (error) throw error;
      onClose({ sucesso: true });
    } catch (e) {
      setErro('Erro ao confirmar. Tente novamente.');
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  const formatarData = (d) => {
    if (!d) return '';
    return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  };

  const todasEtapasConcluidas = etapas
    .filter(e => e !== 'confirmacao')
    .every(e => etapaConcluida(e));

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-end justify-center">
      <div className="bg-[#09090b] w-full max-w-sm rounded-t-[32px] flex flex-col shadow-2xl animate-[slideUp_0.3s_ease-out]" style={{ maxHeight: '92vh' }}>

        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <h3 className="text-lg font-black text-white">Agendar Serviço</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Escolha as opções abaixo</p>
          </div>
          <button onClick={() => onClose(null)} className="w-9 h-9 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-6 space-y-3">
          {carregando ? (
            <div className="py-10 text-center text-zinc-600 text-xs">Carregando...</div>
          ) : (
            <>
              {/* SEÇÃO: FILIAL */}
              {exibirFilial && (
                <div data-etapa="filial">
                  <Secao
                    titulo="Filial"
                    ativo={etapaAtiva === 'filial'}
                    concluido={etapaConcluida('filial')}
                    onEditar={() => setEtapaAtiva('filial')}
                  >
                    {etapaConcluida('filial') && etapaAtiva !== 'filial' ? (
                      <p className="text-sm font-bold text-[#CEAA6B] px-1 pb-1">{filialSelecionada?.nome}</p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {filiais.map(f => (
                          <button key={f.id} onClick={() => { setFilialSelecionada(f); avancarEtapa('filial'); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${filialSelecionada?.id === f.id ? 'border-[#CEAA6B] bg-[#CEAA6B]/5' : 'border-[#27272a] hover:border-[#CEAA6B]/30'}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${filialSelecionada?.id === f.id ? 'bg-[#CEAA6B] text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-white">{f.nome}</p>
                              {f.endereco && <p className="text-[10px] text-zinc-500">{f.endereco}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </Secao>
                </div>
              )}

              {/* SEÇÃO: SERVIÇO */}
              {(!exibirFilial || etapaConcluida('filial')) && (
                <div data-etapa="servico">
                  <Secao
                    titulo="Serviço"
                    ativo={etapaAtiva === 'servico'}
                    concluido={etapaConcluida('servico')}
                    onEditar={() => { setServicoSelecionado(null); setDataSelecionada(null); setHorarioSelecionado(null); setBarbeiroSelecionado(null); setEtapaAtiva('servico'); }}
                  >
                    {etapaConcluida('servico') && etapaAtiva !== 'servico' ? (
                      <div className="flex justify-between items-center px-1 pb-1">
                        <p className="text-sm font-bold text-[#CEAA6B]">{servicoSelecionado?.nome}</p>
                        {tipoCliente === 'avulso' && <p className="text-sm font-black text-white">R$ {Number(servicoSelecionado?.preco).toFixed(0)}</p>}
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {servicos.map(s => (
                          <button key={s.id} onClick={() => { setServicoSelecionado(s); avancarEtapa('servico'); }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${servicoSelecionado?.id === s.id ? 'border-[#CEAA6B] bg-[#CEAA6B]/5' : 'border-[#27272a] hover:border-[#CEAA6B]/30'}`}>
                            <div className="text-left">
                              <p className="font-bold text-sm text-white">{s.nome}</p>
                              <p className="text-[10px] text-zinc-500">{s.duracao_minutos} min</p>
                            </div>
                            {tipoCliente === 'avulso' && (
                              <p className="text-[#CEAA6B] font-black text-base">R$ {Number(s.preco).toFixed(0)}</p>
                            )}
                          </button>
                        ))}

                        {/* Banner de plano para avulso */}
                        {tipoCliente === 'avulso' && melhorPlano && (
                          <div className="bg-[#0f0a05] border border-[#CEAA6B]/15 rounded-xl p-3 mt-1">
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                              💡 Com o <span className="text-[#CEAA6B] font-bold">Plano {melhorPlano.nome}</span> por{' '}
                              <span className="text-[#CEAA6B] font-bold">R$ {Number(melhorPlano.preco).toFixed(0)}/mês</span> você economiza muito mais do que pagando avulso.
                            </p>
                            <button onClick={() => onClose({ irParaPlanos: true })} className="mt-1.5 text-[#CEAA6B] text-[9px] font-black uppercase tracking-widest underline underline-offset-2">
                              Ver planos →
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Secao>
                </div>
              )}

              {/* SEÇÃO: DATA E HORA */}
              {etapaConcluida('servico') && (
                <div data-etapa="data">
                  <Secao
                    titulo="Data e Horário"
                    ativo={etapaAtiva === 'data'}
                    concluido={etapaConcluida('data')}
                    onEditar={() => { setDataSelecionada(null); setHorarioSelecionado(null); setBarbeiroSelecionado(null); setEtapaAtiva('data'); }}
                  >
                    {etapaConcluida('data') && etapaAtiva !== 'data' ? (
                      <p className="text-sm font-bold text-[#CEAA6B] px-1 pb-1">{formatarData(dataSelecionada)} às {horarioSelecionado}</p>
                    ) : (
                      <div className="space-y-4 pt-1">
                        {/* Dias */}
                        <div>
                          <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Dia</p>
                          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                            {DIAS.map((d, i) => {
                              const sel = dataSelecionada?.toDateString() === d.toDateString();
                              return (
                                <button key={i} onClick={() => { setDataSelecionada(d); setHorarioSelecionado(null); }}
                                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border transition-all min-w-[48px] ${sel ? 'border-[#CEAA6B] bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'border-[#27272a] text-zinc-500 hover:border-[#CEAA6B]/30'}`}>
                                  <span className="text-[8px] font-bold uppercase">{i === 0 ? 'Hoje' : DIAS_SEMANA[d.getDay()]}</span>
                                  <span className="text-base font-black leading-tight">{d.getDate()}</span>
                                  <span className="text-[8px] uppercase">{MESES[d.getMonth()]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Horários */}
                        {dataSelecionada && (
                          <div>
                            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Horário</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {HORARIOS.map(h => (
                                <button key={h} onClick={() => { setHorarioSelecionado(h); avancarEtapa('data'); }}
                                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${horarioSelecionado === h ? 'border-[#CEAA6B] bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'border-[#27272a] text-zinc-500 hover:border-[#CEAA6B]/30'}`}>
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Secao>
                </div>
              )}

              {/* SEÇÃO: BARBEIRO */}
              {exibirBarbeiro && etapaConcluida('data') && (
                <div data-etapa="barbeiro">
                  <Secao
                    titulo="Barbeiro"
                    ativo={etapaAtiva === 'barbeiro'}
                    concluido={etapaConcluida('barbeiro')}
                    onEditar={() => { setBarbeiroSelecionado(null); setEtapaAtiva('barbeiro'); }}
                  >
                    {etapaConcluida('barbeiro') && etapaAtiva !== 'barbeiro' ? (
                      <p className="text-sm font-bold text-[#CEAA6B] px-1 pb-1">{barbeiroSelecionado?.nome}</p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {(barbeirosFiltrados.length > 0 ? barbeirosFiltrados : barbeiros).map(b => (
                          <button key={b.id} onClick={() => { setBarbeiroSelecionado(b); avancarEtapa('barbeiro'); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${barbeiroSelecionado?.id === b.id ? 'border-[#CEAA6B] bg-[#CEAA6B]/5' : 'border-[#27272a] hover:border-[#CEAA6B]/30'}`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${barbeiroSelecionado?.id === b.id ? 'bg-[#CEAA6B] text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                              {b.nome.substring(0, 2).toUpperCase()}
                            </div>
                            <p className="font-bold text-sm text-white">{b.nome}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </Secao>
                </div>
              )}

              {/* SEÇÃO: CONFIRMAÇÃO */}
              {todasEtapasConcluidas && (
                <div data-etapa="confirmacao">
                  <div className="bg-[#121212] border border-[#27272a] rounded-[20px] p-4 space-y-3">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Resumo do agendamento</p>

                    {filialSelecionada && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500">Filial</span>
                        <span className="text-sm font-bold text-white">{filialSelecionada.nome}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500">Serviço</span>
                      <span className="text-sm font-bold text-white">{servicoSelecionado?.nome}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500">Data e Hora</span>
                      <span className="text-sm font-bold text-white">{formatarData(dataSelecionada)} às {horarioSelecionado}</span>
                    </div>
                    {barbeiroSelecionado && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500">Barbeiro</span>
                        <span className="text-sm font-bold text-white">{barbeiroSelecionado.nome}</span>
                      </div>
                    )}
                    {tipoCliente === 'avulso' && (
                      <div className="flex justify-between items-center pt-2 border-t border-[#27272a]">
                        <span className="text-[10px] text-zinc-500">Valor</span>
                        <span className="text-base font-black text-[#CEAA6B]">R$ {Number(servicoSelecionado?.preco).toFixed(0)}</span>
                      </div>
                    )}
                  </div>

                  {tipoCliente === 'avulso' && (
                    <div className="bg-[#0f0a05] border border-[#CEAA6B]/15 rounded-[16px] p-3 mt-3">
                      <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                        💳 Pagamento <span className="text-[#CEAA6B] font-bold">presencialmente na barbearia</span> no dia do atendimento.
                      </p>
                    </div>
                  )}

                  {erro && <p className="text-red-500 text-xs font-medium text-center mt-2">{erro}</p>}

                  <button
                    onClick={confirmarAgendamento}
                    disabled={salvando}
                    className="w-full bg-[#CEAA6B] text-black font-black py-4 rounded-[20px] uppercase tracking-[0.15em] text-[10px] active:scale-95 transition-all disabled:opacity-60 mt-3"
                  >
                    {salvando ? 'Confirmando...' : 'Confirmar Agendamento'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Botão cancelar fixo no rodapé */}
        <div className="px-5 pb-6 pt-2 flex-shrink-0">
          <button onClick={() => onClose(null)} className="w-full text-zinc-600 font-bold py-2 text-[10px] uppercase tracking-widest hover:text-zinc-400 transition-colors">
            Cancelar
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }` }} />
    </div>
  );
}
