import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const handleSession = async (session) => {
      if (!session?.user) {
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      try {
        // 1. Salva o ID no cache IMEDIATAMENTE, evitando o loop infinito do ClienteDashboard
        localStorage.setItem('clienteId', session.user.id);
        
        // 2. Busca no banco se é admin (Sem risco de Lock)
        const { data, error } = await supabase
          .from('clientes')
          .select('eh_admin')
          .eq('id', session.user.id)
          .single();

        if (error) throw error;

        if (isMounted) {
          setUser(session.user);
          setIsAdmin(data?.eh_admin || false);
        }
      } catch (error) {
        console.error("Erro AuthContext:", error);
        if (isMounted) {
          setUser(session.user);
          setIsAdmin(false);
        }
      } finally {
        // 3. Libera o carregamento SÓ QUANDO sabe para onde você vai
        if (isMounted) setLoading(false); 
      }
    };

    // Fica escutando qualquer login ou carregamento de página
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      if (event === 'SIGNED_OUT') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Trava a tela (mostra null/branco rápido) até a função de cima terminar
      setLoading(true);
      handleSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, authenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);