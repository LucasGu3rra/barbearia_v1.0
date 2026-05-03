import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function ClienteCadastro() {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState(''); // Trocamos 'usuario' por 'email'
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  const [verSenha, setVerSenha] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleWhatsappChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length <= 11) {
      value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
      value = value.replace(/(\d{5})(\d)/, "$1-$2");
      setWhatsapp(value);
    }
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    if (whatsapp.length < 14) return alert('Insira um WhatsApp válido.');
    if (senha.length < 6) return alert('A senha deve ter no mínimo 6 dígitos.');
    if (senha !== confirmarSenha) return alert('As senhas não coincidem!');

    setLoading(true);

    try {
      // 1. Cria o usuário no sistema de Autenticação do Supabase (Criptografa a senha)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Erro ao criar usuário de autenticação.');

      const userId = authData.user.id;

      // 2. Insere os dados complementares na nossa tabela 'clientes' usando o ID seguro
      const { error: dbError } = await supabase
        .from('clientes')
        .insert([{ 
          id: userId, 
          nome, 
          whatsapp, 
          email: email.trim().toLowerCase(), 
          eh_admin: false 
        }]);

      if (dbError) throw dbError;

      // 3. Salva a sessão no navegador e avança para os planos
      localStorage.setItem('clienteId', userId);
      navigate('/planos');

    } catch (error) {
      // O Supabase retorna as mensagens em inglês por padrão, podemos traduzir algumas comuns
      let msg = error.message;
      if (msg.includes('User already registered')) msg = "Este e-mail já está cadastrado.";
      alert('Erro ao cadastrar: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const EyeIcon = ({ visible }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {visible ? (
        <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></>
      ) : (
        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></>
      )}
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center pt-6 pb-10 px-6 font-sans">
      <button onClick={() => navigate('/')} className="self-start mb-6 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
      </button>

      <div className="w-full max-w-[360px] bg-[#121212] border border-[#27272a] rounded-[28px] p-8 shadow-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Criar sua conta</h1>
        </header>

        <form onSubmit={handleCadastro} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
            <input required className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" 
              placeholder="Digite seu nome" value={nome} onChange={e => setNome(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">WhatsApp</label>
            <input required className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" 
              placeholder="(00) 00000-0000" value={whatsapp} onChange={handleWhatsappChange} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">E-mail</label>
            <input required type="email" className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" 
              placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Senha (Mín. 6 dígitos)</label>
            <div className="relative">
              <input required type={verSenha ? "text" : "password"} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" 
                placeholder="••••••" value={senha} onChange={e => setSenha(e.target.value)} />
              <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute right-4 top-4 text-zinc-600">
                <EyeIcon visible={verSenha} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
            <div className="relative">
              <input required type={verConfirmar ? "text" : "password"} className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" 
                placeholder="••••••" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} />
              <button type="button" onClick={() => setVerConfirmar(!verConfirmar)} className="absolute right-4 top-4 text-zinc-600">
                <EyeIcon visible={verConfirmar} />
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl mt-4 active:scale-95 transition-all">
            {loading ? 'Criando conta...' : 'Finalizar Cadastro'}
          </button>
        </form>
      </div>
    </div>
  );
}