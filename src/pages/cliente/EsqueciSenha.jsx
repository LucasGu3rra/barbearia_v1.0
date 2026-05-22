import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';// Ajuste o caminho se sua pasta for diferente

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const navigate = useNavigate();

  const handleRecuperarSenha = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setMensagem(null);

    try {
      // O Supabase dispara o e-mail e redireciona o usuário de volta para o app
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:5173/redefinir-senha', // Para onde ele volta depois de clicar no email
      });

      if (error) throw error;
      
      setMensagem({ 
        tipo: 'sucesso', 
        texto: 'Link enviado! Verifique sua caixa de entrada (e o Spam) para redefinir sua senha.' 
      });
    } catch (error) {
      setMensagem({ 
        tipo: 'erro', 
        texto: 'Erro ao tentar enviar o e-mail: ' + error.message 
      });
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
          <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
          <p className="text-zinc-500 text-sm">Digite seu e-mail para receber um link de redefinição.</p>
        </div>

        <form onSubmit={handleRecuperarSenha} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full bg-[#121212] border border-[#27272a] rounded-2xl py-4 px-5 outline-none focus:border-[#CEAA6B] text-sm text-white placeholder-zinc-600 transition-colors"
            />
          </div>

          {mensagem && (
            <div className={`p-4 rounded-xl text-xs font-medium border ${mensagem.tipo === 'sucesso' ? 'bg-[#25D366]/10 border-[#25D366]/20 text-[#25D366]' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              {mensagem.texto}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-[#CEAA6B] hover:bg-[#c09d60] disabled:bg-[#27272a] disabled:text-zinc-500 text-black font-bold py-4 rounded-2xl transition-all active:scale-95"
          >
            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate('/')} 
            className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 w-full"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Voltar para o Login
          </button>
        </div>

      </div>
    </div>
  );
}
