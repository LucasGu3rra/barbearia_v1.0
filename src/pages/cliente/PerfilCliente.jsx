import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function PerfilCliente() {
  const navigate = useNavigate();
  const [dados, setDados] = useState({ nome: '', whatsapp: '', plano: '' });
  const [loading, setLoading] = useState(true);

  const precos = { cabelo: 70, barba: 50, completo: 110 };
  const nomesPlanos = { cabelo: 'Só Cabelo', barba: 'Só Barba', completo: 'Cabelo & Barba' };

  useEffect(() => {
    carregarPerfil();
  }, []);

  async function carregarPerfil() {
    const id = localStorage.getItem('clienteId');
    const { data: cli } = await supabase
      .from('clientes')
      .select('nome, whatsapp, assinaturas(plano_escolhido)')
      .eq('id', id).single();

    if (cli) {
      setDados({
        nome: cli.nome,
        whatsapp: cli.whatsapp,
        plano: cli.assinaturas?.[0]?.plano_escolhido || 'cabelo'
      });
    }
    setLoading(false);
  }

  async function alterarPlano(novoPlano) {
    if (novoPlano === dados.plano) return;

    const diferenca = precos[novoPlano] - precos[dados.plano];
    const mensagem = diferenca > 0 
      ? `Para mudar para ${nomesPlanos[novoPlano]}, você pagará uma diferença de R$ ${diferenca} ao João hoje. O vencimento continua o mesmo. Confirma?`
      : `Deseja mudar para ${nomesPlanos[novoPlano]}? Não haverá reembolso da diferença, e a mudança valerá imediatamente. Confirma?`;

    if (window.confirm(mensagem)) {
      const id = localStorage.getItem('clienteId');
      const { error } = await supabase
        .from('assinaturas')
        .update({ plano_escolhido: novoPlano })
        .eq('cliente_id', id);

      if (!error) {
        alert("Plano alterado com sucesso!");
        carregarPerfil();
      }
    }
  }

  if (loading) return <div className="min-h-screen bg-[#09090b]"></div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans">
      <button onClick={() => navigate('/dashboard')} className="mb-8 text-zinc-500 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span className="text-xs font-bold uppercase tracking-widest">Painel</span>
      </button>

      <h1 className="text-2xl font-bold mb-8">Meu Perfil</h1>

      {/* DADOS PESSOAIS */}
      <div className="space-y-4 mb-10">
        <div className="bg-[#121212] border border-[#27272a] p-4 rounded-2xl">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nome</label>
          <p className="text-white font-medium mt-1">{dados.nome}</p>
        </div>
        <div className="bg-[#121212] border border-[#27272a] p-4 rounded-2xl">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">WhatsApp</label>
          <p className="text-white font-medium mt-1">{dados.whatsapp}</p>
        </div>
      </div>

      {/* ALTERAR PLANO */}
      <h2 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4">Mudar meu Plano</h2>
      <div className="grid gap-3">
        {Object.keys(precos).map((p) => (
          <button
            key={p}
            onClick={() => alterarPlano(p)}
            className={`p-4 rounded-2xl border text-left flex justify-between items-center transition-all ${
              dados.plano === p ? 'border-[#CEAA6B] bg-[#1a120b]' : 'border-[#27272a] bg-[#121212]'
            }`}
          >
            <div>
              <p className={`font-bold ${dados.plano === p ? 'text-[#CEAA6B]' : 'text-white'}`}>{nomesPlanos[p]}</p>
              <p className="text-[10px] text-zinc-500 mt-1">R$ {precos[p]}/mês</p>
            </div>
            {dados.plano === p && <div className="bg-[#CEAA6B] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase">Atual</div>}
          </button>
        ))}
      </div>
    </div>
  );
}