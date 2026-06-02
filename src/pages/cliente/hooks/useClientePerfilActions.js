import { signOutWithPushCleanup } from '../../../services/authSession';
import { limparSessaoPreservandoEmpresa, montarRotaEmpresa } from '../../../services/empresa';

export default function useClientePerfilActions({
  empresaId,
  clienteIdAtual,
  navigate,
  slugEmpresa,
  setMenuAberto,
}) {
  const fecharMenu = () => {
    setMenuAberto(false);
  };

  const handleLogout = async () => {
    await signOutWithPushCleanup({ empresaId, userId: clienteIdAtual() });
    limparSessaoPreservandoEmpresa();
    navigate(montarRotaEmpresa(slugEmpresa, ''));
  };

  return {
    fecharMenu,
    handleLogout,
  };
}
