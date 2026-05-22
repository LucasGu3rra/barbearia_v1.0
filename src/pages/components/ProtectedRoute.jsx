import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { montarRotaEmpresa } from '../../services/empresa';

export const ProtectedRoute = ({ children }) => {
  const { authenticated, loading } = useAuth();
  const { empresaSlug } = useParams();

  if (loading) return null;

  if (!authenticated) {
    return <Navigate to={empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/'} replace />;
  }

  return children;
};
