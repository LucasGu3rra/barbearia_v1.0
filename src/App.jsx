import { BrowserRouter, Routes, Route } from 'react-router-dom';

import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

import ClienteLogin from './pages/cliente/ClienteLogin';
import ClienteDashboard from './pages/cliente/ClienteDashboard';
import TelaCorte from './pages/cliente/TelaCorte';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        <Route path="/:slug" element={<ClienteLogin />} />
        <Route path="/:slug/dashboard" element={<ClienteDashboard />} />
        <Route path="/:slug/corte" element={<TelaCorte />} />
      </Routes>
    </BrowserRouter>
  );
}