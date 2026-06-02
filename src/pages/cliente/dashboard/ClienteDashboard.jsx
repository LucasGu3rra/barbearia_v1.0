import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ModalAlerta from '../../components/ModalAlerta';
import ModalAgendamento from '../../components/ModalAgendamento';
import { useAuth } from '../../../contexts/useAuth';
import DrawerClientes from '../../components/clientes/DrawerClientes';
import { montarRotaEmpresa, normalizarTelefoneBrasil } from '../../../services/empresa';
import ClienteDashboardAvulso from './ClienteDashboardAvulso';
import ClienteDashboardPlano from './ClienteDashboardPlano';
import ClienteCheckoutPlanoModal from '../../components/clientes/ClienteCheckoutPlanoModal';
import ClienteHistoricoModal from '../../components/clientes/ClienteHistoricoModal';
import ClienteShell from '../../components/clientes/ClienteShell';
import ClienteServicoPickerModal from '../../components/clientes/ClienteServicoPickerModal';
import { supabase } from '../../../services/supabase';
import useClienteAgendamentoFlow from '../hooks/useClienteAgendamentoFlow';
import useClienteDashboardData from '../hooks/useClienteDashboardData';
import useClientePerfilActions from '../hooks/useClientePerfilActions';
import useClientePlanos from '../hooks/useClientePlanos';
import { parseDataSupabase } from '../utils/clienteDashboardUtils';

function ClienteDashboardSkeleton({ empresaNome }) {
  return (
    <ClienteShell onMenu={() => {}} empresaNome={empresaNome}>
      <div className="space-y-4 px-4 py-5 animate-pulse">
        <div className="h-24 rounded-[18px] border border-[#27272a] bg-[#18181b]" />
        <div className="h-16 rounded-[16px] border border-[#27272a] bg-[#111111]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 rounded-[16px] border border-[#27272a] bg-[#18181b]" />
          <div className="h-28 rounded-[16px] border border-[#27272a] bg-[#18181b]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 rounded-[16px] border border-[#27272a] bg-[#18181b]" />
          <div className="h-28 rounded-[16px] border border-[#27272a] bg-[#18181b]" />
        </div>
        <div className="h-20 rounded-[16px] border border-[#27272a] bg-[#111111]" />
      </div>
    </ClienteShell>
  );
}

export default function ClienteDashboard() {
  const { user, loading: authLoading, empresaAtual } = useAuth();
  const { empresaSlug } = useParams();
  const empresaId = empresaAtual?.id;
  const slugEmpresa = empresaAtual?.slug || empresaSlug;
  const navigate = useNavigate();

  const [menuAberto, setMenuAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);

  const CHAVE_PIX = empresaAtual?.chave_pix || '81988468182';
  const WHATSAPP_JOAO = normalizarTelefoneBrasil(empresaAtual?.whatsapp || '5581988468182');
  const empresaNome = (empresaAtual?.nome || 'JOAO BARBER').toUpperCase();

  const {
    dados,
    setDados,
    historicoMes,
    loading,
    tipoCliente,
    agendamentoAtivo,
    servicosAvulsos,
    agendamentos,
    historicoCompleto,
    planosDb,
    mapaPlanos,
    prazoCancelamentoMinutos,
    clienteIdAtual,
    carregarDados,
  } = useClienteDashboardData({
    user,
    authLoading,
    empresaAtual,
    empresaSlug,
    navigate,
  });

  const [configModalAlerta, setConfigModalAlerta] = useState({
    isOpen: false, type: 'alert', title: '', message: '', onConfirm: null,
  });

  const fecharModalAlerta = () => setConfigModalAlerta(p => ({ ...p, isOpen: false }));
  const exibirAlerta = (title, message) => setConfigModalAlerta({ isOpen: true, type: 'alert', title, message, onConfirm: null });
  const exibirConfirmacao = (title, message, acao) => setConfigModalAlerta({ isOpen: true, type: 'confirm', title, message, onConfirm: acao });

  const {
    modalCheckoutAberto,
    setModalCheckoutAberto,
    pixCopiado,
    copiarPix,
    alterarPlano,
    cancelarAgendamento,
    abrirCheckoutPlano,
    abrirWhatsappPagamento,
  } = useClientePlanos({
    dados,
    setDados,
    mapaPlanos,
    empresaId,
    clienteIdAtual,
    carregarDados,
    chavePix: CHAVE_PIX,
    whatsappBarbearia: WHATSAPP_JOAO,
    exibirConfirmacao,
    fecharModalAlerta,
    setMenuAberto,
  });

  const {
    modalAgendamentoAberto,
    seletorServicoAberto,
    setSeletorServicoAberto,
    servicoAgendamentoInicial,
    modoAgendamento,
    voltarParaServicosAoVoltar,
    abrirAgendamentoSemPlano,
    abrirAgendamentoAvulsoPendente,
    abrirAgendamentoComPlano,
    selecionarServicoAvulso,
    handleFechamentoAgendamento,
    cancelarAgendamentoCliente,
  } = useClienteAgendamentoFlow({
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
  });

  const {
    fecharMenu,
    handleLogout,
  } = useClientePerfilActions({
    empresaId,
    clienteIdAtual,
    navigate,
    slugEmpresa,
    setMenuAberto,
  });

  const abrirPlanos = () => {
    setMenuAberto(false);
    navigate(montarRotaEmpresa(slugEmpresa, '/planos'));
  };

  const confirmarCortePlano = async () => {
    if (!empresaId) return;

    const { error } = await supabase.rpc('confirmar_corte_plano', {
      p_empresa_id: empresaId,
    });

    if (error) {
      const mensagem = String(error.message || '');
      if (mensagem.includes('cliente_plano_corte_dia_conflito')) {
        exibirAlerta('Corte ja confirmado', 'Seu plano permite confirmar apenas um corte por dia.');
      } else if (mensagem.includes('limite_plano_atingido')) {
        exibirAlerta('Limite atingido', 'Voce ja usou todos os cortes disponiveis do seu plano neste mes.');
      } else if (mensagem.includes('plano_ativo_nao_encontrado')) {
        exibirAlerta('Plano indisponivel', 'Seu plano precisa estar ativo para confirmar o corte.');
      } else {
        exibirAlerta('Erro', 'Nao foi possivel confirmar o corte agora.');
      }
      return;
    }

    await carregarDados(clienteIdAtual());
    navigate(montarRotaEmpresa(slugEmpresa, '/confirmado'));
  };

  const formatarDetalhesAgendamento = (agendamento) => {
    if (!agendamento) return 'Nenhum agendamento ativo encontrado.';
    const data = agendamento.data_hora ? new Date(agendamento.data_hora) : null;
    const quando = data && !Number.isNaN(data.getTime())
      ? `${data.toLocaleDateString('pt-BR')} as ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : 'Sem data';

    return [
      `Servico: ${agendamento.servicos?.nome || 'Servico'}`,
      `Horario: ${quando}`,
      agendamento.barbeiros?.nome ? `Barbeiro: ${agendamento.barbeiros.nome}` : null,
      agendamento.filiais?.nome ? `Local: ${agendamento.filiais.nome}` : null,
      `Status: ${agendamento.status || 'agendado'}`,
    ].filter(Boolean).join('\n');
  };

  const verAgendamentoAvulso = (agendamento) => {
    exibirAlerta('Seu agendamento', formatarDetalhesAgendamento(agendamento));
  };

  const modalBase = (
    <>
      <ModalAlerta isOpen={configModalAlerta.isOpen} onClose={fecharModalAlerta} onConfirm={configModalAlerta.onConfirm} title={configModalAlerta.title} message={configModalAlerta.message} type={configModalAlerta.type} />
      {agendamentoAtivo && (
        <ModalAgendamento
          isOpen={modalAgendamentoAberto}
          onClose={handleFechamentoAgendamento}
          clienteId={clienteIdAtual()}
          clienteNome={dados?.nome}
          tipoCliente={modoAgendamento === 'plano' ? 'assinante' : 'avulso'}
          empresaId={empresaId}
          planoCliente={modoAgendamento === 'plano' ? dados : null}
          servicoInicialId={servicoAgendamentoInicial}
          voltarParaServicosAoVoltar={voltarParaServicosAoVoltar}
        />
      )}
      <ClienteServicoPickerModal
        isOpen={seletorServicoAberto}
        onClose={() => setSeletorServicoAberto(false)}
        servicos={servicosAvulsos}
        onSelecionarServico={selecionarServicoAvulso}
      />
      <DrawerClientes
        isOpen={menuAberto}
        onClose={fecharMenu}
        dados={dados}
        planosDb={planosDb}
        alterarPlano={alterarPlano}
        cancelarAgendamento={cancelarAgendamento}
        onLogout={handleLogout}
        tipoCliente={tipoCliente}
        onPagarPlano={abrirCheckoutPlano}
        whatsappBarbearia={WHATSAPP_JOAO}
        onRedefinirSenha={() => {
          setMenuAberto(false);
          navigate(montarRotaEmpresa(slugEmpresa, '/esqueci-senha'), { state: { email: user?.email || dados?.email || '' } });
        }}
        onHistoricoCompleto={() => {
          setMenuAberto(false);
          setModalHistoricoAberto(true);
        }}
      />
    </>
  );

  if (loading || !dados) {
    return <ClienteDashboardSkeleton empresaNome={empresaNome} />;
  }

  const pedidoRecente = (() => {
    const pedidos = [
      ...historicoCompleto.map((corte) => ({
        tipo: 'feito',
        nome: corte.tipo_corte,
        data: corte.created_at,
        status: 'feito',
      })),
      ...agendamentos.map((agendamento) => ({
        tipo: 'agendamento',
        nome: agendamento.servicos?.nome || 'Servico',
        data: agendamento.data_hora || agendamento.created_at,
        status: agendamento.status || 'agendado',
      })),
    ];

    return pedidos.sort((a, b) => parseDataSupabase(b.data) - parseDataSupabase(a.data))[0] || null;
  })();

  const agendamentosValidosAvulso = agendamentos.filter((agendamento) => {
    const status = String(agendamento.status || '').toLowerCase();
    return !['cancelado', 'cancelada'].includes(status);
  });

  const servicosFeitosAvulso = historicoCompleto.length + agendamentosValidosAvulso.length;

  const ultimoServicoAvulso = (() => {
    const registros = [
      ...historicoCompleto.map((corte) => ({
        id: corte.id,
        nome: corte.tipo_corte,
        data: corte.created_at,
        status: 'Finalizado',
      })),
      ...agendamentosValidosAvulso.map((agendamento) => ({
        id: agendamento.id,
        nome: agendamento.servicos?.nome || 'Servico',
        data: agendamento.data_hora || agendamento.created_at,
        status: String(agendamento.status || '').toLowerCase() === 'agendado' ? 'Agendado' : 'Finalizado',
        preco: agendamento.servicos?.preco,
      })),
    ];

    return registros.sort((a, b) => parseDataSupabase(b.data) - parseDataSupabase(a.data))[0] || null;
  })();

  const proximoAgendamentoAvulso = (() => {
    const agora = new Date();
    return agendamentos
      .filter((agendamento) => {
        if (['cancelado', 'cancelada', 'finalizado', 'finalizada'].includes(String(agendamento.status || '').toLowerCase())) return false;
        const data = agendamento.data_hora ? new Date(agendamento.data_hora) : null;
        return data && !Number.isNaN(data.getTime()) && data >= agora;
      })
      .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora))[0] || null;
  })();

  const clienteAvulsoRecorrente = agendamentos.length > 0 || historicoCompleto.length > 0;

  const renderDashboardPorTipo = () => {
    if (tipoCliente === 'avulso') {
      return (
        <ClienteDashboardAvulso
          primeiroUso={!clienteAvulsoRecorrente}
          dados={dados}
          servicosAvulsos={servicosAvulsos}
          temPlanos={planosDb.length > 0}
          historicoCompleto={historicoCompleto}
          servicosFeitos={servicosFeitosAvulso}
          ultimoServico={ultimoServicoAvulso}
          proximoAgendamento={proximoAgendamentoAvulso}
          prazoCancelamentoMinutos={prazoCancelamentoMinutos}
          agendamentoAtivo={agendamentoAtivo}
          onAbrirPlanos={abrirPlanos}
          onAbrirAgendamentoSemPlano={abrirAgendamentoSemPlano}
          onVerAgendamento={verAgendamentoAvulso}
          onCancelarAgendamento={(agendamento) => cancelarAgendamentoCliente(agendamento, prazoCancelamentoMinutos)}
        />
      );
    }

    return (
      <ClienteDashboardPlano
        dados={dados}
        statusPlano={tipoCliente}
        historicoMes={historicoMes}
        pedidoRecente={pedidoRecente}
        proximoAgendamento={proximoAgendamentoAvulso}
        prazoCancelamentoMinutos={prazoCancelamentoMinutos}
        agendamentoAtivo={agendamentoAtivo}
        onAbrirAgendamentoPlano={abrirAgendamentoComPlano}
        onAbrirOutroServico={abrirAgendamentoAvulsoPendente}
        onConfirmarCortePlano={confirmarCortePlano}
        onVerAgendamento={verAgendamentoAvulso}
        onCancelarAgendamento={(agendamento) => cancelarAgendamentoCliente(agendamento, prazoCancelamentoMinutos)}
      />
    );
  };

  return (
    <ClienteShell onMenu={() => setMenuAberto(true)} empresaNome={empresaNome}>
      {modalBase}
      {renderDashboardPorTipo()}
      <ClienteCheckoutPlanoModal
        isOpen={modalCheckoutAberto}
        dados={dados}
        mapaPlanos={mapaPlanos}
        chavePix={CHAVE_PIX}
        pixCopiado={pixCopiado}
        onClose={() => setModalCheckoutAberto(false)}
        onCopiarPix={copiarPix}
        onAbrirWhatsappPagamento={abrirWhatsappPagamento}
      />
      <ClienteHistoricoModal
        isOpen={modalHistoricoAberto}
        historicoCompleto={historicoCompleto}
        agendamentos={agendamentos}
        onClose={() => setModalHistoricoAberto(false)}
      />
      <style dangerouslySetInnerHTML={{ __html: '@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' }} />
    </ClienteShell>
  );
}
