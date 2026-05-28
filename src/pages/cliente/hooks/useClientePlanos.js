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

  const efetuarMudancaPlanoDireta = async (novoPlano) => {
    await supabase.from('assinaturas').update({ plano_escolhido: novoPlano }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
    carregarDados(clienteIdAtual());
  };

  const efetuarAgendamentoDowngrade = async (proximo) => {
    fecharModalAlerta();
    await supabase.from('assinaturas').update({ proximo_plano: proximo }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
    carregarDados(clienteIdAtual());
  };

  const prepararUpgrade = (planoUpgrade, valorDiferenca) => {
    fecharModalAlerta();
    setDados(prev => ({ ...prev, valorUpgrade: valorDiferenca, planoUpgradeId: planoUpgrade }));
    setModalCheckoutAberto(true);
  };

  const alterarPlano = (novoPlanoId) => {
    if (!dados || novoPlanoId === dados.planoId) return;
    setMenuAberto(false);
    if (dados.status !== 'ativa') {
      efetuarMudancaPlanoDireta(novoPlanoId);
      return;
    }

    const valorNovo = mapaPlanos[novoPlanoId].preco;
    const valorAtual = mapaPlanos[dados.planoId].preco;
    if (valorNovo < valorAtual) {
      exibirConfirmacao('Agendar MudanÃ§a', `A mudanÃ§a para ${mapaPlanos[novoPlanoId].nome} serÃ¡ agendada para seu prÃ³ximo vencimento (${dados.vencimentoFormatado}).`, () => efetuarAgendamentoDowngrade(novoPlanoId));
    } else {
      prepararUpgrade(novoPlanoId, valorNovo - valorAtual);
    }
  };

  const cancelarAgendamento = () => {
    if (!dados) return;
    exibirConfirmacao('Cancelar Agendamento', `Deseja cancelar a mudanÃ§a agendada e manter seu plano atual (${dados.planoNome})?`, async () => {
      fecharModalAlerta();
      await supabase.from('assinaturas').update({ proximo_plano: null }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
      carregarDados(clienteIdAtual());
    });
  };

  const abrirCheckoutPlano = () => {
    setMenuAberto(false);
    setDados(prev => ({ ...prev, valorUpgrade: null }));
    setModalCheckoutAberto(true);
  };

  const abrirWhatsappPagamento = async () => {
    if (!dados) return;
    const isUpgrade = !!dados.valorUpgrade;
    let mensagem = `OlÃ¡! Me chamo *${dados.nome}*.\n`;
    if (isUpgrade) {
      mensagem += `Estou solicitando o upgrade para o plano *${mapaPlanos[dados.planoUpgradeId].nome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
      await supabase.from('assinaturas').update({ upgrade_pendente: dados.planoUpgradeId }).eq('empresa_id', empresaId).eq('cliente_id', clienteIdAtual());
    } else {
      mensagem += `Estou solicitando a ativaÃ§Ã£o do *Plano ${dados.planoNome}*.\nPagamento via: *${metodoPagamento.toUpperCase()}*`;
    }
    if (!isUpgrade) {
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
