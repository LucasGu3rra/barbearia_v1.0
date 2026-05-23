/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const gerarProximosDias = () => {
  const dias = [];
  const hoje = new Date();
  for (let i = 0; i < 7; i++) {
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
  const fimMin = inicioMin + duracao;
  const aberturaMin = horarioParaMinutos(regra.horario_inicio.substring(0, 5));
  const fechamentoMin = horarioParaMinutos(regra.horario_fim.substring(0, 5));

  if (inicioMin < aberturaMin || fimMin > fechamentoMin) return false;

  if (regra.intervalo_inicio && regra.intervalo_fim) {
    const pausaInicioMin = horarioParaMinutos(regra.intervalo_inicio.substring(0, 5));
    const pausaFimMin = horarioParaMinutos(regra.intervalo_fim.substring(0, 5));
    if (inicioMin < pausaFimMin && fimMin > pausaInicioMin) return false;
  }

  return true;
};

const normalizarTexto = (valor = '') => String(valor)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const encontrarServicoDoPlano = (servicos, planoCliente) => {
  if (!planoCliente) return null;
  const planoSlug = normalizarTexto(planoCliente.planoId);
  const planoNome = normalizarTexto(planoCliente.planoNome);
  const planoTexto = `${planoSlug} ${planoNome}`;
  const planoTemBarba = planoTexto.includes('barba') || planoTexto.includes('completo');
  const planoTemCabelo = planoTexto.includes('cabelo') || planoTexto.includes('corte') || planoTexto.includes('completo');

  const servicosComTexto = servicos.map((servico) => {
    const texto = normalizarTexto([
      servico.nome,
      servico.servico_categorias?.nome,
      servico.servico_subcategorias?.nome,
    ].filter(Boolean).join(' '));

    return {
      servico,
      texto,
      temBarba: texto.includes('barba'),
      temCabelo: texto.includes('cabelo') || texto.includes('corte') || texto.includes('degrade') || texto.includes('tesoura'),
    };
  });

  const exato = servicosComTexto.find(({ texto }) => texto === planoNome || texto.includes(planoSlug) || texto.includes(planoNome));
  if (exato) return exato.servico;

  if (planoTemCabelo && planoTemBarba) {
    const servicoCombo = servicosComTexto.find(({ temCabelo, temBarba }) => temCabelo && temBarba);
    if (servicoCombo) return servicoCombo.servico;
  }

  if (planoTemBarba) {
    const servicoBarba = servicosComTexto.find(({ temBarba, temCabelo }) => temBarba && !temCabelo);
    if (servicoBarba) return servicoBarba.servico;
  }

  if (planoTemCabelo) {
    const servicoCabelo = servicosComTexto.find(({ temCabelo, temBarba }) => temCabelo && !temBarba);
    if (servicoCabelo) return servicoCabelo.servico;
  }

  return servicosComTexto.find(({ temCabelo, temBarba }) => temCabelo || temBarba)?.servico || servicos[0] || null;
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

export default function ModalAgendamento({ isOpen, onClose, clienteId, tipoCliente, empresaId, planoCliente = null, servicoInicialId = null }) {
  const [step, setStep] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [servicoPreSelecionado, setServicoPreSelecionado] = useState(false);

  const [filiais, setFiliais] = useState([]);
  const [servicos, setServicos] = useState([]);
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
    const servicoPlano = isAssinante ? encontrarServicoDoPlano(listaServicos, planoCliente) : null;

    setFiliais(listaFiliais);
    setServicos(listaServicos);
    setBarbeiros(listaBarbeiros);
    setHorariosFuncionamento(horarios || []);
    setFilialSelecionada(listaFiliais[0] || null);
    setBarbeiroSelecionado(null);
    const servicoPadrao = servicoInicial || servicoPlano || null;
    setServicoSelecionado(servicoPadrao);
    setServicoPreSelecionado(Boolean(servicoPadrao));
    setStep(servicoPadrao ? 2 : 1);
    setCarregando(false);
  }, [empresaId, isAssinante, planoCliente, servicoInicialId]);

  useEffect(() => {
    if (!isOpen || !empresaId) return;

    setStep(1);
    setErro('');
    setConfirmado(false);
    setServicoSelecionado(null);
    setServicoPreSelecionado(false);
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

  const datasDisponiveis = useMemo(() => gerarProximosDias().filter((data) => {
    const regra = regraFuncionamentoDoDia(data);
    return regra?.aberto && regra.horario_inicio && regra.horario_fim;
  }), [regraFuncionamentoDoDia]);

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
    if (step === 1) fechar();
    else if (step === 2 && servicoPreSelecionado) fechar();
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

      const { error } = await supabase.from('agendamentos').insert([{
        cliente_id: clienteId,
        empresa_id: empresaId,
        filial_id: filialSelecionada.id,
        servico_id: servicoSelecionado.id,
        barbeiro_id: barbeiroId,
        data_hora: dataHora.toISOString(),
        tipo_cliente: tipoCliente,
        duracao_minutos: duracaoServico,
        status: 'agendado',
      }]);

      if (error) throw error;
      setConfirmado(true);
      setStep(5);
    } catch (e) {
      console.error(e);
      if (e.code === '23505' || ['cliente_agendamento_conflito', 'barbeiro_agendamento_conflito'].includes(e.message)) {
        setErro('Esse horario acabou de ser ocupado. Escolha outro horario.');
      } else {
        setErro(e.message || 'Erro ao confirmar. Tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const etapaTitulo = {
    1: 'Novo agendamento',
    2: 'Data e horário',
    3: 'Escolher barbeiro',
    4: 'Confirmar agendamento',
  };

  const escolherServicoAvulso = () => {
    setServicoSelecionado(null);
    setServicoPreSelecionado(false);
    setStep(1);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex justify-center overflow-y-auto">
      <div className="client-device min-h-screen">
        {step < 5 && (
          <div className="back-bar">
            <button className="back-btn" onClick={prevStep}>
              <Icon name="arrow" />
            </button>
            <span className="back-title">{etapaTitulo[step]}</span>
          </div>
        )}

        {carregando ? (
          <div className="scroll text-center text-zinc-600 text-xs">Carregando...</div>
        ) : (
          <>
            {step === 1 && (
              <div className="page on">
                <div className="step-head">
                  <StepBar step={1} />
                  <div className="step-title">Qual serviço?</div>
                  <div className="step-sub">Escolha o que deseja fazer hoje</div>
                </div>
                <div className="scroll" style={{ paddingTop: '14px' }}>
                  {servicos.map(svc => {
                    const nome = svc.nome.toLowerCase();
                    const icon = nome.includes('barba') ? 'tool' : nome.includes('&') || nome.includes('combo') ? 'stars' : 'scissors';
                    return (
                      <button
                        key={svc.id}
                        className={`sopt ${servicoSelecionado?.id === svc.id ? 'sel' : ''}`}
                        onClick={() => {
                          setServicoSelecionado(svc);
                          setServicoPreSelecionado(false);
                        }}
                      >
                        <div className="sopt-ico"><Icon name={icon} /></div>
                        <div>
                          <div className="sopt-name">{svc.nome}</div>
                          <div className="sopt-sub">~{svc.duracao_minutos || 30} min · R$ {Number(svc.preco || 0).toFixed(0)}</div>
                        </div>
                        <div className="chk"><Icon name="check" /></div>
                      </button>
                    );
                  })}
                  <button className="btn primary" onClick={() => setStep(2)} disabled={!servicoSelecionado} style={{ marginTop: '8px' }}>
                    Próximo
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="page on">
                <div className="step-head">
                  <StepBar step={2} />
                  <div className="step-title">Quando?</div>
                  <div className="step-sub">Escolha data e horário disponível</div>
                </div>
                <div className="scroll" style={{ paddingTop: '14px' }}>
                  {isAssinante && servicoSelecionado && (
                    <div className="card">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">Servico do plano</p>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-white font-bold text-sm">{servicoSelecionado.nome}</p>
                          <p className="text-xs text-zinc-500 mt-1">Incluido no {planoCliente?.planoNome || 'plano ativo'} - {duracaoServico} min</p>
                        </div>
                        <button type="button" className="text-[#d5b451] text-[10px] font-bold uppercase tracking-widest" onClick={escolherServicoAvulso}>
                          Avulso
                        </button>
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
              <div className="page on">
                <div className="step-head">
                  <StepBar step={3} />
                  <div className="step-title">Com quem?</div>
                  <div className="step-sub">Ou deixe sem preferência</div>
                </div>
                <div className="scroll" style={{ paddingTop: '14px' }}>
                  {barbeirosDaFilial.map(b => (
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
                  ))}

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

                  <button className="btn primary" onClick={() => setStep(4)} style={{ marginTop: '8px' }}>Próximo</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="page on">
                <div className="step-head">
                  <StepBar step={4} />
                  <div className="step-title">Tudo certo?</div>
                  <div className="step-sub">Revise antes de confirmar</div>
                </div>
                <div className="scroll" style={{ paddingTop: '14px' }}>
                  <div className="conf">
                    <div className="crow"><span className="cl">Serviço</span><span className="cv">{servicoSelecionado?.nome || '-'}</span></div>
                    <div className="crow"><span className="cl">Data</span><span className="cv">{dataSelecionada?.toLocaleDateString('pt-BR') || '-'}</span></div>
                    <div className="crow"><span className="cl">Horário</span><span className="cv">{horarioSelecionado || '-'}</span></div>
                    <div className="crow"><span className="cl">Barbeiro</span><span className="cv">{barbeiroSelecionado?.nome || 'Sem preferência'}</span></div>
                    <div className="crow"><span className="cl">Valor</span><span className="cv" style={{ color: 'var(--client-gold)' }}>R$ {Number(servicoSelecionado?.preco || 0).toFixed(0)}</span></div>
                  </div>
                  {erro && <p className="text-red-500 text-xs text-center mb-2">{erro}</p>}
                  <button className="btn primary" onClick={confirmarAgendamento} disabled={salvando}>
                    {salvando ? 'Confirmando...' : 'Confirmar agendamento'}
                  </button>
                  <button className="btn ghost" style={{ marginTop: '8px' }} onClick={fechar}>Cancelar</button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="page on">
                <div className="success-wrap">
                  <div className="success-ring">
                    <Icon name="check" className="w-8 h-8" />
                  </div>
                  <div style={{ color: 'var(--client-gold)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>CONFIRMADO</div>
                  <div style={{ color: 'var(--client-text)', fontSize: '36px', fontWeight: 900, marginBottom: '6px' }}>AGENDADO!</div>
                  <div style={{ color: 'var(--client-s6)', fontSize: '13px', marginBottom: '28px', lineHeight: 1.7, textAlign: 'center' }}>
                    Seu horário está reservado.<br />Você receberá um lembrete.
                  </div>
                  <button className="btn primary" onClick={fechar}>Voltar ao início</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepBar({ step }) {
  return (
    <div className="step-bar">
      {[1, 2, 3, 4].map((item, index) => (
        <span key={item} style={{ display: 'contents' }}>
          <div className={`sdot ${item < step ? 'done' : item === step ? 'cur' : ''}`}></div>
          {index < 3 && <div className={`sline ${item < step ? 'done' : ''}`}></div>}
        </span>
      ))}
    </div>
  );
}
