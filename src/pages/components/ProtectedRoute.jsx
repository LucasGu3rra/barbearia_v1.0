import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { montarRotaEmpresa } from '../../services/empresa';

const destinoPorPapel = (papel, empresaSlug) => {
  if (['dono', 'admin'].includes(papel)) {
    return montarRotaEmpresa(empresaSlug, '/admin/dashboard');
  }

  if (papel === 'barbeiro') {
    return montarRotaEmpresa(empresaSlug, '/barbeiro/dashboard');
  }

  if (papel === 'cliente') {
    return montarRotaEmpresa(empresaSlug, '/dashboard');
  }

  return montarRotaEmpresa(empresaSlug, '');
};

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { authenticated, loading, papelEmpresa, empresaAtual } = useAuth();
  const { empresaSlug } = useParams();
  const slugAtual = empresaAtual?.slug || empresaSlug;

  if (loading) return null;

  if (!authenticated) {
    return <Navigate to={empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/'} replace />;
  }

  if (allowedRoles.length > 0) {
    if (!papelEmpresa) return null;

    if (!allowedRoles.includes(papelEmpresa)) {
      return <Navigate to={destinoPorPapel(papelEmpresa, slugAtual)} replace />;
    }
  }

  return children;
};
