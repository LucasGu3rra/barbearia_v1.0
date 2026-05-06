import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './pages/components/ProtectedRoute';

// Páginas do Cliente
import ClienteLogin from './pages/cliente/ClienteLogin';
import ClienteCadastro from './pages/cliente/ClienteCadastro';
import EsqueciSenha from './pages/cliente/EsqueciSenha';
import RedefinirSenha from './pages/cliente/RedefinirSenha';
import EscolhaPlano from './pages/cliente/EscolhaPlano';
import ClienteDashboard from './pages/cliente/ClienteDashboard';
import TelaCorte from './pages/cliente/TelaCorte';
import TelaBloqueio from './pages/cliente/TelaBloqueio';

// Páginas do Admin
import AdminDashboard from './pages/admin/AdminDashboard';

// Componente para gerenciar a rota inicial "/"
// Ele decide se manda para o Login ou para o Dashboard correto baseado no banco de dados
const InitialRoute = () => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return null; // Espera o Supabase e o AuthContext carregarem

  if (user) {
    // Agora usamos a flag isAdmin que vem do banco de dados via AuthContext
    if (isAdmin) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <ClienteLogin />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota Inicial Inteligente */}
          <Route path="/" element={<InitialRoute />} />
          
          {/* Fluxo de Entrada (Público) */}
          <Route path="/cadastro" element={<ClienteCadastro />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/planos" element={<EscolhaPlano />} />
          
          {/* Área do Cliente (Protegida) */}
          <Route path="/dashboard" element={<ProtectedRoute><ClienteDashboard /></ProtectedRoute>} />
          <Route path="/confirmado" element={<ProtectedRoute><TelaCorte /></ProtectedRoute>} />
          <Route path="/bloqueado" element={<ProtectedRoute><TelaBloqueio /></ProtectedRoute>} />
          
          {/* Área do Administrador (Protegida) */}
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

          {/* ROTA DE SEGURANÇA (CATCH-ALL) */}
          {/* Se qualquer rota não existir, volta para o início que redirecionará corretamente */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
