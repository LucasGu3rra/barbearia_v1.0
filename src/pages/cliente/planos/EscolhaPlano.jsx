import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../contexts/useAuth';
import { getEmpresaPorSlug, montarRotaEmpresa, normalizarTelefoneBrasil } from '../../../services/empresa';

const formatarMoeda = (valor) => `R$${Number(valor || 0).toFixed(0)}`;
const limitarTexto = (texto = '', limite = 30) => {
  const limpo = String(texto || '').trim();
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, limite - 3).trimEnd()}...`;
};

function Icon({ name, className = 'w-5 h-5' }) {
  const icons = {
    arrow: <path d="m15 18-6-6 6-6" />,
    check: <path d="M20 6 9 17l-5-5" />,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><rect x="2" y="2" width="13" height="13" rx="2" /></>,
    money: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></>,
    whatsapp: <><path d="M3 21 4.8 16.3A8.5 8.5 0 1 1 8 19.2L3 21z" /><path d="M9 9c.2 3 2.8 5.3 6 6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v4h1" /></>,
    store: <><path d="M3 9h18l-1-5H4L3 9z" /><path d="M5 9v10h14V9" /><path d="M9 19v-6h6v6" /></>,
    trend: <><path d="m3 7 6 6 4-4 8 8" /><path d="M21 10v7h-7" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.check}
    </svg>
  );
}

export default function EscolhaPlano() {
  const navigate = useNavigate();
  const { empresaSlug } = useParams();
  const { user, empresaAtual } = useAuth();
  const [empresa, setEmpresa] = useState(empresaAtual);
  const [loadingId, setLoadingId] = useState(null);
  const [nomeCliente, setNomeCliente] = useState('');
  const [planoSelecionado, setPlanoSelecionado] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [avisoPresencialAberto, setAvisoPresencialAberto] = useState(false);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [popularPlanoSlug, setPopularPlanoSlug] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const chavePix = empresa?.chave_pix || '81988468182';
  const whatsappBarbearia = normalizarTelefoneBrasil(empresa?.whatsapp || '5581988468182');

  useEffect(() => {
    const buscarDados = async () => {
      try {
        if (empresaAtual && empresaSlug && empresaAtual.slug !== empresaSlug) {
          navigate(montarRotaEmpresa(empresaSlug, ''));
          return;
        }

        const empresaBase = empresaAtual || await getEmpresaPorSlug(empresaSlug);
        if (!empresaBase) {
          navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/');
          return;
        }

        setEmpresa(empresaBase);
        const [
          { data: dadosPlanos, error: errPlanos },
          { data: dadosAssinaturas, error: errAssinaturas },
        ] = await Promise.all([
          supabase.from('planos').select('*').eq('empresa_id', empresaBase.id).eq('ativo', true).is('deleted_at', null).order('preco', { ascending: true }),
          supabase.from('assinaturas').select('plano_escolhido, status').eq('empresa_id', empresaBase.id).in('status', ['ativa', 'pendente']),
        ]);

        if (errPlanos) throw errPlanos;
        if (errAssinaturas) throw errAssinaturas;

        const planosAtivos = dadosPlanos || [];
        const contagemPlanos = (dadosAssinaturas || []).reduce((acc, assinatura) => {
          if (!assinatura.plano_escolhido) return acc;
          acc[assinatura.plano_escolhido] = (acc[assinatura.plano_escolhido] || 0) + 1;
          return acc;
        }, {});
        const planoPopular = planosAtivos
          .map((plano, index) => ({ slug: plano.slug, total: contagemPlanos[plano.slug] || 0, index }))
          .sort((a, b) => b.total - a.total || a.index - b.index)[0];

        setPlanos(planosAtivos);
        setPlanoSelecionado(planosAtivos[0] || null);
        setPopularPlanoSlug(planoPopular?.slug || planosAtivos[0]?.slug || null);
      } catch (error) {
        console.error('Erro ao carregar planos:', error);
      } finally {
        setCarregando(false);
      }
    };

    buscarDados();
  }, [empresaAtual, empresaSlug, navigate]);

  useEffect(() => {
    const buscarNome = async () => {
      const id = user?.id;
      const empresaId = empresa?.id || empresaAtual?.id;
      if (!id || !empresaId) return;

      const { data } = await supabase.from('clientes').select('nome').eq('empresa_id', empresaId).eq('id', id).maybeSingle();
      if (data) setNomeCliente(data.nome);
    };

    buscarNome();
  }, [empresa, empresaAtual, user?.id]);

  const voltar = () => {
    const slug = empresa?.slug || empresaAtual?.slug || empresaSlug;
    navigate(montarRotaEmpresa(slug, '/dashboard'));
  };

  const copiarPix = () => {
    navigator.clipboard.writeText(chavePix);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 2000);
  };

  const confirmarPagamentoPresencial = () => {
    setAvisoPresencialAberto(true);
  };

  const continuarPagamentoPresencial = () => {
    setAvisoPresencialAberto(false);
    confirmarContratacao(false);
  };

  const beneficiosPlano = (plano) => {
    const limite = Number(plano?.limite || 0);
    return [
      plano?.ilimitado ? 'Limite ilimitado' : limite > 0 ? `Limite: ${limite} cortes/mês` : 'Limite mensal',
      'Confirmação presencial',
      'Benefícios no corte',
    ];
  };

  async function confirmarContratacao(enviarWhatsapp = true) {
    const clienteId = user?.id;
    if (!clienteId) return navigate(montarRotaEmpresa(empresaSlug, ''));
    if (!planoSelecionado) return;

    setLoadingId(planoSelecionado.slug);
    setModalAberto(false);

    try {
      const empresaId = empresa?.id || empresaAtual?.id;
      const empresaSlugDestino = empresa?.slug || empresaAtual?.slug || empresaSlug;
      if (!empresaId || !empresaSlugDestino) throw new Error('Empresa inválida.');

      const { error: assinaturaError } = await supabase.rpc('solicitar_plano_cliente', {
        p_empresa_id: empresaId,
        p_plano_slug: planoSelecionado.slug,
      });

      if (assinaturaError) throw assinaturaError;

      if (enviarWhatsapp) {
        const mensagem = `Olá! Me chamo *${nomeCliente}*.\nAcabei de solicitar o *Plano ${planoSelecionado.nome}* no aplicativo.\n\nForma de pagamento: *PIX*\nSegue o meu comprovante abaixo:`;
        window.open(`https://wa.me/${whatsappBarbearia}?text=${encodeURIComponent(mensagem)}`, '_blank');
      }

      navigate(montarRotaEmpresa(empresaSlugDestino, '/dashboard'));
    } catch (error) {
      console.error('Erro ao contratar plano:', error);
      alert('Houve um erro ao salvar sua escolha. Tente novamente.');
      setLoadingId(null);
    }
  }

  return (
    <div className="client-page-root">
      <div className="client-device">
        <div className="back-bar">
          <button className="back-btn" onClick={voltar}>
            <Icon name="arrow" className="w-4 h-4" />
          </button>
          <span className="back-title">Planos mensais</span>
        </div>

        <div className="scroll" style={{ paddingTop: 12 }}>
          <div className="alert ok">
            <Icon name="trend" className="w-5 h-5 flex-shrink-0" />
            <div className="alert-txt">
              Com plano você paga menos por corte e mantém sua assinatura organizada.
            </div>
          </div>

          {carregando ? (
            <div className="text-center text-[#d5b451] animate-pulse py-10 text-xs uppercase tracking-widest">Carregando planos...</div>
          ) : planos.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[#333] rounded-[12px]">
              <p className="text-zinc-600 text-xs italic">Nenhum plano disponível no momento.</p>
            </div>
          ) : (
            <div className="plan-grid">
              {planos.map((plano) => {
                const selecionado = planoSelecionado?.slug === plano.slug;
                const popular = popularPlanoSlug === plano.slug;

                return (
                  <button
                    key={plano.slug}
                    type="button"
                    className={`plan-card ${popular ? 'featured' : ''} ${selecionado ? 'sel' : ''}`}
                    onClick={() => setPlanoSelecionado(plano)}
                    disabled={loadingId !== null}
                  >
                    <div className="plan-chk">
                      <Icon name="check" className="w-3 h-3" />
                    </div>
                    {popular && <div className="pop-label">Popular</div>}
                    <div className="plan-name" title={plano.nome}>{limitarTexto(plano.nome)}</div>
                    <div className="plan-price">
                      <span className="val">{Number(plano.preco || 0).toFixed(0)}</span>
                      <span className="per">/mês</span>
                    </div>
                    <ul className="plan-feats">
                      {beneficiosPlano(plano).map((beneficio) => (
                        <li key={beneficio}>
                          <Icon name="check" className="w-3 h-3 text-[#d5b451] flex-shrink-0" />
                          {beneficio}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          <button className="btn primary" disabled={!planoSelecionado || loadingId !== null} onClick={() => setModalAberto(true)}>
            {loadingId ? 'Salvando...' : 'Contratar plano'}
          </button>
          <button className="btn ghost" onClick={voltar}>Agora não</button>
        </div>
      </div>

      {modalAberto && planoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm p-0">
          <div className="client-device relative max-w-none h-full min-h-0 overflow-hidden flex flex-col border-x-0">
            <div className="back-bar flex-shrink-0">
              <button className="back-btn" onClick={() => setModalAberto(false)}>
                <Icon name="arrow" className="w-4 h-4" />
              </button>
              <span className="back-title">Pagamento</span>
            </div>

            <div className="scroll flex-1 min-h-0 overflow-y-auto overscroll-contain pb-6" style={{ paddingTop: 12 }}>
              <div className="card min-h-[84px] flex flex-col justify-center">
                <div className="stat-lbl">PLANO SELECIONADO</div>
                <div className="flex items-center justify-between mt-2 gap-3">
                  <div className="text-white text-sm font-semibold">Plano {planoSelecionado.nome}</div>
                  <div className="text-[#d5b451] text-[22px] font-black">{formatarMoeda(planoSelecionado.preco)}</div>
                </div>
              </div>

              <div className="pix-box">
                <div className="pix-title">
                  <div className="pix-title-ico">
                    <Icon name="money" className="w-4 h-4" />
                  </div>
                  <div className="text-white text-sm font-semibold">Pagar via Pix</div>
                </div>

                <div className="pix-key">
                  <span>{chavePix}</span>
                  <button type="button" className="pix-copy" onClick={copiarPix}>
                    <Icon name="copy" className="w-3 h-3" />
                    {pixCopiado ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                <ul className="pix-steps">
                  <li><div className="pix-n">1</div>Copie a chave Pix acima</li>
                  <li><div className="pix-n">2</div>Abra seu banco e faça a transferência</li>
                  <li><div className="pix-n">3</div>Tire print do comprovante</li>
                  <li><div className="pix-n">4</div>Envie pelo botão abaixo no WhatsApp</li>
                </ul>
              </div>

              <button className="btn primary flex items-center justify-center gap-2" onClick={() => confirmarContratacao(true)}>
                <Icon name="whatsapp" className="w-4 h-4" />
                Enviar comprovante no WhatsApp
              </button>

              <div className="alert warn min-h-[72px]">
                <Icon name="info" className="w-5 h-5 flex-shrink-0" />
                <div className="alert-txt">
                  Seu plano será ativado após a confirmação do pagamento pelo barbeiro.
                </div>
              </div>

              <div className="sec">OUTRAS FORMAS</div>
              <button type="button" onClick={confirmarPagamentoPresencial} disabled={loadingId !== null} className="card w-full min-h-[84px] text-left active:scale-[0.99] transition-transform disabled:opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-[#2c281b] text-[#d5b451] flex items-center justify-center flex-shrink-0">
                    <Icon name="store" className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[#d8d3c8] text-sm font-semibold">Cartão ou dinheiro</div>
                    <div className="text-zinc-500 text-xs mt-0.5">Pagamento somente presencial na barbearia</div>
                  </div>
                </div>
              </button>

              <button className="btn ghost" onClick={() => setModalAberto(false)}>Fazer depois</button>
            </div>

            {avisoPresencialAberto && (
              <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/75 backdrop-blur-sm p-4">
                <div className="w-full max-w-[390px] rounded-[24px] border border-[#d5b451]/35 bg-[#101010] p-5 shadow-2xl">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-[#2c281b] text-[#d5b451] flex items-center justify-center flex-shrink-0">
                      <Icon name="store" className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white text-base font-black">Cartão ou dinheiro</p>
                      <p className="text-zinc-400 text-xs leading-relaxed mt-1">
                        Pagamento somente presencial na barbearia. Seu plano ficará pendente e será ativado após a confirmação do pagamento pelo barbeiro.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={continuarPagamentoPresencial}
                    disabled={loadingId !== null}
                    className="btn primary"
                  >
                    Entendi, continuar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvisoPresencialAberto(false)}
                    className="btn ghost mt-2"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
