import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function EscolhaPlano() {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null); 
  const [nomeCliente, setNomeCliente] = useState('');
  
  // Estados do Modal de Checkout
  const [modalAberto, setModalAberto] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [pixCopiado, setPixCopiado] = useState(false);

  // Substitua pela chave PIX e número do João reais
  const CHAVE_PIX = "81988468182";
  const WHATSAPP_JOAO = "5581988468182"; 

  const planos = [
    { id: 'cabelo', nome: 'Só Cabelo', preco: '80', desc: '4 cortes de cabelo por mês' },
    { id: 'barba', nome: 'Só Barba', preco: '60', desc: '4 barbas completas por mês' },
    { id: 'completo', nome: 'Cabelo & Barba', preco: '130', desc: '4 combos completos por mês' }
  ];

  // Puxa o nome do cliente ao abrir a tela para usarmos na mensagem do Zap
  useEffect(() => {
    const buscarNome = async () => {
      const id = localStorage.getItem('clienteId');
      if (id) {
        const { data } = await supabase.from('clientes').select('nome').eq('id', id).single();
        if (data) setNomeCliente(data.nome);
      }
    };
    buscarNome();
  }, []);

  const abrirCheckout = (plano) => {
    setPlanoSelecionado(plano);
    setMetodoPagamento('pix');
    setPixCopiado(false);
    setModalAberto(true);
  };

  const copiarPix = () => {
    navigator.clipboard.writeText(CHAVE_PIX);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 3000);
  };

  async function confirmarContratacao() {
    const clienteId = localStorage.getItem('clienteId');
    if (!clienteId) return navigate('/');

    setLoadingId(planoSelecionado.id);
    setModalAberto(false);

    try {
      // 1. Salva ou atualiza a assinatura como PENDENTE no banco
      const { data: assinaturaExistente } = await supabase.from('assinaturas').select('*').eq('cliente_id', clienteId).maybeSingle();

      if (assinaturaExistente) {
        await supabase.from('assinaturas').update({ plano_escolhido: planoSelecionado.id, status: 'pendente' }).eq('cliente_id', clienteId);
      } else {
        await supabase.from('assinaturas').insert([{ cliente_id: clienteId, plano_escolhido: planoSelecionado.id, status: 'pendente' }]);
      }

      // 2. Monta a mensagem inteligente para o WhatsApp
      let mensagem = `Olá João! Me chamo *${nomeCliente}*.\nAcabei de solicitar o *Plano ${planoSelecionado.nome}* no aplicativo.\n\n`;
      
      if (metodoPagamento === 'pix') {
        mensagem += `💳 Forma de pagamento: *PIX*\nSegue o meu comprovante abaixo:`;
      } else {
        mensagem += `💵 Forma de pagamento: *${metodoPagamento === 'cartao' ? 'Cartão' : 'Dinheiro'}*\nFarei o acerto presencialmente na barbearia para você ativar meu plano!`;
      }

      const urlWhatsapp = `https://wa.me/${WHATSAPP_JOAO}?text=${encodeURIComponent(mensagem)}`;
      
      // 3. Abre o WhatsApp e joga o cliente pro dashboard
      window.open(urlWhatsapp, '_blank');
      navigate('/dashboard');

    } catch (error) {
      alert("Houve um erro ao salvar sua escolha. Tente novamente.");
      setLoadingId(null); 
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans flex flex-col items-center relative">
      
      <header className="mb-10 text-center mt-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 bg-[#CEAA6B] rounded-full"></div>
          <span className="text-[#CEAA6B] text-[10px] font-bold tracking-[0.3em] uppercase">Barbearia do João</span>
        </div>
        <h1 className="text-2xl font-bold">Escolha seu plano</h1>
        <p className="text-zinc-500 text-sm mt-2">Selecione o serviço que deseja contratar</p>
      </header>

      <div className="w-full max-w-[360px] space-y-4">
        {planos.map((plano) => (
          <button
            key={plano.id}
            onClick={() => abrirCheckout(plano)}
            disabled={loadingId !== null}
            className={`w-full bg-[#121212] border border-[#27272a] p-6 rounded-[24px] text-left transition-all group ${loadingId !== null ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#CEAA6B]/50 active:scale-[0.98]'}`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-lg group-hover:text-[#CEAA6B] transition-colors">{plano.nome}</span>
              <span className="text-[#CEAA6B] font-black text-lg">
                {loadingId === plano.id ? <span className="text-sm animate-pulse">Salvando...</span> : <>R$ {plano.preco}<small className="text-[10px] text-zinc-600 ml-1 uppercase">/mês</small></>}
              </span>
            </div>
            <p className="text-zinc-500 text-xs font-medium">{plano.desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-auto pt-8 mb-6 text-center">
        <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] leading-relaxed">
          O pagamento e a ativação <br/>
          serão realizados diretamente com o João.
        </p>
      </div>

      {/* MODAL DE CHECKOUT EXCLUSIVO */}
      {modalAberto && planoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity p-4 sm:p-6 pb-0 sm:pb-6">
          <div className="bg-[#121212] border border-[#27272a] rounded-t-[32px] sm:rounded-[32px] w-full max-w-[400px] p-6 pb-10 sm:pb-6 animate-[slideUp_0.3s_ease-out]">
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Finalizar Contratação</h3>
                <p className="text-[#CEAA6B] font-bold">Plano {planoSelecionado.nome} • R$ {planoSelecionado.preco}/mês</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center bg-[#27272a] text-zinc-400 rounded-full hover:text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Forma de Pagamento</p>
            <div className="grid grid-cols-3 gap-2 mb-6">
              <button onClick={() => setMetodoPagamento('pix')} className={`py-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${metodoPagamento === 'pix' ? 'border-[#25D366] bg-[#25D366]/10 text-[#25D366]' : 'border-[#27272a] bg-[#09090b] text-zinc-500'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span className="text-[10px] font-bold uppercase">PIX</span>
              </button>
              <button onClick={() => setMetodoPagamento('cartao')} className={`py-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${metodoPagamento === 'cartao' ? 'border-[#CEAA6B] bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'border-[#27272a] bg-[#09090b] text-zinc-500'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                <span className="text-[10px] font-bold uppercase">Cartão</span>
              </button>
              <button onClick={() => setMetodoPagamento('dinheiro')} className={`py-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${metodoPagamento === 'dinheiro' ? 'border-[#CEAA6B] bg-[#CEAA6B]/10 text-[#CEAA6B]' : 'border-[#27272a] bg-[#09090b] text-zinc-500'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle></svg>
                <span className="text-[10px] font-bold uppercase">Dinheiro</span>
              </button>
            </div>

            {metodoPagamento === 'pix' ? (
              <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 mb-6">
                <p className="text-zinc-400 text-xs mb-3">1. Copie a chave PIX abaixo e faça o pagamento no seu banco.</p>
                <div className="flex gap-2">
                  <input readOnly value={CHAVE_PIX} className="flex-1 bg-[#121212] text-[#25D366] font-medium text-sm px-3 py-2.5 rounded-lg border border-[#27272a] outline-none" />
                  <button onClick={copiarPix} className="bg-[#27272a] text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase hover:bg-[#3f3f46] transition-colors">
                    {pixCopiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="text-zinc-400 text-xs mt-4">2. Depois, clique no botão verde para enviar o comprovante.</p>
              </div>
            ) : (
              <div className="bg-[#09090b] border border-[#27272a] rounded-2xl p-4 mb-6 text-center">
                <p className="text-zinc-400 text-sm">Você pagará na barbearia.</p>
                <p className="text-zinc-500 text-xs mt-1">Seu plano só será ativado após o acerto com o João.</p>
              </div>
            )}

            <button onClick={confirmarContratacao} className={`w-full font-bold text-sm uppercase tracking-wider py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 ${metodoPagamento === 'pix' ? 'bg-[#25D366] text-black hover:bg-[#20b858]' : 'bg-[#CEAA6B] text-black hover:bg-[#b08f55]'}`}>
              {metodoPagamento === 'pix' ? 'Confirmar e Enviar PIX' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}} />
    </div>
  );
}