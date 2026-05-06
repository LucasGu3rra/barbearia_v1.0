import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Com dois ../../



export const ProtectedRoute = ({ children }) => {
  const { authenticated, loading } = useAuth();

  if (loading) return null; // Ou um componente de "Carregando..."

  if (!authenticated) {
    return <Navigate to="/" />;
  }

  return children;
};
