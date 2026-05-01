import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Tenta fazer o login no Supabase com o usuário que você criou
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Se der tudo certo, redireciona para o painel
      navigate('/admin/dashboard');
    } catch (err) {
      setError('E-mail ou senha incorretos. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-2xl border border-zinc-800 shadow-2xl">
        
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#D4AF37] uppercase tracking-widest">
            Painel do Barbeiro
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            Faça login para gerenciar sua barbearia
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Alerta de Erro */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-lg text-sm text-center font-medium">
              {error}
            </div>
          )}

          {/* Campo E-mail */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#242424] border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-colors"
              placeholder="Seu e-mail cadastrado"
              required
            />
          </div>

          {/* Campo Senha */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#242424] border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-colors"
              placeholder="Sua senha secreta"
              required
            />
          </div>

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}