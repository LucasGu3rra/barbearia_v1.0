import { useState } from 'react';
import { signOutWithPushCleanup } from '../../../services/authSession';
import { limparSessaoPreservandoEmpresa, montarRotaEmpresa } from '../../../services/empresa';
import { supabase } from '../../../services/supabase';

export default function useClientePerfilActions({
  dados,
  empresaId,
  clienteIdAtual,
  carregarDados,
  navigate,
  slugEmpresa,
  setMenuAberto,
}) {
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const fecharMenu = () => {
    setMenuAberto(false);
    setEditandoNome(false);
  };

  const salvarNovoNome = async () => {
    if (!novoNome.trim() || novoNome === dados.nome) return setEditandoNome(false);
    await supabase.from('clientes').update({ nome: novoNome, alteracoes_nome: dados.alteracoesNome + 1 }).eq('empresa_id', empresaId).eq('id', clienteIdAtual());
    carregarDados(clienteIdAtual());
    setEditandoNome(false);
  };

  const handleLogout = async () => {
    await signOutWithPushCleanup({ empresaId, userId: clienteIdAtual() });
    limparSessaoPreservandoEmpresa();
    navigate(montarRotaEmpresa(slugEmpresa, ''));
  };

  return {
    editandoNome,
    setEditandoNome,
    novoNome,
    setNovoNome,
    fecharMenu,
    salvarNovoNome,
    handleLogout,
  };
}
