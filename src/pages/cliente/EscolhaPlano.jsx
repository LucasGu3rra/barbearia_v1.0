import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';

export default function EscolhaPlano() {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState(null); 
  const [nomeCliente, setNomeCliente] = useState('');
  
  // Controle de exibição (Avulsos vs Planos)
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  
  // Estados do Modal de Checkout
  const [modalAberto, setModalAberto] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [metodoPagamento, setMetodoPagamento] = useState('pix');
  const [pixCopiado, setPixCopiado] = useState(false);

  const CHAVE_PIX = "81988468182";
  const WHATSAPP_JOAO = "5581988468182"; 

  const [planos, setPlanos] = useState([]);
  const [carregandoPlanos, setCarregandoPlanos] = useState(true);

  // Serviços avulsos vindos do banco
  const [servicosAvulsos, setServicosAvulsos] = useState([]);
  const [carregandoServicos, setCarregandoServicos] = useState(true);

  useEffect(() => {
    const buscarDados = async () => {
      try {
        // Busca planos e serviços em paralelo
        const [{ data: dadosPlanos, error: errPlanos }, { data: dadosServicos, error: errServicos }] = await Promise.all([
          supabase.from('planos').select('*').eq('ativo', true).order('preco', { ascending: true }),
          supabase.from('servicos').select('*').eq('ativo', true).order('created_at', { ascending: true }),
        ]);

        if (errPlanos) throw errPlanos;
        if (errServicos) throw errServicos;

        setPlanos(dadosPlanos || []);
        setServicosAvulsos(dadosServicos || []);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setCarregandoPlanos(false);
        setCarregandoServicos(false);
      }
    };
    buscarDados();
  }, []);

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

    setLoadingId(planoSelecionado.slug);
    setModalAberto(false);

    try {
      const { data: assinaturaExistente } = await supabase.from('assinaturas').select('*').eq('cliente_id', clienteId).maybeSingle();

      if (assinaturaExistente) {
        await supabase.from('assinaturas').update({ plano_escolhido: planoSelecionado.slug, status: 'pendente' }).eq('cliente_id', clienteId);
      } else {
        await supabase.from('assinaturas').insert([{ cliente_id: clienteId, plano_escolhido: planoSelecionado.slug, status: 'pendente' }]);
      }

      let mensagem = `Olá João! Me chamo *${nomeCliente}*.\nAcabei de solicitar o *Plano ${planoSelecionado.nome}* no aplicativo.\n\n`;
      
      if (metodoPagamento === 'pix') {
        mensagem += `💳 Forma de pagamento: *PIX*\nSegue o meu comprovante abaixo:`;
      } else {
        mensagem += `💵 Forma de pagamento: *${metodoPagamento === 'cartao' ? 'Cartão' : 'Dinheiro'}*\nFarei o acerto presencialmente na barbearia para você ativar meu plano!`;
      }

      const urlWhatsapp = `https://wa.me/${WHATSAPP_JOAO}?text=${encodeURIComponent(mensagem)}`;
      
      window.open(urlWhatsapp, '_blank');
      navigate('/dashboard');

    } catch (error) {
      alert("Houve um erro ao salvar sua escolha. Tente novamente.");
      setLoadingId(null); 
    }
  }

  // Calcula a economia de um plano com base nos serviços cadastrados:
  // Usa o serviço de maior preço como referência (pior caso = mais economia visível)
  const calcularEconomiaDinamica = (nomePlano, precoPlano, limitePlano) => {
    if (servicosAvulsos.length === 0) return 0;

    // Tenta encontrar um serviço cujo nome bate com o nome do plano
    const nomeLower = nomePlano.toLowerCase();
    let servicoRef = servicosAvulsos.find(s => nomeLower.includes(s.nome.toLowerCase()));

    // Se não encontrou, usa o serviço de maior preço como referência
    if (!servicoRef) {
      servicoRef = [...servicosAvulsos].sort((a, b) => b.preco - a.preco)[0];
    }

    const limite = limitePlano || 4;
    return (Number(servicoRef.preco) * limite) - Number(precoPlano);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans flex flex-col items-center relative overflow-x-hidden">
      
      <header className="mb-8 text-center mt-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 bg-[#CEAA6B] rounded-full"></div>
          <span className="text-[#CEAA6B] text-[10px] font-bold tracking-[0.3em] uppercase">Barbearia do João</span>
        </div>
        <h1 className="text-2xl font-bold">{mostrarPlanos ? 'Escolha sua Assinatura' : 'Nossos Serviços'}</h1>
        <p className="text-zinc-500 text-sm mt-2">
          {mostrarPlanos ? 'Selecione o plano ideal para você' : 'Veja quanto você pode economizar'}
        </p>
      </header>

      <div className="w-full max-w-[360px] flex-1">
        
        {/* TELA 1: SERVIÇOS AVULSOS */}
        {!mostrarPlanos ? (
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-in-out]">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-1 mb-2">Serviços Avulsos</p>
            
            {carregandoServicos ? (
              <div className="text-center text-[#CEAA6B] animate-pulse py-10 text-xs uppercase tracking-widest">Carregando serviços...</div>
            ) : servicosAvulsos.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[#27272a] rounded-2xl">
                <p className="text-zinc-600 text-xs italic">Nenhum serviço disponível no momento.</p>
              </div>
            ) : (
              servicosAvulsos.map((servico) => {
                // Referência: gasto em 4x no mês vs plano mais barato disponível
                const gastoRotinaNormal = Number(servico.preco) * 4;
                // Pega o plano mais barato para mostrar a comparação
                const planoCheap = planos.length > 0 ? planos[0] : null;
                const precoPlanoRef = planoCheap ? Number(planoCheap.preco) : null;
                const economiaTotal = precoPlanoRef !== null
                  ? (Number(servico.preco) * (planoCheap.limite || 4)) - precoPlanoRef
                  : null;

                return (
                  <div key={servico.id} className="bg-[#121212] border border-[#27272a] p-5 rounded-[24px]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-lg text-white">{servico.nome}</span>
                      <span className="text-zinc-400 font-medium">R$ {Number(servico.preco).toFixed(0)}</span>
                    </div>
                    
                    {/* Caixa de Destaque da Economia */}
                    <div className="bg-[#1a120b] border border-[#CEAA6B]/30 rounded-xl p-4 relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#CEAA6B]/10 blur-xl rounded-full"></div>
                      
                      <p className="text-zinc-400 text-xs mb-1 relative z-10">
                        Cortando só 4x no mês você já gastaria{' '}
                        <span className="line-through text-red-400/80">R$ {gastoRotinaNormal.toFixed(0)}</span>
                      </p>
                      
                      {planoCheap && economiaTotal !== null && (
                        <div className="flex justify-between items-end mt-2 relative z-10">
                          <div>
                            <p className="text-[#CEAA6B] font-bold text-sm">
                              No Plano ({planoCheap.limite} cortes): R$ {Number(planoCheap.preco).toFixed(0)}
                            </p>
                          </div>
                          {economiaTotal > 0 && (
                            <div className="bg-[#CEAA6B] text-black text-[9px] font-black uppercase px-2 py-1 rounded shadow-[0_0_8px_rgba(206,170,107,0.4)] whitespace-nowrap ml-2">
                              Economize R$ {economiaTotal.toFixed(0)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* BOTÃO CHAMATIVO PARA IR AOS PLANOS */}
            <div className="pt-4 pb-8">
              <button 
                onClick={() => setMostrarPlanos(true)}
                className="w-full bg-[#CEAA6B] text-black font-black uppercase tracking-wider py-4 rounded-xl shadow-[0_0_20px_rgba(206,170,107,0.3)] animate-pulse hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
              >
                Ver Planos com Desconto
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
        ) : (
          
          /* TELA 2: LISTA DE PLANOS DO BANCO DE DADOS */
          <div className="space-y-4 animate-[fadeIn_0.3s_ease-in-out]">
            <button 
              onClick={() => setMostrarPlanos(false)}
              className="mb-2 text-[#CEAA6B] text-xs font-bold uppercase tracking-widest flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
              Voltar aos serviços
            </button>

            {carregandoPlanos ? (
              <div className="text-center text-[#CEAA6B] animate-pulse py-10">Carregando planos...</div>
            ) : (
              planos.map((plano) => {
                const economiaCalculada = calcularEconomiaDinamica(plano.nome, plano.preco, plano.limite);

                return (
                  <button
                    key={plano.slug}
                    onClick={() => abrirCheckout(plano)}
                    disabled={loadingId !== null}
                    className={`w-full bg-[#121212] border border-[#27272a] p-6 rounded-[24px] text-left transition-all relative overflow-hidden group ${loadingId !== null ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#CEAA6B]/50 active:scale-[0.98]'}`}
                  >
                    {economiaCalculada > 0 && (
                      <div className="absolute top-0 right-0 bg-[#CEAA6B] text-black text-[8px] font-black uppercase px-3 py-1 rounded-bl-lg">
                        Economia de R$ {economiaCalculada.toFixed(0)}
                      </div>
                    )}

                    <div className="flex justify-between items-end mb-2 mt-2">
                      <div>
                        <span className="block font-bold text-lg text-white group-hover:text-[#CEAA6B] transition-colors">{plano.nome}</span>
                        <span className="text-zinc-500 text-xs font-medium">{plano.limite} cortes garantidos</span>
                      </div>
                      <div className="text-right">
                        {economiaCalculada > 0 && (
                          <span className="block text-zinc-500 text-[10px] line-through mb-0.5">
                            Valor Real R$ {(Number(plano.preco) + economiaCalculada).toFixed(0)}
                          </span>
                        )}
                        <span className="text-[#CEAA6B] font-black text-xl">
                          {loadingId === plano.slug 
                            ? <span className="text-sm animate-pulse">Salvando...</span> 
                            : <>R$ {Number(plano.preco).toFixed(0)}<small className="text-[10px] text-zinc-600 ml-1 uppercase">/mês</small></>
                          }
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 mb-4 text-center">
        <p className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] leading-relaxed">
          O pagamento e a ativação <br/>
          serão realizados diretamente na barbearia.
        </p>
      </div>

      {/* MODAL DE CHECKOUT */}
      {modalAberto && planoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity p-4 sm:p-6 pb-0 sm:pb-6">
          <div className="bg-[#121212] border border-[#27272a] rounded-t-[32px] sm:rounded-[32px] w-full max-w-[400px] p-6 pb-10 sm:pb-6 animate-[slideUp_0.3s_ease-out]">
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Finalizar Contratação</h3>
                <p className="text-[#CEAA6B] font-bold">Plano {planoSelecionado.nome} • R$ {Number(planoSelecionado.preco).toFixed(0)}/mês</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center bg-[#27272a] text-zinc-400 rounded-full text-sm font-bold">✕</button>
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
                <p className="text-zinc-500 text-xs mt-1">Seu plano só será ativado após o acerto na barbearia.</p>
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
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
