import { useState } from 'react';
import { montarRotaEmpresa } from '../../../services/empresa';
import { notificarAgendamento } from '../../../services/notifications';
import { supabase } from '../../../services/supabase';

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
      if (!dados?.servicoId) {
        exibirAlerta('Plano sem servico', 'Este plano ainda nao tem um servico vinculado. Peca para o barbeiro configurar no painel de planos.');
        return;
      }
      setModoAgendamento('plano');
      setServicoAgendamentoInicial(dados.servicoId);
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

    if (!dados?.servicoId) {
      exibirAlerta('Plano sem servico', 'Este plano ainda nao tem um servico vinculado. Peca para o barbeiro configurar no painel de planos.');
      return;
    }

    setModoAgendamento('plano');
    setServicoAgendamentoInicial(dados.servicoId);
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
      exibirAlerta('Agendado!', 'Seu agendamento foi confirmado. Te esperamos na barbearia.');
      carregarDados(clienteIdAtual());
    }
    if (resultado?.irParaPlanos) navigate(montarRotaEmpresa(slugEmpresa, '/planos'));
  };

  const podeCancelarAgendamento = (agendamento, prazoCancelamentoMinutos = 120) => {
    const dataAgendamento = agendamento?.data_hora ? new Date(agendamento.data_hora) : null;
    if (!dataAgendamento || Number.isNaN(dataAgendamento.getTime())) return false;
    const limite = dataAgendamento.getTime() - Number(prazoCancelamentoMinutos || 0) * 60000;
    return Date.now() <= limite;
  };

  const cancelarAgendamentoCliente = (agendamento, prazoCancelamentoMinutos = 120) => {
    if (!agendamento?.id) return;

    if (!podeCancelarAgendamento(agendamento, prazoCancelamentoMinutos)) {
      exibirAlerta(
        'Cancelamento indisponivel',
        `Este agendamento so pode ser cancelado ate ${prazoCancelamentoMinutos} minutos antes do horario.`
      );
      return;
    }

    exibirConfirmacao('Cancelar agendamento', 'Deseja cancelar este agendamento?', async () => {
      const { error } = await supabase.rpc('cancelar_agendamento_cliente', {
        p_agendamento_id: agendamento.id,
      });

      if (error) {
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
