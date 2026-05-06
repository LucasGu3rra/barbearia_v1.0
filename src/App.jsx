import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './pages/components/ProtectedRoute';

// Páginas do Cliente e Admin (mantenha os seus imports iguais)
import ClienteLogin from './pages/cliente/ClienteLogin';
import ClienteCadastro from './pages/cliente/ClienteCadastro';
import EsqueciSenha from './pages/cliente/EsqueciSenha';
import RedefinirSenha from './pages/cliente/RedefinirSenha';
import EscolhaPlano from './pages/cliente/EscolhaPlano';
import ClienteDashboard from './pages/cliente/ClienteDashboard';
import TelaCorte from './pages/cliente/TelaCorte';
import TelaBloqueio from './pages/cliente/TelaBloqueio';
import AdminDashboard from './pages/admin/AdminDashboard';

const InitialRoute = () => {
  const { user, isAdmin } = useAuth();
  
  if (user) {
    // Se o AuthContext disse que é Admin, vai para o Admin. Sem erro.
    return isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />;
  }
  return <ClienteLogin />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<InitialRoute />} />
          <Route path="/cadastro" element={<ClienteCadastro />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/planos" element={<EscolhaPlano />} />
          
          <Route path="/dashboard" element={<ProtectedRoute><ClienteDashboard /></ProtectedRoute>} />
          <Route path="/confirmado" element={<ProtectedRoute><TelaCorte /></ProtectedRoute>} />
          <Route path="/bloqueado" element={<ProtectedRoute><TelaBloqueio /></ProtectedRoute>} />
          
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
