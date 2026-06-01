import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PwaInstallProvider } from './contexts/PwaInstallContext';
import { PushNotificationProvider } from './contexts/PushNotificationContext';
import { useAuth } from './contexts/useAuth';
import { ProtectedRoute } from './pages/components/ProtectedRoute';
import { limparSessaoPreservandoEmpresa, montarRotaEmpresa, obterUltimaEmpresaSlug, salvarUltimaEmpresaSlug } from './services/empresa';
import { supabase } from './services/supabase';

import ClienteLogin from './pages/cliente/auth/ClienteLogin';
import ClienteCadastro from './pages/cliente/auth/ClienteCadastro';
import EsqueciSenha from './pages/cliente/auth/EsqueciSenha';
import RedefinirSenha from './pages/cliente/auth/RedefinirSenha';
import EscolhaPlano from './pages/cliente/planos/EscolhaPlano';
import ClienteDashboard from './pages/cliente/dashboard/ClienteDashboard';
import TelaCorte from './pages/cliente/status/TelaCorte';
import TelaBloqueio from './pages/cliente/status/TelaBloqueio';
import AdminDashboard from './pages/admin/AdminDashboard';
import BarbeiroDashboard from './pages/barbeiro/BarbeiroDashboard';
import MasterDashboard from './pages/master/MasterDashboard';

const AcessoPorLink = () => (
  <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center px-6 font-sans">
    <div className="w-full max-w-[360px] bg-[#121212] border border-[#27272a] rounded-[28px] p-8 shadow-2xl text-center">
      <h1 className="text-2xl font-bold text-white">Acesso pelo link</h1>
      <p className="text-zinc-500 text-sm mt-3">
        Use o link completo da barbearia para entrar ou criar uma conta.
      </p>
    </div>
  </div>
);

const RootRoute = () => {
  const ultimaEmpresaSlug = obterUltimaEmpresaSlug();
  if (ultimaEmpresaSlug) return <Navigate to={montarRotaEmpresa(ultimaEmpresaSlug, '')} replace />;
  return <AcessoPorLink />;
};

const EmpresaAtivaRoute = ({ children }) => {
  const { empresaSlug } = useParams();
  const { user, selecionarEmpresaPorSlug } = useAuth();
  const [slugValido, setSlugValido] = useState(null);
  const [limpandoSessao, setLimpandoSessao] = useState(false);

  useEffect(() => {
    let ativo = true;

    const prepararEmpresa = async () => {
      if (!empresaSlug) {
        if (ativo) setSlugValido(false);
        return;
      }

      try {
        const resultado = await selecionarEmpresaPorSlug(empresaSlug);
        if (!ativo) return;

        const empresaExiste = Boolean(resultado.empresa);
        setSlugValido(empresaExiste);
        if (empresaExiste) salvarUltimaEmpresaSlug(resultado.empresa.slug);

        if (empresaExiste && user && !resultado.papel) {
          setLimpandoSessao(true);
          limparSessaoPreservandoEmpresa();
          await supabase.auth.signOut();
          if (ativo) setLimpandoSessao(false);
        }
      } catch {
        if (ativo) setSlugValido(false);
      }
    };

    prepararEmpresa();

    return () => {
      ativo = false;
    };
  }, [empresaSlug, selecionarEmpresaPorSlug, user]);

  if (slugValido === null || limpandoSessao) return null;
  if (!slugValido) return <AcessoPorLink />;

  return children;
};

const InitialRoute = () => {
  const { empresaSlug } = useParams();
  const { user, isAdmin, empresaAtual, selecionarEmpresaPorSlug } = useAuth();
  const [slugValido, setSlugValido] = useState(null);
  const [usuarioComAcesso, setUsuarioComAcesso] = useState(false);
  const [papelAcesso, setPapelAcesso] = useState(null);
  const [limpandoSessao, setLimpandoSessao] = useState(false);

  useEffect(() => {
    let ativo = true;

    const prepararEmpresa = async () => {
      if (!empresaSlug) {
        if (ativo) setSlugValido(false);
        return;
      }

      try {
        const resultado = await selecionarEmpresaPorSlug(empresaSlug);
        if (!ativo) return;

        const empresaExiste = Boolean(resultado.empresa);
        setSlugValido(empresaExiste);
        setUsuarioComAcesso(Boolean(user && resultado.papel));
        setPapelAcesso(resultado.papel || null);
        if (empresaExiste) salvarUltimaEmpresaSlug(resultado.empresa.slug);

        if (empresaExiste && user && !resultado.papel) {
          setLimpandoSessao(true);
          limparSessaoPreservandoEmpresa();
          await supabase.auth.signOut();
          if (ativo) setLimpandoSessao(false);
        }
      } catch {
        if (ativo) setSlugValido(false);
      }
    };

    prepararEmpresa();

    return () => {
      ativo = false;
    };
  }, [empresaSlug, selecionarEmpresaPorSlug, user]);

  if (slugValido === null || limpandoSessao) return null;
  if (!slugValido) return <AcessoPorLink />;

  if (user) {
    if (!usuarioComAcesso || !empresaAtual || empresaAtual.slug !== empresaSlug) {
      return null;
    }

    if (isAdmin) {
      return <Navigate to={montarRotaEmpresa(empresaAtual.slug, '/admin/dashboard')} replace />;
    }

    if (papelAcesso === 'barbeiro') {
      return <Navigate to={montarRotaEmpresa(empresaAtual.slug, '/barbeiro/dashboard')} replace />;
    }

    return <Navigate to={montarRotaEmpresa(empresaAtual.slug, '/dashboard')} replace />;
  }

  return <ClienteLogin />;
};

export default function App() {
  return (
    <AuthProvider>
      <PwaInstallProvider>
        <PushNotificationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/cadastro" element={<AcessoPorLink />} />
              <Route path="/esqueci-senha" element={<AcessoPorLink />} />
              <Route path="/redefinir-senha" element={<AcessoPorLink />} />
              <Route path="/planos" element={<AcessoPorLink />} />

              <Route path="/dashboard" element={<AcessoPorLink />} />
              <Route path="/confirmado" element={<AcessoPorLink />} />
              <Route path="/bloqueado" element={<AcessoPorLink />} />
              <Route path="/admin/dashboard" element={<AcessoPorLink />} />
              <Route path="/barbeiro/dashboard" element={<AcessoPorLink />} />
              <Route path="/master" element={<MasterDashboard />} />

              <Route path="/:empresaSlug/login" element={<InitialRoute />} />
              <Route path="/:empresaSlug" element={<InitialRoute />} />
              <Route path="/:empresaSlug/cadastro" element={<EmpresaAtivaRoute><ClienteCadastro /></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/esqueci-senha" element={<EmpresaAtivaRoute><EsqueciSenha /></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/redefinir-senha" element={<EmpresaAtivaRoute><RedefinirSenha /></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/planos" element={<EmpresaAtivaRoute><ProtectedRoute allowedRoles={['cliente']}><EscolhaPlano /></ProtectedRoute></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/admin/dashboard" element={<EmpresaAtivaRoute><ProtectedRoute allowedRoles={['dono', 'admin']}><AdminDashboard /></ProtectedRoute></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/barbeiro/dashboard" element={<EmpresaAtivaRoute><ProtectedRoute allowedRoles={['barbeiro']}><BarbeiroDashboard /></ProtectedRoute></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/dashboard" element={<EmpresaAtivaRoute><ProtectedRoute allowedRoles={['cliente']}><ClienteDashboard /></ProtectedRoute></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/confirmado" element={<EmpresaAtivaRoute><ProtectedRoute allowedRoles={['cliente']}><TelaCorte /></ProtectedRoute></EmpresaAtivaRoute>} />
              <Route path="/:empresaSlug/bloqueado" element={<EmpresaAtivaRoute><ProtectedRoute allowedRoles={['cliente']}><TelaBloqueio /></ProtectedRoute></EmpresaAtivaRoute>} />
              <Route path="*" element={<AcessoPorLink />} />
            </Routes>
          </BrowserRouter>
        </PushNotificationProvider>
      </PwaInstallProvider>
    </AuthProvider>
  );
}
