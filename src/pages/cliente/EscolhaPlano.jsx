import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function EscolhaPlano() {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null); 

  const planos = [
    { id: 'cabelo', nome: 'Só Cabelo', preco: 'R$ 70', desc: '4 cortes de cabelo por mês' },
    { id: 'barba', nome: 'Só Barba', preco: 'R$ 50', desc: '4 barbas completas por mês' },
    { id: 'completo', nome: 'Cabelo & Barba', preco: 'R$ 110', desc: '4 combos completos por mês' }
  ];

  async function selecionarPlano(planoId) {
    const clienteId = localStorage.getItem('clienteId');
    
    if (!clienteId) {
      alert("Erro: Sessão não encontrada. Por favor, faça login novamente.");
      navigate('/');
      return;
    }

    setLoadingId(planoId); 

    try {
      // 1. Verifica se a assinatura já existe no banco
      const { data: assinaturaExistente, error: erroBusca } = await supabase
        .from('assinaturas')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (erroBusca) throw erroBusca;

      if (assinaturaExistente) {
        // 2. CIRÚRGICO: Atualiza APENAS o plano. 
        // Vencimento e Status ('ativa') continuam intactos!
        const { error: erroUpdate } = await supabase
          .from('assinaturas')
          .update({ plano_escolhido: planoId })
          .eq('cliente_id', clienteId);

        if (erroUpdate) throw erroUpdate;

      } else {
        // 3. Se não existe (usuário de teste antigo ou conta nova bugada), cria do zero.
        const { error: erroInsert } = await supabase
          .from('assinaturas')
          .insert([{ 
            cliente_id: clienteId, 
            plano_escolhido: planoId, 
            status: 'pendente' 
          }]);

        if (erroInsert) throw erroInsert;
      }

      // Sucesso absoluto! Joga o usuário pro dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error("Erro ao salvar plano:", error.message);
      alert("Houve um erro ao salvar sua escolha. Verifique o console.");
      setLoadingId(null); 
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans flex flex-col items-center">
      
      <header className="mb-10 text-center mt-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 bg-[#CEAA6B] rounded-full"></div>
          <span className="text-[#CEAA6B] text-[10px] font-bold tracking-[0.3em] uppercase">
            Barbearia do João
          </span>
        </div>
        <h1 className="text-2xl font-bold">Escolha seu plano</h1>
        <p className="text-zinc-500 text-sm mt-2">Selecione o serviço que deseja contratar</p>
      </header>

      <div className="w-full max-w-[360px] space-y-4">
        {planos.map((plano) => (
          <button
            key={plano.id}
            onClick={() => selecionarPlano(plano.id)}
            disabled={loadingId !== null}
            className={`w-full bg-[#121212] border border-[#27272a] p-6 rounded-[24px] text-left transition-all group ${loadingId !== null ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#CEAA6B]/50 active:scale-[0.98]'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-lg group-hover:text-[#CEAA6B] transition-colors">
                {plano.nome}
              </span>
              <span className="text-[#CEAA6B] font-black text-lg">
                {loadingId === plano.id ? (
                  <span className="text-sm animate-pulse">Salvando...</span>
                ) : (
                  <>
                    {plano.preco}
                    <small className="text-[10px] text-zinc-600 ml-1 uppercase">/mês</small>
                  </>
                )}
              </span>
            </div>
            <p className="text-zinc-500 text-xs font-medium">
              {plano.desc}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-auto mb-6 text-center">
        <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] leading-relaxed">
          O pagamento e a ativação <br/>
          serão realizados diretamente com o João.
        </p>
      </div>
    </div>
  );
}