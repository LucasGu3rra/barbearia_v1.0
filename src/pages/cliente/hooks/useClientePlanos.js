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
  exibirConfirmacao,
  fecharModalAlerta,
  setMenuAberto,
}) {
  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);
  const [metodoPagamento] = useState('pix');
  const [pixCopiado, setPixCopiado] = useState(false);

  const copiarPix = () => {
    navigator.clipboard.writeText(chavePix);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 3000);
  };

  const atualizarAssinatura = async (payload) => {
    await supabase
      .from('assinaturas')
      .update(payload)
      .eq('empresa_id', empresaId)
      .eq('cliente_id', clienteIdAtual());
    carregarDados(clienteIdAtual());
  };

  const efetuarMudancaPlanoDireta = async (novoPlano) => {
    await atualizarAssinatura({ plano_escolhido: novoPlano });
  };

  const efetuarAgendamentoDowngrade = async (proximo) => {
    fecharModalAlerta();
    await atualizarAssinatura({ proximo_plano: proximo });
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

    if (valorNovo < valorAtual) {
      exibirConfirmacao(
        'Agendar mudança',
        `A mudança para ${mapaPlanos[novoPlanoId].nome} será aplicada no próximo vencimento (${dados.vencimentoFormatado}). Até lá, seu plano atual continua ativo.`,
        () => efetuarAgendamentoDowngrade(novoPlanoId)
      );
      return;
    }

    prepararUpgrade(novoPlanoId, valorNovo - valorAtual);
  };

  const cancelarAgendamento = () => {
    if (!dados) return;
    exibirConfirmacao(
      'Cancelar mudança',
      `Deseja cancelar a mudança agendada e manter seu plano atual (${dados.planoNome})?`,
      async () => {
        fecharModalAlerta();
        await atualizarAssinatura({ proximo_plano: null });
      }
    );
  };

  const abrirCheckoutPlano = () => {
    setMenuAberto(false);
    setDados(prev => ({ ...prev, valorUpgrade: null }));
    setModalCheckoutAberto(true);
  };

  const abrirWhatsappPagamento = async () => {
    if (!dados) return;
    const isUpgrade = Boolean(dados.valorUpgrade);
    let mensagem = `Olá! Me chamo *${dados.nome}*.\n`;

    if (isUpgrade) {
      mensagem += `Estou solicitando o upgrade para o plano *${mapaPlanos[dados.planoUpgradeId].nome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
      await supabase
        .from('assinaturas')
        .update({ upgrade_pendente: dados.planoUpgradeId })
        .eq('empresa_id', empresaId)
        .eq('cliente_id', clienteIdAtual());
    } else {
      mensagem += `Estou solicitando a ativação do *Plano ${dados.planoNome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
      localStorage.setItem(`pagamento_plano_${empresaId}_${clienteIdAtual()}_${dados.planoId || 'sem-plano'}`, 'iniciado');
    }

    window.open(`https://wa.me/${whatsappBarbearia}?text=${encodeURIComponent(mensagem)}`, '_blank');
    setModalCheckoutAberto(false);
    if (isUpgrade) carregarDados(clienteIdAtual());
  };

  return {
    modalCheckoutAberto,
    setModalCheckoutAberto,
    pixCopiado,
    copiarPix,
    alterarPlano,
    cancelarAgendamento,
    abrirCheckoutPlano,
    abrirWhatsappPagamento,
  };
}
