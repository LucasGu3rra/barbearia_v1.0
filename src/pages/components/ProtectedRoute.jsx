import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { authenticated, loading } = useAuth();

  if (loading) return null;

  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};
