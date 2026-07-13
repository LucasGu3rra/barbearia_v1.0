import { useState } from 'react';
import { supabase } from '../../../services/supabase';

export default function useClientePlanos({
  dados,
  setDados,
  mapaPlanos,
  empresaId,
  clienteIdAtual,
  carregarDados,
  chavePix,
  whatsappBarbearia,
  exibirAlerta,
  exibirConfirmacao,
  fecharModalAlerta,
  setMenuAberto,
}) {
  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);
  const [metodoPagamento] = useState('pix');
  const [pixCopiado, setPixCopiado] = useState(false);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);

  const copiarPix = () => {
    if (!chavePix) {
      exibirAlerta?.('Pix indisponível', 'A barbearia ainda não configurou uma chave Pix. Escolha pagamento presencial.');
      return;
    }
    navigator.clipboard.writeText(chavePix);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 3000);
  };

  const solicitarPlano = async (planoSlug, formaPagamento = 'nao_informado') => {
    if (!planoSlug) throw new Error('Plano nao informado.');

    const { error } = await supabase.rpc('solicitar_pagamento_plano_cliente', {
      p_empresa_id: empresaId,
      p_plano_slug: planoSlug,
      p_forma_pagamento: formaPagamento,
    });

    if (error) throw error;
    carregarDados(clienteIdAtual());
  };

  const solicitarMudancaPlano = async (planoSlug) => {
    const { error } = await supabase.rpc('solicitar_mudanca_plano_cliente', {
      p_empresa_id: empresaId,
      p_plano_slug: planoSlug,
    });

    if (error) throw error;
    carregarDados(clienteIdAtual());
  };

  const cancelarMudancaPlano = async () => {
    const { error } = await supabase.rpc('cancelar_mudanca_plano_cliente', {
      p_empresa_id: empresaId,
    });

    if (error) throw error;
    carregarDados(clienteIdAtual());
  };

  const efetuarMudancaPlanoDireta = async (novoPlano) => {
    try {
      await solicitarPlano(novoPlano);
      exibirAlerta?.('Solicitação registrada', 'O pedido foi enviado e aguarda confirmação da barbearia.');
    } catch (error) {
      console.error(error);
      const mensagem = String(error?.message || '');
      if (mensagem.includes('solicitacao_plano_pendente')) {
        exibirAlerta?.('Solicitação pendente', 'Já existe um pedido de plano aguardando confirmação da barbearia. Ele não pode ser alterado enquanto estiver pendente.');
      } else {
        exibirAlerta?.('Erro', 'Não foi possível registrar a solicitação agora.');
      }
    }
  };

  const efetuarAgendamentoDowngrade = async (proximo) => {
    fecharModalAlerta();
    await solicitarMudancaPlano(proximo);
  };

  const prepararUpgrade = (planoUpgrade, valorDiferenca) => {
    fecharModalAlerta();
    setDados(prev => ({ ...prev, valorUpgrade: valorDiferenca, planoUpgradeId: planoUpgrade }));
    setModalCheckoutAberto(true);
  };

  const alterarPlano = (novoPlanoId) => {
    if (!dados || novoPlanoId === dados.planoId || !mapaPlanos[novoPlanoId] || !mapaPlanos[dados.planoId]) return;
    setMenuAberto(false);

    if (dados.status !== 'ativa') {
      efetuarMudancaPlanoDireta(novoPlanoId);
      return;
    }

    const valorNovo = Number(mapaPlanos[novoPlanoId].preco || 0);
    const valorAtual = Number(mapaPlanos[dados.planoId].preco || 0);

    if (valorNovo <= valorAtual) {
      exibirConfirmacao(
        'Agendar mudanca',
        `A mudanca para ${mapaPlanos[novoPlanoId].nome} sera aplicada no proximo vencimento (${dados.vencimentoFormatado}). Ate la, seu plano atual continua ativo.`,
        () => efetuarAgendamentoDowngrade(novoPlanoId)
      );
      return;
    }

    prepararUpgrade(novoPlanoId, valorNovo - valorAtual);
  };

  const cancelarAgendamento = () => {
    if (!dados) return;
    const isUpgrade = Boolean(dados.upgradePendente);

    exibirConfirmacao(
      isUpgrade ? 'Cancelar upgrade' : 'Cancelar mudanca',
      isUpgrade
        ? `Deseja cancelar a solicitacao de upgrade e manter seu plano atual (${dados.planoNome})?`
        : `Deseja cancelar a mudanca agendada e manter seu plano atual (${dados.planoNome})?`,
      async () => {
        fecharModalAlerta();
        try {
          await cancelarMudancaPlano();
          exibirAlerta?.('Cancelado', isUpgrade ? 'A solicitacao de upgrade foi cancelada.' : 'A mudanca agendada foi cancelada.');
        } catch (error) {
          console.error(error);
          exibirAlerta?.('Erro', 'Nao foi possivel cancelar a solicitacao agora.');
        }
      }
    );
  };

  const abrirCheckoutPlano = () => {
    setMenuAberto(false);
    setDados(prev => {
      return {
        ...prev,
        valorUpgrade: null,
        planoPagamentoId: prev?.planoId,
        planoPagamentoNome: prev?.planoNome,
        precoPagamentoPlano: prev?.precoPlano,
      };
    });
    setModalCheckoutAberto(true);
  };

  const solicitarUpgradePendente = async () => {
    if (!dados?.planoUpgradeId) throw new Error('Plano de upgrade nao informado.');

    const { error } = await supabase.rpc('solicitar_upgrade_plano_cliente', {
      p_empresa_id: empresaId,
      p_plano_slug: dados.planoUpgradeId,
    });

    if (error) throw error;
    await carregarDados(clienteIdAtual());
  };

  const abrirWhatsappPagamento = async () => {
    if (!dados || pagamentoLoading) return;
    if (!chavePix) {
      exibirAlerta?.('Pix indisponível', 'A barbearia ainda não configurou uma chave Pix. Escolha pagamento presencial.');
      return;
    }
    if (!whatsappBarbearia) {
      exibirAlerta?.('WhatsApp indisponível', 'A barbearia ainda não configurou o WhatsApp para receber comprovantes.');
      return;
    }
    const isUpgrade = Boolean(dados.valorUpgrade);
    const planoPagamentoId = dados.planoPagamentoId || dados.planoId;
    const planoPagamentoNome = dados.planoPagamentoNome || dados.planoNome;
    let mensagem = `Ola! Me chamo *${dados.nome}*.\n`;

    setPagamentoLoading(true);
    try {
      if (isUpgrade) {
        mensagem += `Estou solicitando o upgrade para o plano *${mapaPlanos[dados.planoUpgradeId]?.nome || 'selecionado'}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
        await solicitarUpgradePendente();
      } else {
        mensagem += `Estou solicitando a ativacao do *Plano ${planoPagamentoNome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
        await solicitarPlano(planoPagamentoId, 'pix');
        localStorage.setItem(`pagamento_plano_${empresaId}_${clienteIdAtual()}_${planoPagamentoId || 'sem-plano'}`, 'iniciado');
      }

      window.open(`https://wa.me/${whatsappBarbearia}?text=${encodeURIComponent(mensagem)}`, '_blank');
      setModalCheckoutAberto(false);
      if (isUpgrade) exibirAlerta?.('Upgrade solicitado', 'Seu pedido de upgrade foi enviado. Aguarde a confirmacao da barbearia.');
    } catch (error) {
      console.error(error);
      const mensagem = String(error?.message || '');
      if (mensagem.includes('solicitacao_plano_pendente')) {
        exibirAlerta?.('Solicitação pendente', 'Já existe um pedido de plano aguardando confirmação da barbearia. Ele não pode ser alterado enquanto estiver pendente.');
      } else if (mensagem.includes('plano_ainda_possui_usos')) {
        exibirAlerta?.('Plano ainda disponível', 'A renovação antecipada fica disponível quando todos os usos do ciclo forem consumidos.');
      } else {
        exibirAlerta?.('Erro', 'Não foi possível registrar o pagamento agora. Tente novamente.');
      }
    } finally {
      setPagamentoLoading(false);
    }
  };

  const confirmarPagamentoPresencial = async () => {
    if (!dados || pagamentoLoading) return;
    const isUpgrade = Boolean(dados.valorUpgrade);
    const planoPagamentoId = dados.planoPagamentoId || dados.planoId;

    setPagamentoLoading(true);
    try {
      if (isUpgrade) {
        await solicitarUpgradePendente();
        exibirAlerta?.('Upgrade solicitado', 'A solicitacao ficou registrada. Pague na barbearia para o admin confirmar.');
      } else {
        await solicitarPlano(planoPagamentoId, 'presencial');
        localStorage.setItem(`pagamento_plano_${empresaId}_${clienteIdAtual()}_${planoPagamentoId || 'sem-plano'}`, 'presencial');
        exibirAlerta?.('Pagamento presencial', 'Sua solicitacao ja esta pendente. Pague na barbearia para o admin confirmar.');
      }
      setModalCheckoutAberto(false);
    } catch (error) {
      console.error(error);
      const mensagem = String(error?.message || '');
      if (mensagem.includes('solicitacao_plano_pendente')) {
        exibirAlerta?.('Solicitação pendente', 'Já existe um pedido de plano aguardando confirmação da barbearia. Ele não pode ser alterado enquanto estiver pendente.');
      } else if (mensagem.includes('plano_ainda_possui_usos')) {
        exibirAlerta?.('Plano ainda disponível', 'A renovação antecipada fica disponível quando todos os usos do ciclo forem consumidos.');
      } else {
        exibirAlerta?.('Erro', 'Não foi possível registrar o pagamento presencial agora.');
      }
    } finally {
      setPagamentoLoading(false);
    }
  };

  return {
    modalCheckoutAberto,
    setModalCheckoutAberto,
    pagamentoLoading,
    pixCopiado,
    copiarPix,
    alterarPlano,
    cancelarAgendamento,
    abrirCheckoutPlano,
    abrirWhatsappPagamento,
    confirmarPagamentoPresencial,
  };
}
