import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { getEmpresaPorSlug, limparSessaoPreservandoEmpresa, montarRotaEmpresa } from '../../../services/empresa';
import logo from '../../../assets/logo.png';

const EMAIL_LEMBRADO_KEY = 'loginEmailLembrado';

export default function ClienteLogin() {
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_LEMBRADO_KEY) || '');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroLogin, setErroLogin] = useState('');
  const [lembrarEmail, setLembrarEmail] = useState(() => Boolean(localStorage.getItem(EMAIL_LEMBRADO_KEY)));
  const navigate = useNavigate();
  const { empresaSlug } = useParams();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErroLogin('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (authError) throw new Error('E-mail ou senha incorretos.');

      const userId = authData.user?.id;
      if (userId && empresaSlug) {
        const empresa = await getEmpresaPorSlug(empresaSlug);
        if (!empresa) throw new Error('Barbearia nao encontrada ou inativa.');

        const { data: vinculo } = await supabase
          .from('usuarios_empresas')
          .select('papel')
          .eq('user_id', userId)
          .eq('empresa_id', empresa.id)
          .maybeSingle();

        if (!vinculo?.papel) {
          await supabase.auth.signOut();
          limparSessaoPreservandoEmpresa();
          throw new Error('Essa conta nao pertence a esta barbearia.');
        }

        localStorage.setItem('clienteId', userId);
        sessionStorage.setItem('clienteId', userId);
      }

      if (lembrarEmail) {
        localStorage.setItem(EMAIL_LEMBRADO_KEY, email.trim().toLowerCase());
      } else {
        localStorage.removeItem(EMAIL_LEMBRADO_KEY);
      }
    } catch (error) {
      setErroLogin(error.message || 'Nao foi possivel entrar. Verifique seus dados.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center px-6 font-sans">
      <div className="mb-8 flex justify-center">
        <img
          src={logo}
          alt="Logo da barbearia"
          className="w-32 h-32 rounded-full border-[3px] border-[#CEAA6B]/40 shadow-[0_0_20px_rgba(206,170,107,0.15)] object-cover"
        />
      </div>

      <div className="w-full max-w-[360px] bg-[#121212] border border-[#27272a] rounded-[28px] p-8 shadow-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Bem-vindo</h1>
          <p className="text-zinc-500 text-xs mt-1">Faca login para acessar sua conta</p>
        </header>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">E-mail</label>
            <input
              required
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B]"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErroLogin('');
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative">
              <input
                required
                type={verSenha ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B]"
                placeholder="Senha"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErroLogin('');
                }}
              />
              <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute right-4 top-4 text-zinc-600">
                {verSenha ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          <label className="flex items-center justify-between rounded-2xl bg-[#09090b] px-4 py-3 text-sm text-zinc-400">
            <span>Lembrar e-mail neste aparelho</span>
            <input
              type="checkbox"
              checked={lembrarEmail}
              onChange={(e) => setLembrarEmail(e.target.checked)}
              className="h-4 w-4 accent-[#CEAA6B]"
            />
          </label>

          {erroLogin && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{erroLogin}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl active:scale-95 transition-all">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button onClick={() => navigate(montarRotaEmpresa(empresaSlug, '/cadastro'))} className="w-full text-zinc-500 text-sm">
            Ainda nao tem conta? <span className="text-[#CEAA6B] font-bold underline">Cadastre-se</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(montarRotaEmpresa(empresaSlug, '/esqueci-senha'))}
            className="text-zinc-600 hover:text-white text-xs font-bold transition-colors"
          >
            Esqueceu sua senha?
          </button>
        </div>
      </div>
    </div>
  );
}
