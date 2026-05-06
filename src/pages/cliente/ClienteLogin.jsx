import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import logo from '../../assets/logo.png'; // IMPORTANDO A LOGO AQUI

export default function ClienteLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (authError) throw new Error('E-mail ou senha incorretos.');

      // APAGAMOS TODO O RESTO! Não coloque "navigate" aqui.
      // Quando o signIn for um sucesso, o AuthContext percebe sozinho, 
      // faz a checagem no banco e o App.jsx te redireciona automaticamente!

    } catch (error) {
      alert(error.message);
      setLoading(false); // Só volta o botão ao normal se der erro
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center px-6 font-sans">
      
      {/* 1. LOGO FORA DO CONTAINER */}
      <div className="mb-8 flex justify-center">
        <img 
          src={logo} 
          alt="Barbearia do João" 
          className="w-32 h-32 rounded-full border-[3px] border-[#CEAA6B]/40 shadow-[0_0_20px_rgba(206,170,107,0.15)] object-cover"
        />
      </div>

      {/* CONTAINER PRINCIPAL DO FORMULÁRIO */}
      <div className="w-full max-w-[360px] bg-[#121212] border border-[#27272a] rounded-[28px] p-8 shadow-2xl">
        
        {/* 2. NOME BEM-VINDO NO CONTAINER */}
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Bem-vindo</h1>
          <p className="text-zinc-500 text-xs mt-1">Faça login para acessar sua conta</p>
        </header>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">E-mail</label>
            <input required type="email" className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B]" 
              placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Senha</label>
            <div className="relative">
              <input required type={verSenha ? "text" : "password"} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B]" 
                placeholder="••••••" value={senha} onChange={e => setSenha(e.target.value)} />
              <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute right-4 top-4 text-zinc-600">
                {verSenha ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl active:scale-95 transition-all">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* 3. LINKS REORGANIZADOS (Cadastro primeiro, Esqueci a senha embaixo) */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button onClick={() => navigate('/cadastro')} className="w-full text-zinc-500 text-sm">
            Ainda não tem conta? <span className="text-[#CEAA6B] font-bold underline">Cadastre-se</span>
          </button>

          <button 
            type="button"
            onClick={() => navigate('/esqueci-senha')} 
            className="text-zinc-600 hover:text-white text-xs font-bold transition-colors"
          >
            Esqueceu sua senha?
          </button>
        </div>

      </div>
    </div>
  );
}