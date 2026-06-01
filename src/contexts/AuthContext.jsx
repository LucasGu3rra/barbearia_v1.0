import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getEmpresaPorSlug, limparSessaoPreservandoEmpresa, salvarUltimaEmpresaSlug } from '../services/empresa';
import { AuthContext } from './AuthContextObject';

const sincronizarClienteStorage = (papel, userId) => {
  if (typeof window === 'undefined') return;

  if (papel === 'cliente' && userId) {
    window.localStorage.setItem('clienteId', userId);
    window.sessionStorage.setItem('clienteId', userId);
    return;
  }

  window.localStorage.removeItem('clienteId');
  window.sessionStorage.removeItem('clienteId');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [empresaAtual, setEmpresaAtual] = useState(null);
  const [papelEmpresa, setPapelEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  const selecionarEmpresaPorSlug = useCallback(async (slug) => {
    if (!slug) {
      setEmpresaAtual(null);
      setPapelEmpresa(null);
      setIsAdmin(false);
      sincronizarClienteStorage(null);
      return { empresa: null, papel: null, isAdmin: false };
    }

    const empresa = await getEmpresaPorSlug(slug);
    if (!empresa) {
      setEmpresaAtual(null);
      setPapelEmpresa(null);
      setIsAdmin(false);
      sincronizarClienteStorage(null);
      return { empresa: null, papel: null, isAdmin: false };
    }

    salvarUltimaEmpresaSlug(empresa.slug);

    if (!user?.id) {
      setEmpresaAtual(empresa);
      setPapelEmpresa(null);
      setIsAdmin(false);
      sincronizarClienteStorage(null);
      return { empresa, papel: null, isAdmin: false };
    }

    const { data: vinculo, error } = await supabase
      .from('usuarios_empresas')
      .select('papel')
      .eq('user_id', user.id)
      .eq('empresa_id', empresa.id)
      .maybeSingle();

    if (error) throw error;

    const papel = vinculo?.papel || null;
    const admin = ['dono', 'admin'].includes(papel);

    setEmpresaAtual(empresa);
    setPapelEmpresa(papel);
    setIsAdmin(admin);
    sincronizarClienteStorage(papel, user.id);

    return { empresa, papel, isAdmin: admin };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const handleSession = async (session) => {
      if (!session?.user) {
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          setEmpresaAtual(null);
          setPapelEmpresa(null);
          sincronizarClienteStorage(null);
          setLoading(false);
        }
        return;
      }

      try {
        sincronizarClienteStorage(null);
        if (isMounted) {
          setUser(session.user);
          setIsAdmin(false);
          setEmpresaAtual(null);
          setPapelEmpresa(null);
        }
      } catch (error) {
        console.error('Erro AuthContext:', error);
        if (isMounted) {
          setUser(session.user);
          setIsAdmin(false);
          setEmpresaAtual(null);
          setPapelEmpresa(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const carregarSessaoInicial = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        await handleSession(data.session);
      } catch (error) {
        console.error('Erro ao restaurar sessao:', error);
        if (isMounted) setLoading(false);
      }
    };

    carregarSessaoInicial();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        limparSessaoPreservandoEmpresa();
      }

      setLoading(true);
      handleSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      empresaAtual,
      papelEmpresa,
      loading,
      authenticated: !!user,
      selecionarEmpresaPorSlug,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
