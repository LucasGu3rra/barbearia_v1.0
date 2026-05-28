import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { montarRotaEmpresa } from '../../../services/empresa';

export default function RedefinirSenha() {
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  // ESTADOS DOS OLHINHOS
  const [verSenha, setVerSenha] = useState(false);
  const [verConfirmarSenha, setVerConfirmarSenha] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [sessaoValida, setSessaoValida] = useState(true);
  const navigate = useNavigate();
  const { empresaSlug } = useParams();

  // Quando a tela abre, o Supabase lê a URL do e-mail para validar o acesso
  useEffect(() => {
    const verificarLink = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSessaoValida(false);
        setMensagem({ tipo: 'erro', texto: 'Link inválido ou expirado. Por favor, solicite a recuperação novamente.' });
      }
    };
    verificarLink();
  }, []);

  const handleAtualizarSenha = async (e) => {
    e.preventDefault();
    
    if (senha !== confirmarSenha) {
      return setMensagem({ tipo: 'erro', texto: 'As senhas não coincidem.' });
    }
    if (senha.length < 6) {
      return setMensagem({ tipo: 'erro', texto: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    setLoading(true);
    setMensagem(null);

    try {
      // Atualiza a senha no banco do Supabase
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;

      setMensagem({ tipo: 'sucesso', texto: 'Senha atualizada com sucesso! Redirecionando para o login...' });
      
      // Desloga o usuário da sessão temporária e manda pra tela inicial após 3 segundos
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/');
      }, 3000);

    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar a nova senha: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-[340px]">
        
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 bg-[#CEAA6B] rounded-full"></div>
            <span className="text-[#CEAA6B] text-[10px] font-bold tracking-[0.3em] uppercase">Barbearia do João</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Criar nova senha</h2>
          <p className="text-zinc-500 text-sm">Digite sua nova senha de acesso abaixo.</p>
        </div>

        {mensagem && (
          <div className={`p-4 rounded-xl text-xs font-medium border mb-6 ${mensagem.tipo === 'sucesso' ? 'bg-[#25D366]/10 border-[#25D366]/20 text-[#25D366]' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            {mensagem.texto}
          </div>
        )}

        {sessaoValida ? (
          <form onSubmit={handleAtualizarSenha} className="space-y-4">
            
            {/* CAMPO NOVA SENHA */}
            <div className="relative">
              <input
                type={verSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Nova senha"
                required
                className="w-full bg-[#121212] border border-[#27272a] rounded-2xl py-4 px-5 outline-none focus:border-[#CEAA6B] text-sm text-white placeholder-zinc-600 transition-colors"
              />
              <button 
                type="button" 
                onClick={() => setVerSenha(!verSenha)} 
                className="absolute right-4 top-[18px] text-zinc-600 hover:text-white transition-colors"
              >
                {verSenha ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>

            {/* CAMPO CONFIRMAR SENHA */}
            <div className="relative">
              <input
                type={verConfirmarSenha ? "text" : "password"}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Confirme a nova senha"
                required
                className="w-full bg-[#121212] border border-[#27272a] rounded-2xl py-4 px-5 outline-none focus:border-[#CEAA6B] text-sm text-white placeholder-zinc-600 transition-colors"
              />
              <button 
                type="button" 
                onClick={() => setVerConfirmarSenha(!verConfirmarSenha)} 
                className="absolute right-4 top-[18px] text-zinc-600 hover:text-white transition-colors"
              >
                {verConfirmarSenha ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !senha || !confirmarSenha}
              className="w-full bg-[#CEAA6B] hover:bg-[#c09d60] disabled:bg-[#27272a] disabled:text-zinc-500 text-black font-bold py-4 rounded-2xl transition-all active:scale-95 mt-2"
            >
              {loading ? 'Salvando...' : 'Atualizar Senha'}
            </button>
          </form>
        ) : (
          <button 
            onClick={() => navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '/esqueci-senha') : '/esqueci-senha')} 
            className="w-full bg-[#27272a] text-white font-bold py-4 rounded-2xl mt-4"
          >
            Solicitar novo link
          </button>
        )}

      </div>
    </div>
  );
}
