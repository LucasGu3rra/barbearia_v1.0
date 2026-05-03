import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Páginas do Cliente
import ClienteLogin from './pages/cliente/ClienteLogin';
import ClienteCadastro from './pages/cliente/ClienteCadastro';
import EscolhaPlano from './pages/cliente/EscolhaPlano';
import ClienteDashboard from './pages/cliente/ClienteDashboard';
import TelaCorte from './pages/cliente/TelaCorte';
import TelaBloqueio from './pages/cliente/TelaBloqueio';

// Páginas do Admin
import AdminDashboard from './pages/admin/AdminDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Fluxo de Entrada */}
        <Route path="/" element={<ClienteLogin />} />
        <Route path="/cadastro" element={<ClienteCadastro />} />
        <Route path="/planos" element={<EscolhaPlano />} />
        
        {/* Área do Cliente */}
        <Route path="/dashboard" element={<ClienteDashboard />} />
        <Route path="/confirmado" element={<TelaCorte />} />
        <Route path="/bloqueado" element={<TelaBloqueio />} />
        
        {/* Área do Administrador */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}