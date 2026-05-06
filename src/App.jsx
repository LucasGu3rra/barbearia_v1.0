import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Fluxo de Entrada (Público) */}
          <Route path="/" element={<ClienteLogin />} />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
