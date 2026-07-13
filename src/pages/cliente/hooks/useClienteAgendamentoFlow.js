import { useState } from 'react';
import { montarRotaEmpresa } from '../../../services/empresa';
import { notificarAgendamento } from '../../../services/notifications';
import { supabase } from '../../../services/supabase';

const CANCELAMENTO_ARREPENDIMENTO_MINUTOS = 5;

const lerDataValida = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const obterPoliticaCancelamento = (agendamento, prazoPadrao = 120) => {
  const dataAgendamento = lerDataValida(agendamento?.data_hora);
  if (!dataAgendamento) return null;

  const prazoSalvo = Number(agendamento?.prazo_cancelamento_minutos_aplicado);
  const possuiPoliticaSalva = Boolean(agendamento?.prazo_cancelamento_minutos_aplicado != null
    && Number.isFinite(prazoSalvo)
    && lerDataValida(agendamento?.cancelamento_normal_ate));
  const prazo = possuiPoliticaSalva
    ? Math.max(0, prazoSalvo)
    : Math.max(0, Number(prazoPadrao) || 0);
  const limiteNormal = possuiPoliticaSalva
    ? lerDataValida(agendamento.cancelamento_normal_ate)
    : new Date(dataAgendamento.getTime() - prazo * 60000);

  let limiteExcepcional = possuiPoliticaSalva
    ? lerDataValida(agendamento?.cancelamento_excepcional_ate)
    : null;

  if (!possuiPoliticaSalva && String(agendamento?.tipo_cliente || '').toLowerCase() === 'assinante') {
    const criadoEm = lerDataValida(agendamento?.created_at);
    if (criadoEm) {
      limiteExcepcional = new Date(Math.min(
        criadoEm.getTime() + CANCELAMENTO_ARREPENDIMENTO_MINUTOS * 60000,
        dataAgendamento.getTime()
      ));
    }
  }

  return { prazo, limiteNormal, limiteExcepcional };
};

const formatarLimiteCancelamento = (data) => {
  if (!data) return '';
  return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export default function useClienteAgendamentoFlow({
  tipoCliente,
  dados,
  agendamentoAtivo,
  carregarDados,
  clienteIdAtual,
  navigate,
  slugEmpresa,
  exibirAlerta,
  exibirConfirmacao,
  setMenuAberto,
}) {
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [seletorServicoAberto, setSeletorServicoAberto] = useState(false);
  const [servicoAgendamentoInicial, setServicoAgendamentoInicial] = useState(null);
  const [modoAgendamento, setModoAgendamento] = useState('avulso');
  const [voltarParaServicosAoVoltar, setVoltarParaServicosAoVoltar] = useState(false);

  const abrirAgendamento = () => {
    setMenuAberto(false);
    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento indisponivel', 'No momento esta barbearia nao esta aceitando agendamento online.');
      return;
    }
    if (tipoCliente === 'ativo') {
      if (!dados?.planoUuid) {
        exibirAlerta('Plano indisponivel', 'Nao foi possivel identificar o plano ativo. Atualize a tela e tente novamente.');
        return;
      }
      setModoAgendamento('plano');
      setServicoAgendamentoInicial(null);
      setVoltarParaServicosAoVoltar(false);
      setModalAgendamentoAberto(true);
      return;
    }
    setSeletorServicoAberto(true);
  };

  const abrirAgendamentoSemPlano = (servicoId = null) => {
    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento indisponivel', 'No momento esta barbearia nao esta aceitando agendamento online para clientes sem plano ativo.');
      return;
    }
    if (typeof servicoId !== 'string') {
      setSeletorServicoAberto(true);
      return;
    }
    setModoAgendamento('avulso');
    setServicoAgendamentoInicial(servicoId);
    setVoltarParaServicosAoVoltar(false);
    setModalAgendamentoAberto(true);
  };

  const abrirAgendamentoAvulsoPendente = (servicoId = null) => {
    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento indisponivel', 'No momento esta barbearia nao esta aceitando agendamento online.');
      return;
    }
    if (typeof servicoId !== 'string') {
      setSeletorServicoAberto(true);
      return;
    }
    setModoAgendamento('avulso');
    setServicoAgendamentoInicial(servicoId);
    setVoltarParaServicosAoVoltar(true);
    setModalAgendamentoAberto(true);
  };

  const abrirAgendamentoComPlano = () => {
    if (tipoCliente !== 'ativo') {
      exibirAlerta('Plano pendente', 'Seu plano precisa ser ativado para agendar usando os beneficios do plano.');
      return;
    }

    if (!agendamentoAtivo) {
      exibirAlerta('Agendamento indisponivel', 'No momento esta barbearia nao esta aceitando agendamento online.');
      return;
    }

    if (!dados?.planoUuid) {
      exibirAlerta('Plano indisponivel', 'Nao foi possivel identificar o plano ativo. Atualize a tela e tente novamente.');
      return;
    }

    setModoAgendamento('plano');
    setServicoAgendamentoInicial(null);
    setVoltarParaServicosAoVoltar(false);
    setModalAgendamentoAberto(true);
  };

  const selecionarServicoAvulso = (servicoId) => {
    setModoAgendamento('avulso');
    setServicoAgendamentoInicial(servicoId);
    setVoltarParaServicosAoVoltar(true);
    setModalAgendamentoAberto(true);
  };

  const handleFechamentoAgendamento = (resultado) => {
    setModalAgendamentoAberto(false);

    if (resultado?.voltarParaServicos) {
      setModoAgendamento('avulso');
      setServicoAgendamentoInicial(null);
      setVoltarParaServicosAoVoltar(false);
      setSeletorServicoAberto(true);
      return;
    }

    setModoAgendamento(tipoCliente === 'ativo' ? 'plano' : 'avulso');
    setServicoAgendamentoInicial(null);
    setVoltarParaServicosAoVoltar(false);
    if (resultado?.sucesso) {
      carregarDados(clienteIdAtual());
    }
    if (resultado?.irParaPlanos) navigate(montarRotaEmpresa(slugEmpresa, '/planos'));
  };

  const podeCancelarAgendamento = (agendamento, prazoCancelamentoMinutos = 120) => {
    const politica = obterPoliticaCancelamento(agendamento, prazoCancelamentoMinutos);
    if (!politica) return false;
    const agora = Date.now();
    return agora <= politica.limiteNormal.getTime()
      || Boolean(
        politica.limiteExcepcional
        && agora <= politica.limiteExcepcional.getTime()
      );
  };

  const informarCancelamentoIndisponivel = (agendamento, prazoCancelamentoMinutos) => {
    const politica = obterPoliticaCancelamento(agendamento, prazoCancelamentoMinutos);
    const limiteEfetivo = politica
      ? [politica.limiteNormal, politica.limiteExcepcional]
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime())[0]
      : null;
    const isAssinante = String(agendamento?.tipo_cliente || '').toLowerCase() === 'assinante';
    exibirAlerta(
      'Cancelamento indisponível',
      limiteEfetivo
        ? `Este agendamento podia ser cancelado até ${formatarLimiteCancelamento(limiteEfetivo)}. O prazo encerrou${isAssinante ? ' e o uso do plano não será devolvido' : ''}.`
        : 'Não foi possível identificar um prazo válido para cancelar este agendamento.'
    );
  };

  const cancelarAgendamentoCliente = (agendamento, prazoCancelamentoMinutos = 120) => {
    if (!agendamento?.id) return;

    if (!podeCancelarAgendamento(agendamento, prazoCancelamentoMinutos)) {
      informarCancelamentoIndisponivel(agendamento, prazoCancelamentoMinutos);
      return;
    }

    exibirConfirmacao('Cancelar agendamento', 'Deseja cancelar este agendamento?', async () => {
      const { error } = await supabase.rpc('cancelar_agendamento_cliente', {
        p_agendamento_id: agendamento.id,
      });

      if (error) {
        if (error.message === 'cancelamento_agendamento_indisponivel') {
          informarCancelamentoIndisponivel(agendamento, prazoCancelamentoMinutos);
          return;
        }
        exibirAlerta('Erro', 'Nao foi possivel cancelar o agendamento.');
        return;
      }

      notificarAgendamento({ agendamentoId: agendamento.id, evento: 'cancelado' });
      exibirAlerta('Cancelado', 'Seu agendamento foi cancelado.');
      carregarDados(clienteIdAtual());
    });
  };

  return {
    modalAgendamentoAberto,
    seletorServicoAberto,
    setSeletorServicoAberto,
    servicoAgendamentoInicial,
    modoAgendamento,
    voltarParaServicosAoVoltar,
    abrirAgendamento,
    abrirAgendamentoSemPlano,
    abrirAgendamentoAvulsoPendente,
    abrirAgendamentoComPlano,
    selecionarServicoAvulso,
    handleFechamentoAgendamento,
    cancelarAgendamentoCliente,
    podeCancelarAgendamento,
  };
}
