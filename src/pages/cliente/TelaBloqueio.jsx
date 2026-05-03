import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function TelaBloqueio() {
  const navigate = useNavigate();
  const [dados, setDados] = useState({ nome: '', iniciais: '', vencimento: '' });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    const id = localStorage.getItem('clienteId') || sessionStorage.getItem('clienteId');
    if (!id) return;

    // Busca o nome do cliente e a data de vencimento real da assinatura no Supabase
    const { data: cli } = await supabase
      .from('clientes')
      .select('nome, assinaturas(data_vencimento)')
      .eq('id', id)
      .single();

    const vencimentoRaw = cli?.assinaturas?.[0]?.data_vencimento;

    setDados({
      nome: cli?.nome || 'Felipe Nunes',
      iniciais: cli?.nome 
        ? cli.nome.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) 
        : 'FN',
      vencimento: vencimentoRaw 
        ? new Date(vencimentoRaw).toLocaleDateString('pt-BR') 
        : '01/05/2026'
    });
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-10 pb-8 px-5 font-sans">
      
      {/* TÍTULO SUPERIOR NO TOM BRONZE ESTABELECIDO */}
      <h2 className="text-[#b67b36] text-[10px] font-medium tracking-[0.25em] uppercase text-center mb-10">
        Barbearia do João
      </h2>

      {/* CARD DE BLOQUEIO COM BORDA VERMELHA NEON */}
      <div className="w-full max-w-[340px] bg-[#0c0808] border border-[#f83b3b] rounded-[24px] p-6 flex flex-col items-center shadow-[0_0_30px_-10px_rgba(248,59,59,0.15)]">
        
        {/* ÍCONE DE X (ERRO) */}
        <div className="w-24 h-24 bg-[#230b0b] border-2 border-[#421414] rounded-full mb-8 flex items-center justify-center">
          <div className="w-14 h-14 bg-[#f83b3b] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(248,59,59,0.4)]">
             <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
               <line x1="18" y1="6" x2="6" y2="18"></line>
               <line x1="6" y1="6" x2="18" y2="18"></line>
             </svg>
          </div>
        </div>

        {/* TEXTOS DE STATUS EM VERMELHO */}
        <p className="text-[#f83b3b] text-[11px] font-bold uppercase tracking-[0.1em] mb-1">
          Mensalidade Vencida
        </p>
        <h1 className="text-[#f83b3b] text-4xl font-black tracking-tight mb-2">
          BLOQUEADO
        </h1>
        <p className="text-[#621b1b] text-sm mb-10 font-medium">
          Renove sua assinatura
        </p>

        {/* CARD COM INFO DO CLIENTE */}
        <div className="w-full bg-[#0c0808] border border-[#211010] rounded-xl p-4 flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-[#350e0e] rounded-full flex items-center justify-center font-bold text-[#f03c3c] text-sm">
            {dados.iniciais}
          </div>
          <div>
            <p className="font-bold text-[15px] text-white tracking-wide">{dados.nome}</p>
            <p className="text-[11px] text-[#881b1b] font-medium mt-[2px]">Plano 4 Cortes/mês</p>
          </div>
        </div>

        {/* AVISO DE VENCIMENTO COM ÍCONE DE ATENÇÃO */}
        <div className="w-full bg-[#140808] border border-[#2b0f0f] p-4 rounded-xl flex items-start gap-3 mb-6">
           <svg className="text-[#f83b3b] mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
             <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
             <line x1="12" y1="9" x2="12" y2="13"></line>
             <line x1="12" y1="17" x2="12.01" y2="17"></line>
           </svg>
           <p className="text-[#621b1b] text-[11px] font-bold leading-relaxed">
             Assinatura venceu em <span className="text-[#f83b3b]">{dados.vencimento}</span>. Fale com o João para renovar.
           </p>
        </div>

        {/* BOTÃO PARA O WHATSAPP DO JOÃO */}
        <a 
          href="https://wa.me/55" 
          target="_blank"
          rel="noreferrer"
          className="w-full bg-[#f83b3b] hover:bg-[#d43131] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/20"
        >
          {/* ÍCONE DO WHATSAPP */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          Falar com o João
        </a>
      </div>

      <button 
        onClick={() => navigate('/dashboard')}
        className="mt-10 text-zinc-600 text-sm font-medium hover:text-zinc-400 transition-colors"
      >
        Voltar ao início
      </button>
    </div>
  );
}