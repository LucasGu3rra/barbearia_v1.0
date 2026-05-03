import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function TelaCorte() {
  const navigate = useNavigate();
  const [dados, setDados] = useState({ nome: '', cortes: 0, vencimento: '' });

  useEffect(() => {
    carregarDadosValidacao();
  }, []);

  async function carregarDadosValidacao() {
    const id = localStorage.getItem('clienteId') || sessionStorage.getItem('clienteId');
    if (!id) return;

    const { data: cli } = await supabase
      .from('clientes')
      .select('nome, assinaturas(data_vencimento)')
      .eq('id', id).single();

    const { count } = await supabase
      .from('historico_cortes')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', id);

    setDados({
      nome: cli?.nome || 'Marcos Oliveira',
      cortes: count || 0,
      vencimento: cli?.assinaturas?.[0]?.data_vencimento 
        ? new Date(cli.assinaturas[0].data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '01/06'
    });
  }

  // Path SVG de uma tesoura de barbeiro aberta
  const scissorsPath = "M9.64,7.64 C9.87,7.14 10,6.59 10,6 C10,3.79 8.21,2 6,2 C3.79,2 2,3.79 2,6 C2,8.21 3.79,10 6,10 C6.59,10 7.14,9.87 7.64,9.64 L10,12 L7.64,14.36 C7.14,14.13 6.59,14 6,14 C3.79,14 2,15.79 2,18 C2,20.21 3.79,22 6,22 C8.21,22 10,20.21 10,18 C10,17.41 9.87,16.86 9.64,16.36 L12,14 L19,21 H22 V20 L9.64,7.64 Z M6,8 C4.9,8 4,7.1 4,6 C4,4.9 4.9,4 6,4 C7.1,4 8,4.9 8,6 C8,7.1 7.1,8 6,8 Z M6,20 C4.9,20 4,19.1 4,18 C4,16.9 4.9,16 6,16 C7.1,16 8,16.9 8,18 C8,19.1 7.1,20 6,20 Z M19,3 L12,10 L14,12 L22,4 V3 H19 Z";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center pt-10 pb-8 px-5 font-sans relative">
      
      {/* HEADER */}
      <h2 className="text-[#b67b36] text-[10px] font-medium tracking-[0.25em] uppercase text-center mb-8">
        Barbearia do João
      </h2>

      {/* CARD PRINCIPAL */}
      <div className="w-full max-w-[340px] bg-[#08100a] border border-[#1bc64d] rounded-[24px] p-6 flex flex-col items-center shadow-[0_0_30px_-10px_rgba(27,198,77,0.15)]">
        
        {/* ÁREA DO ÍCONE 3D */}
        <div className="w-24 h-24 bg-[#0b1e11] border-2 border-[#143d21] rounded-full mb-6 flex items-center justify-center shadow-[0_0_20px_inset_rgba(59,248,118,0.1)] overflow-hidden">
          
          {/* CENA 3D CSS */}
          <div className="scene flex items-center justify-center w-full h-full">
            <div className="scissor-3d w-12 h-12 relative">
              {/* Empilhamos as camadas da tesoura com a nova cor neon */}
              {[...Array(5)].map((_, i) => (
                <svg 
                  key={i} 
                  viewBox="0 0 24 24" 
                  className="absolute inset-0 w-full h-full"
                  style={{ 
                    transform: `translateZ(${(i - 2) * 4}px)`,
                    filter: i === 0 || i === 4 ? 'drop-shadow(0 0 4px #3bf876)' : 'none'
                  }}
                >
                  <path 
                    d={scissorsPath} 
                    fill="none" 
                    stroke="#3bf876" 
                    strokeWidth="0.8" 
                    className="opacity-80"
                  />
                </svg>
              ))}
            </div>
          </div>
        </div>

        {/* TEXTOS CENTRAIS */}
        <p className="text-[#22a04c] text-[11px] font-bold uppercase tracking-[0.1em] mb-1">
          Mensalidade em dia
        </p>
        <h1 className="text-[#3bf876] text-4xl font-black tracking-tight mb-2 drop-shadow-[0_0_8px_rgba(59,248,118,0.3)]">
          LIBERADO
        </h1>
        <p className="text-[#1b6231] text-sm mb-8 font-medium">
          Pode fazer o corte!
        </p>
        
        {/* CAIXA DE NOME DO CLIENTE */}
        <div className="w-full bg-[#070c08] border border-[#102115] rounded-xl p-3 flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-[#0e351d] rounded-full flex items-center justify-center font-bold text-[#3cf072] text-sm">
            {dados.nome.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-[15px] text-white tracking-wide">{dados.nome}</p>
            <p className="text-[11px] text-[#1b8841] font-medium mt-[2px]">Plano 4 Cortes/mês</p>
          </div>
        </div>

        {/* CAIXAS DE DADOS GRID */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-[#070c08] border border-[#102115] p-4 rounded-xl text-center">
            <p className="text-[#16582a] text-[9px] font-bold uppercase tracking-wide mb-2">Cortes Restantes</p>
            <p className="text-2xl font-bold text-[#3df474]">{4 - dados.cortes} <span className="text-[#197034] text-[11px] font-medium">de 4</span></p>
          </div>
          <div className="bg-[#070c08] border border-[#102115] p-4 rounded-xl text-center">
            <p className="text-[#16582a] text-[9px] font-bold uppercase tracking-wide mb-2">Vencimento</p>
            <p className="text-2xl font-bold text-[#3df474]">{dados.vencimento}</p>
          </div>
        </div>
      </div>

      {/* RODAPÉ E BOTÃO CAMUFLADOS */}
      <div className="mt-8 mb-6 text-center">
        <p className="text-[#2a2a2a] text-[11px] font-medium mb-6">Mostre esta tela ao barbeiro</p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-[#070707] border border-[#1c1c1c] text-[#3f3f3f] px-6 py-2.5 rounded-lg text-sm font-medium hover:text-[#555] transition-colors"
        >
          Voltar ao início
        </button>
      </div>

      {/* CSS PARA A ANIMAÇÃO 3D DA TESOURA */}
      <style dangerouslySetInnerHTML={{ __html: `
        .scene {
          perspective: 600px;
        }
        .scissor-3d {
          transform-style: preserve-3d;
          animation: spin3D 4s linear infinite;
        }
        @keyframes spin3D {
          0% { transform: rotateX(-15deg) rotateY(0deg) rotateZ(10deg); }
          100% { transform: rotateX(-15deg) rotateY(360deg) rotateZ(10deg); }
        }
      `}} />
    </div>
  );
}