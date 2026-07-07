/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';
import { notificarAgendamento } from '../../services/notifications';
import ClienteAgendamentoStepBar from './clientes/ClienteAgendamentoStepBar';

const CANCELAMENTO_ARREPENDIMENTO_MINUTOS = 5;
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const gerarProximosDias = (quantidadeDias = 28) => {
  const dias = [];
  const hoje = new Date();
  for (let i = 0; i < quantidadeDias; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    dias.push(d);
  }
  return dias;
};

const mesmaData = (a, b) => a && b && a.toDateString() === b.toDateString();

const horarioParaMinutos = (horario) => {
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
};

const criarDataHora = (data, horario) => {
  const [h, m] = horario.split(':');
  const dataHora = new Date(data);
  dataHora.setHours(Number(h), Number(m), 0, 0);
  return dataHora;
};

const intervalosSobrepoem = (inicioA, duracaoA, inicioB, duracaoB) => {
  const fimA = new Date(inicioA.getTime() + duracaoA * 60000);
  const fimB = new Date(inicioB.getTime() + duracaoB * 60000);
  return inicioA < fimB && inicioB < fimA;
};

const horarioCabeNoFuncionamento = (horario, duracao, regra) => {
  if (!regra?.horario_inicio || !regra?.horario_fim) return false;

  const inicioMin = horarioParaMinutos(horario);
  const aberturaMin = horarioParaMinutos(regra.horario_inicio.substring(0, 5));
  const fechamentoMin = horarioParaMinutos(regra.horario_fim.substring(0, 5));

  if (inicioMin < aberturaMin || inicioMin >= fechamentoMin) return false;

  if (regra.intervalo_inicio && regra.intervalo_fim) {
    const pausaInicioMin = horarioParaMinutos(regra.intervalo_inicio.substring(0, 5));
    const pausaFimMin = horarioParaMinutos(regra.intervalo_fim.substring(0, 5));
    if (inicioMin >= pausaInicioMin && inicioMin < pausaFimMin) return false;
  }

  return true;
};

const gerarHorarios = (inicio = '08:00', fim = '19:00', pausaInicio = null, pausaFim = null, data = null) => {
  const horarios = [];
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  const inicioMin = hi * 60 + mi;
  const fimMin = hf * 60 + mf;
  const pausaIniMin = pausaInicio ? pausaInicio.split(':').map(Number).reduce((h, m) => h * 60 + m) : null;
  const pausaFimMin = pausaFim ? pausaFim.split(':').map(Number).reduce((h, m) => h * 60 + m) : null;
  const agora = new Date();
  const mesmoDia = data && data.toDateString() === agora.toDateString();

  for (let min = inicioMin; min < fimMin; min += 30) {
    if (pausaIniMin !== null && pausaFimMin !== null && min >= pausaIniMin && min < pausaFimMin) continue;
    if (mesmoDia && min <= agora.getHours() * 60 + agora.getMinutes()) continue;
    horarios.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
  }

  return horarios;
};

function Icon({ name, className = '' }) {
  const icons = {
    arrow: <path d="m15 18-6-6 6-6" />,
    check: <path d="M20 6 9 17l-5-5" />,
    scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9" /><path d="M14.5 14.5 20 20" /><path d="M8.1 8.1 12 12" /></>,
    tool: <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17v3h3l5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.8-2.8 2.2-2.6z" />,
    stars: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };

  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.scissors}
    </svg>
  );
}

export default function ModalAgendamento({
  isOpen,
  onClose,
  clienteId,
  tipoCliente,
  empresaId,
  planoCliente = null,
  servicoInicialId = null,
  voltarParaServicosAoVoltar = false,
  prazoCancelamentoMinutos = 120,
}) {
  const [step, setStep] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [servicoPreSelecionado, setServicoPreSelecionado] = useState(false);
  const [instanteAvisoCancelamento, setInstanteAvisoCancelamento] = useState(null);

  const [filiais, setFiliais] = useState([]);
  const [barbeiros, setBarbeiros] = useState([]);
  const [horariosFuncionamento, setHorariosFuncionamento] = useState([]);

  const [filialSelecionada, setFilialSelecionada] = useState(null);
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState(null);
  const [barbeiroSelecionado, setBarbeiroSelecionado] = useState(null);
  const [agendamentosOcupados, setAgendamentosOcupados] = useState([]);

  const isAssinante = tipoCliente === 'assinante';
  const duracaoServico = Number((isAssinante && planoCliente?.duracaoMinutos) || servicoSelecionado?.duracao_minutos || 30);
  const dataHoraSelecionada = dataSelecionada && horarioSelecionado ? criarDataHora(dataSelecionada, horarioSelecionado) : null;
  const agendamentoDentroPrazoCancelamento = Boolean(
    isAssinante
    && dataHoraSelecionada
    && instanteAvisoCancelamento
    && instanteAvisoCancelamento > dataHoraSelecionada.getTime() - Number(prazoCancelamentoMinutos || 0) * 60000
  );
  const horarioLimiteArrependimento = useMemo(() => {
    if (!dataHoraSelecionada || !instanteAvisoCancelamento) return '';
    const limite = new Date(Math.min(
      instanteAvisoCancelamento + CANCELAMENTO_ARREPENDIMENTO_MINUTOS * 60000,
      dataHoraSelecionada.getTime()
    ));
    return limite.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }, [dataHoraSelecionada, instanteAvisoCancelamento]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    const [{ data: fils }, { data: servs }, { data: barbs }, { data: horarios }] = await Promise.all([
      supabase.from('filiais').select('*').eq('empresa_id', empresaId).eq('ativa', true),
      supabase.from('servicos').select('*, servico_categorias(nome), servico_subcategorias(nome)').eq('empresa_id', empresaId).eq('ativo', true).is('deleted_at', null).order('created_at', { ascending: true }),
      supabase.from('barbeiros').select('*').eq('empresa_id', empresaId).eq('ativo', true),
      supabase.from('horarios_funcionamento').select('*').eq('empresa_id', empresaId),
    ]);

    const listaFiliais = fils || [];
    const listaServicos = servs || [];
    const listaBarbeiros = barbs || [];
    const servicoInicial = servicoInicialId
      ? listaServicos.find(servico => servico.id === servicoInicialId)
      : null;
    const planoInicial = isAssinante && planoCliente?.planoUuid
      ? {
        id: planoCliente.planoUuid,
        nome: planoCliente.planoNome || 'Plano',
        preco: 0,
        duracao_minutos: Number(planoCliente.duracaoMinutos || 30),
      }
      : null;
    setFiliais(listaFiliais);
    setBarbeiros(listaBarbeiros);
    setHorariosFuncionamento(horarios || []);
    setFilialSelecionada(listaFiliais[0] || null);
    setBarbeiroSelecionado(null);
    const servicoPadrao = planoInicial || servicoInicial || null;
    setServicoSelecionado(servicoPadrao);
    setServicoPreSelecionado(Boolean(servicoPadrao));
    setErro(servicoPadrao ? '' : 'Selecione um servico antes de agendar.');
    setStep(servicoPadrao ? 2 : 0);
    setCarregando(false);
  }, [empresaId, isAssinante, planoCliente, servicoInicialId]);

  useEffect(() => {
    if (!isOpen || !empresaId) return;

    setStep(0);
    setErro('');
    setConfirmado(false);
    setServicoSelecionado(null);
    setServicoPreSelecionado(false);
    setInstanteAvisoCancelamento(null);
    setDataSelecionada(null);
    setHorarioSelecionado(null);
    setBarbeiroSelecionado(null);
    carregarDados();
  }, [isOpen, empresaId, carregarDados]);

  const regraFuncionamentoDoDia = useCallback((data) => {
    if (!data) return null;
    const filialId = filialSelecionada?.id || filiais[0]?.id;
    return horariosFuncionamento.find(h => h.filial_id === filialId && h.dia_semana === data.getDay()) || null;
  }, [filialSelecionada, filiais, horariosFuncionamento]);

  const datasDisponiveis = useMemo(() => gerarProximosDias()
    .filter((data) => {
      const regra = regraFuncionamentoDoDia(data);
      if (!regra?.aberto || !regra.horario_inicio || !regra.horario_fim) return false;
      return gerarHorarios(
        regra.horario_inicio.substring(0, 5),
        regra.horario_fim.substring(0, 5),
        regra.intervalo_inicio?.substring(0, 5),
        regra.intervalo_fim?.substring(0, 5),
        data
      ).some(horario => horarioCabeNoFuncionamento(horario, duracaoServico, regra));
    })
    .slice(0, 7), [duracaoServico, regraFuncionamentoDoDia]);

  useEffect(() => {
    if (!dataSelecionada) return;
    const dataAindaDisponivel = datasDisponiveis.some(data => mesmaData(data, dataSelecionada));
    if (!dataAindaDisponivel) {
      setDataSelecionada(null);
      setHorarioSelecionado(null);
    }
  }, [dataSelecionada, datasDisponiveis]);

  const horariosDoDia = useMemo(() => {
    if (!dataSelecionada) return [];
    const regra = regraFuncionamentoDoDia(dataSelecionada);
    if (!regra?.aberto || !regra.horario_inicio || !regra.horario_fim) return [];

    return gerarHorarios(
      regra.horario_inicio.substring(0, 5),
      regra.horario_fim.substring(0, 5),
      regra.intervalo_inicio?.substring(0, 5),
      regra.intervalo_fim?.substring(0, 5),
      dataSelecionada
    ).filter(horario => horarioCabeNoFuncionamento(horario, duracaoServico, regra));
  }, [dataSelecionada, duracaoServico, regraFuncionamentoDoDia]);

  const barbeirosDaFilial = useMemo(() => {
    if (!filialSelecionada?.id) return barbeiros;
    return barbeiros.filter(barbeiro => barbeiro.filial_id === filialSelecionada.id);
  }, [barbeiros, filialSelecionada]);

  useEffect(() => {
    if (!isOpen || !empresaId || !filialSelecionada?.id || !dataSelecionada) {
      setAgendamentosOcupados([]);
      return;
    }

    let cancelado = false;

    const carregarHorariosOcupados = async () => {
      const inicioDia = new Date(dataSelecionada);
      inicioDia.setHours(0, 0, 0, 0);
      const fimDia = new Date(dataSelecionada);
      fimDia.setHours(23, 59, 59, 999);

      const { data, error } = await supabase.rpc('agendamentos_ocupados_dia', {
        p_empresa_id: empresaId,
        p_filial_id: filialSelecionada.id,
        p_inicio: inicioDia.toISOString(),
        p_fim: fimDia.toISOString(),
      });

      if (cancelado) return;

      if (error) {
        console.error(error);
        setAgendamentosOcupados([]);
        return;
      }

      setAgendamentosOcupados(data || []);
    };

    carregarHorariosOcupados();

    return () => {
      cancelado = true;
    };
  }, [dataSelecionada, empresaId, filialSelecionada, isOpen]);

  const barbeiroDisponivelNoHorario = useCallback((barbeiroId, dataHora, duracao) => {
    return !agendamentosOcupados.some((agendamento) => {
      if (agendamento.barbeiro_id !== barbeiroId) return false;
      return intervalosSobrepoem(
        new Date(agendamento.data_hora),
        Number(agendamento.duracao_minutos || 30),
        dataHora,
        duracao
      );
    });
  }, [agendamentosOcupados]);

  const horariosIndisponiveis = useMemo(() => {
    if (!dataSelecionada || !servicoSelecionado) return new Set();

    const indisponiveis = new Set();

    horariosDoDia.forEach((horario) => {
      const dataHora = criarDataHora(dataSelecionada, horario);

      if (barbeiroSelecionado?.id) {
        if (!barbeiroDisponivelNoHorario(barbeiroSelecionado.id, dataHora, duracaoServico)) {
          indisponiveis.add(horario);
        }
        return;
      }

      const algumBarbeiroLivre = barbeirosDaFilial.some((barbeiro) =>
        barbeiroDisponivelNoHorario(barbeiro.id, dataHora, duracaoServico)
      );

      if (!algumBarbeiroLivre) indisponiveis.add(horario);
    });

    return indisponiveis;
  }, [barbeiroDisponivelNoHorario, barbeiroSelecionado, barbeirosDaFilial, dataSelecionada, duracaoServico, horariosDoDia, servicoSelecionado]);

  useEffect(() => {
    if (horarioSelecionado && horariosIndisponiveis.has(horarioSelecionado)) {
      setHorarioSelecionado(null);
    }
  }, [horarioSelecionado, horariosIndisponiveis]);

  useEffect(() => {
    if (!isOpen || step !== 3) return;
    if (barbeirosDaFilial.length === 1) {
      setBarbeiroSelecionado(barbeirosDaFilial[0]);
    }
  }, [barbeirosDaFilial, isOpen, step]);

  if (!isOpen) return null;

  const fechar = () => onClose(confirmado ? { sucesso: true } : null);
  const prevStep = () => {
    if (step <= 1) fechar();
    else if (step === 2 && servicoPreSelecionado) {
      onClose(!isAssinante && voltarParaServicosAoVoltar ? { voltarParaServicos: true } : null);
    }
    else setStep(s => s - 1);
  };

  const verificarConflitoAgendamento = async (dataHora) => {
    if (barbeiroSelecionado?.id && !barbeiroDisponivelNoHorario(barbeiroSelecionado.id, dataHora, duracaoServico)) {
      throw new Error('Esse barbeiro ja possui agendamento neste horario.');
    }

    if (!barbeiroSelecionado?.id) {
      const algumBarbeiroLivre = barbeirosDaFilial.some((barbeiro) =>
        barbeiroDisponivelNoHorario(barbeiro.id, dataHora, duracaoServico)
      );

      if (!algumBarbeiroLivre) throw new Error('Esse horario nao esta mais disponivel.');
    }
  };

  const obterBarbeiroDisponivel = async (dataHora) => {
    if (barbeiroSelecionado?.id) return barbeiroSelecionado.id;

    const barbeiroLivre = barbeirosDaFilial.find((barbeiro) =>
      barbeiroDisponivelNoHorario(barbeiro.id, dataHora, duracaoServico)
    );

    if (!barbeiroLivre) {
      throw new Error('Esse horario nao esta mais disponivel.');
    }

    return barbeiroLivre.id;
  };

  const irParaConfirmacaoAgendamento = () => {
    setInstanteAvisoCancelamento(Date.now());
    setStep(4);
  };

  const confirmarAgendamento = async () => {
    if (salvando) return;
    setErro('');
    setSalvando(true);
    try {
      if (!clienteId || !empresaId) {
        throw new Error('Sessao invalida. Entre novamente pelo link da barbearia.');
      }

      if (!filialSelecionada || !servicoSelecionado || !dataSelecionada || !horarioSelecionado) {
        throw new Error('Selecione serviço, data e horário.');
      }

      const dataHora = criarDataHora(dataSelecionada, horarioSelecionado);

      await verificarConflitoAgendamento(dataHora);
      const barbeiroId = await obterBarbeiroDisponivel(dataHora);

      const { data: agendamentoCriado, error } = await supabase.from('agendamentos').insert([{
        cliente_id: clienteId,
        empresa_id: empresaId,
        filial_id: filialSelecionada.id,
        servico_id: isAssinante ? null : servicoSelecionado.id,
        plano_id: isAssinante ? planoCliente?.planoUuid : null,
        barbeiro_id: barbeiroId,
        data_hora: dataHora.toISOString(),
        tipo_cliente: tipoCliente,
        duracao_minutos: duracaoServico,
        status: 'agendado',
      }]).select('id').single();

      if (error) throw error;
      if (agendamentoCriado?.id) {
        notificarAgendamento({ agendamentoId: agendamentoCriado.id, evento: 'criado' });
      }
      setConfirmado(true);
      setStep(5);
    } catch (e) {
      console.error(e);
      if (e.message === 'cliente_agendamento_dia_conflito') {
        setErro('Voce ja possui um agendamento avulso ativo neste dia.');
      } else if (e.message === 'cliente_plano_agendamento_dia_conflito') {
        setErro('Seu plano permite apenas um agendamento por dia. Cancele dentro do prazo para reagendar.');
      } else if (e.message === 'limite_plano_atingido') {
        setErro('Voce ja usou ou reservou todos os cortes disponiveis neste ciclo do plano.');
      } else if (e.message === 'plano_ativo_nao_encontrado') {
        setErro('Seu plano venceu ou ainda nao esta ativo para este horario.');
      } else if (e.message === 'plano_indisponivel') {
        setErro('O plano vinculado nao esta disponivel. Fale com a barbearia.');
      } else if (e.message === 'agendamento_online_desativado') {
        setErro('A barbearia pausou novos agendamentos online agora.');
      } else if (['23505', '23P01'].includes(e.code) || ['cliente_agendamento_conflito', 'barbeiro_agendamento_conflito'].includes(e.message)) {
        setErro('Esse horario acabou de ser ocupado. Escolha outro horario.');
      } else {
        setErro(e.message || 'Erro ao confirmar. Tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const etapaTitulo = {
    0: 'Novo agendamento',
    1: 'Novo agendamento',
    2: 'Data e horário',
    3: 'Escolher barbeiro',
    4: 'Confirmar agendamento',
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center overflow-hidden p-3">
      <div className="w-full max-w-[390px] h-[88vh] max-h-[780px] min-h-[560px] bg-[#050505] border border-[#242424] rounded-[28px] overflow-hidden flex flex-col shadow-2xl">
        {step < 5 && (
          <div className="back-bar flex-shrink-0">
            <button className="back-btn" onClick={prevStep}>
              <Icon name="arrow" />
            </button>
            <span className="back-title">{etapaTitulo[step]}</span>
          </div>
        )}

        {carregando ? (
          <div className="scroll flex-1 text-center text-zinc-600 text-xs">Carregando...</div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {step === 0 && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="step-head flex-shrink-0">
                  <ClienteAgendamentoStepBar step={1} />
                  <div className="step-title">Servico necessario</div>
                  <div className="step-sub">Escolha um servico antes de selecionar data e horario</div>
                </div>
                <div className="scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain" style={{ paddingTop: '14px' }}>
                  <div className="notice" style={{ padding: '18px', color: 'var(--client-s6)', fontSize: '12px', lineHeight: 1.6 }}>
                    {erro || 'Volte e selecione um servico no painel antes de abrir o agendamento.'}
                  </div>
                  <button className="btn primary" onClick={fechar} style={{ marginTop: '8px' }}>
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="step-head flex-shrink-0">
                  <ClienteAgendamentoStepBar step={2} />
                  <div className="step-title">Quando?</div>
                  <div className="step-sub">Escolha data e horário disponível</div>
                </div>
                <div className="scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain" style={{ paddingTop: '14px' }}>
                  {isAssinante && servicoSelecionado && (
                    <div className="card">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Servico do plano</p>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-white font-bold text-sm">{servicoSelecionado.nome}</p>
                          <p className="text-xs text-zinc-500 mt-1">Incluido no {planoCliente?.planoNome || 'plano ativo'} - {duracaoServico} min</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="stat-lbl">DATA</div>
                  <div className="date-grid">
                    {datasDisponiveis.length > 0 ? datasDisponiveis.map(d => (
                      <button
                        key={d.toISOString()}
                        className={`dslot ${mesmaData(dataSelecionada, d) ? 'sel' : ''}`}
                        onClick={() => {
                          setDataSelecionada(d);
                          setHorarioSelecionado(null);
                        }}
                      >
                        <div className="dday">{DIAS_SEMANA[d.getDay()]}</div>
                        <div className="dnum">{String(d.getDate()).padStart(2, '0')}</div>
                      </button>
                    )) : (
                      <div className="notice" style={{ gridColumn: '1 / -1', padding: '12px', color: 'var(--client-s6)', fontSize: '12px' }}>
                        Nenhum dia aberto nos proximos dias.
                      </div>
                    )}
                  </div>

                  <div className="stat-lbl">HORÁRIOS DISPONÍVEIS</div>
                  <div className="time-grid">
                    {dataSelecionada && horariosDoDia.length > 0 ? horariosDoDia.map(hora => {
                      const indisponivel = horariosIndisponiveis.has(hora);
                      return (
                        <button
                          key={hora}
                          className={`tslot ${horarioSelecionado === hora ? 'sel' : ''} ${indisponivel ? 'busy' : ''}`}
                          disabled={indisponivel}
                          onClick={() => {
                            if (!indisponivel) setHorarioSelecionado(hora);
                          }}
                        >
                          {hora}
                        </button>
                      );
                    }) : (
                      <div className="notice" style={{ gridColumn: '1 / -1', padding: '12px', color: 'var(--client-s6)', fontSize: '12px' }}>
                        Escolha uma data com horários disponíveis.
                      </div>
                    )}
                  </div>

                  <button className="btn primary" onClick={() => setStep(3)} disabled={!dataSelecionada || !horarioSelecionado}>
                    Próximo
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="step-head flex-shrink-0">
                  <ClienteAgendamentoStepBar step={3} />
                  <div className="step-title">Com quem?</div>
                  <div className="step-sub">Ou deixe sem preferência</div>
                </div>
                <div className="scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain" style={{ paddingTop: '14px' }}>
                  {barbeirosDaFilial.length > 0 ? barbeirosDaFilial.map(b => (
                    <button
                      key={b.id}
                      className={`bopt ${barbeiroSelecionado?.id === b.id ? 'sel' : ''}`}
                      disabled={dataSelecionada && horarioSelecionado && !barbeiroDisponivelNoHorario(b.id, criarDataHora(dataSelecionada, horarioSelecionado), duracaoServico)}
                      onClick={() => setBarbeiroSelecionado(b)}
                    >
                      <div className="bav">{b.nome.substring(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="bname">{b.nome}</div>
                        <div className="brole">
                          {dataSelecionada && horarioSelecionado && !barbeiroDisponivelNoHorario(b.id, criarDataHora(dataSelecionada, horarioSelecionado), duracaoServico)
                            ? 'Indisponivel nesse horario'
                            : 'Barbeiro'}
                        </div>
                      </div>
                      <div className="chk"><Icon name="check" /></div>
                    </button>
                  )) : (
                    <div className="notice" style={{ padding: '12px', color: 'var(--client-s6)', fontSize: '12px' }}>
                      Nenhum barbeiro ativo disponivel nesta filial.
                    </div>
                  )}

                  {barbeirosDaFilial.length > 1 && (
                    <button className={`bopt ${!barbeiroSelecionado ? 'sel' : ''}`} onClick={() => setBarbeiroSelecionado(null)}>
                    <div className="bav"><Icon name="users" /></div>
                    <div>
                      <div className="bname">Sem preferência</div>
                      <div className="brole">Próximo disponível</div>
                    </div>
                    <div className="chk"><Icon name="check" /></div>
                    </button>
                  )}

                  <button className="btn primary" onClick={irParaConfirmacaoAgendamento} disabled={barbeirosDaFilial.length === 0} style={{ marginTop: '8px' }}>Próximo</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="step-head flex-shrink-0">
                  <ClienteAgendamentoStepBar step={4} />
                  <div className="step-title">Tudo certo?</div>
                  <div className="step-sub">Revise antes de confirmar</div>
                </div>
                <div className="scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain" style={{ paddingTop: '14px' }}>
                  <div className="conf">
                    <div className="crow"><span className="cl">Serviço</span><span className="cv">{servicoSelecionado?.nome || '-'}</span></div>
                    <div className="crow"><span className="cl">Data</span><span className="cv">{dataSelecionada?.toLocaleDateString('pt-BR') || '-'}</span></div>
                    <div className="crow"><span className="cl">Horário</span><span className="cv">{horarioSelecionado || '-'}</span></div>
                    <div className="crow"><span className="cl">Barbeiro</span><span className="cv">{barbeiroSelecionado?.nome || 'Sem preferência'}</span></div>
                    <div className="crow"><span className="cl">Valor</span><span className="cv" style={{ color: 'var(--client-gold)' }}>{isAssinante ? 'Incluido no plano' : `R$ ${Number(servicoSelecionado?.preco || 0).toFixed(0)}`}</span></div>
                  </div>
                  {isAssinante && (
                    <div className="rounded-[16px] border border-[#d5b451]/30 bg-[#d5b451]/10 p-4 mb-3 text-left">
                      <p className="text-[#d5b451] text-[10px] font-black uppercase tracking-[0.2em] mb-2">Uso do plano</p>
                      <p className="text-[#f5ead4] text-xs leading-relaxed font-semibold">
                        Ao confirmar, este agendamento consome 1 uso do seu plano imediatamente.
                        {agendamentoDentroPrazoCancelamento
                          ? ` Como o horario agendado excedeu o prazo normal de cancelamento de ${prazoCancelamentoMinutos} min de antecedencia, voce podera cancelar apenas por ${CANCELAMENTO_ARREPENDIMENTO_MINUTOS} minutos apos confirmar, ate ${horarioLimiteArrependimento}. Depois disso o uso nao sera devolvido.`
                          : ` Se cancelar ate ${prazoCancelamentoMinutos} minutos antes do horario, o uso volta para o seu plano.`}
                      </p>
                    </div>
                  )}
                  {erro && <p className="text-red-500 text-xs text-center mb-2">{erro}</p>}
                  <button className="btn primary" onClick={confirmarAgendamento} disabled={salvando}>
                    {salvando ? 'Confirmando...' : 'Confirmar agendamento'}
                  </button>
                  <button className="btn ghost" style={{ marginTop: '8px' }} onClick={fechar}>Cancelar</button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="success-wrap">
                  <div className="success-ring">
                    <Icon name="check" className="w-8 h-8" />
                  </div>
                  <div style={{ color: 'var(--client-gold)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>CONFIRMADO</div>
                  <div style={{ color: 'var(--client-text)', fontSize: '36px', fontWeight: 900, marginBottom: '6px' }}>AGENDADO!</div>
                  <div style={{ color: 'var(--client-s6)', fontSize: '13px', marginBottom: '28px', lineHeight: 1.7, textAlign: 'center' }}>
                    Seu horário está reservado.<br />{isAssinante ? '1 uso do plano foi consumido.' : 'Você receberá um lembrete.'}
                  </div>
                  <button className="btn primary" onClick={fechar}>Voltar ao início</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
