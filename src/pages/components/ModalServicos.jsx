import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';

const servicoInicial = {
  id: null,
  nome: '',
  preco: '',
  duracao_minutos: 30,
};

function Icon({ name, className = 'w-5 h-5' }) {
  const icons = {
    bag: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
    scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9" /><path d="M14.5 14.5 20 20" /><path d="M8.1 8.1 12 12" /></>,
    arrow: <path d="m15 18-6-6 6-6" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.bag}
    </svg>
  );
}

function ModalButton({ children, onClick, variant = 'gold', disabled = false }) {
  const styles = variant === 'gold'
    ? 'bg-[#CEAA6B]/10 text-[#CEAA6B] border-[#CEAA6B]/20 hover:bg-[#CEAA6B]/20'
    : 'bg-[#121212] text-white border-[#27272a] hover:border-[#CEAA6B]/50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full border font-bold py-3.5 rounded-[20px] text-xs uppercase tracking-widest transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1">{label}</span>}
      <input
        {...props}
        className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#CEAA6B]/50 placeholder-zinc-600 transition-colors disabled:opacity-50"
      />
    </label>
  );
}

export default function ModalServicos({ isOpen, onClose, onRefresh, empresaId }) {
  const [servicos, setServicos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [filtro, setFiltro] = useState('todos');
  const [modo, setModo] = useState('lista');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [formServico, setFormServico] = useState(servicoInicial);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    const [{ data: cats }, { data: servs }] = await Promise.all([
      supabase.from('servico_categorias').select('*').eq('empresa_id', empresaId).is('deleted_at', null).order('ordem').order('nome'),
      supabase
        .from('servicos')
        .select('*, servico_categorias(nome)')
        .eq('empresa_id', empresaId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
    ]);

    setCategorias(cats || []);
    setServicos(servs || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    if (!isOpen || !empresaId) return;
    setModo('lista');
    setFiltro('todos');
    setErro('');
    setCategoriaSelecionada(null);
    setFormServico(servicoInicial);
    carregarDados();
  }, [isOpen, empresaId, carregarDados]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const originalBody = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    const originalHtmlOverflow = html.style.overflow;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    html.style.overflow = 'hidden';

    return () => {
      body.style.overflow = originalBody.overflow;
      body.style.position = originalBody.position;
      body.style.top = originalBody.top;
      body.style.width = originalBody.width;
      html.style.overflow = originalHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const servicosAvulsos = useMemo(
    () => servicos.filter(servico => !servico.categoria_id),
    [servicos]
  );

  const categoriaAtual = useMemo(
    () => categorias.find(categoria => categoria.id === categoriaSelecionada?.id) || categoriaSelecionada,
    [categorias, categoriaSelecionada]
  );

  const servicosDaCategoria = useMemo(
    () => servicos.filter(servico => servico.categoria_id === categoriaAtual?.id),
    [categoriaAtual?.id, servicos]
  );

  const limparServico = () => {
    setFormServico(servicoInicial);
    setErro('');
  };

  const voltarLista = () => {
    setModo('lista');
    setCategoriaSelecionada(null);
    setNomeCategoria('');
    setNovaCategoria('');
    setFormServico(servicoInicial);
    setErro('');
  };

  const atualizarServico = (campo, valor) => {
    setFormServico(prev => ({ ...prev, [campo]: valor }));
  };

  const validarServico = () => {
    if (!formServico.nome.trim()) throw new Error('Informe o nome do serviço.');
    const preco = parseFloat(formServico.preco);
    if (!formServico.preco || Number.isNaN(preco) || preco < 0) throw new Error('Informe um preço válido.');
    const duracao = parseInt(formServico.duracao_minutos);
    if (!duracao || duracao < 5) throw new Error('A duração mínima é de 5 minutos.');
    return { preco, duracao };
  };

  const salvarServico = async ({ categoriaId = null } = {}) => {
    setSalvando(true);
    setErro('');
    try {
      const { preco, duracao } = validarServico();

      const payload = {
        empresa_id: empresaId,
        nome: formServico.nome.trim(),
        preco,
        duracao_minutos: duracao,
        categoria_id: categoriaId,
        subcategoria_id: null,
        ativo: true,
      };

      const { error } = formServico.id
        ? await supabase.from('servicos').update(payload).eq('id', formServico.id).eq('empresa_id', empresaId)
        : await supabase.from('servicos').insert([payload]);

      if (error) throw error;
      limparServico();
      await carregarDados();
      if (onRefresh) onRefresh();
    } catch (error) {
      setErro(error.message || 'Erro ao salvar serviço.');
    } finally {
      setSalvando(false);
    }
  };

  const criarCategoria = async () => {
    const nome = novaCategoria.trim();
    if (!nome) return setErro('Informe o nome da categoria.');
    setSalvando(true);
    setErro('');

    const { data, error } = await supabase
      .from('servico_categorias')
      .insert([{ empresa_id: empresaId, nome }])
      .select('*')
      .single();

    setSalvando(false);
    if (error) return setErro(error.message || 'Erro ao criar categoria.');

    setNovaCategoria('');
    setCategoriaSelecionada(data);
    setNomeCategoria(data.nome);
    setModo('categoria');
    await carregarDados();
    if (onRefresh) onRefresh();
  };

  const salvarNomeCategoria = async () => {
    if (!categoriaAtual?.id) return;
    const nome = nomeCategoria.trim();
    if (!nome) return setErro('Informe o nome da categoria.');

    setSalvando(true);
    setErro('');
    const { error } = await supabase
      .from('servico_categorias')
      .update({ nome })
      .eq('id', categoriaAtual.id)
      .eq('empresa_id', empresaId);

    setSalvando(false);
    if (error) return setErro(error.message || 'Erro ao salvar categoria.');
    await carregarDados();
    if (onRefresh) onRefresh();
  };

  const excluirServico = async (servico) => {
    if (!window.confirm(`Excluir o serviço "${servico.nome}"? Ele sai da tela do cliente, mas agendamentos antigos continuam registrados.`)) return;
    const { error } = await supabase
      .from('servicos')
      .update({ ativo: false, deleted_at: new Date().toISOString() })
      .eq('id', servico.id)
      .eq('empresa_id', empresaId);

    if (error) return setErro(error.message || 'Erro ao excluir serviço.');
    await carregarDados();
    if (onRefresh) onRefresh();
  };

  const excluirCategoria = async () => {
    if (!categoriaAtual?.id) return;
    if (!window.confirm(`Excluir a categoria "${categoriaAtual.nome}"? Os serviços dela virarão avulsos.`)) return;

    const agora = new Date().toISOString();
    await supabase.from('servicos').update({ categoria_id: null, subcategoria_id: null }).eq('empresa_id', empresaId).eq('categoria_id', categoriaAtual.id);
    await supabase.from('servico_subcategorias').update({ deleted_at: agora }).eq('empresa_id', empresaId).eq('categoria_id', categoriaAtual.id);

    const { error } = await supabase
      .from('servico_categorias')
      .update({ deleted_at: agora })
      .eq('id', categoriaAtual.id)
      .eq('empresa_id', empresaId);

    if (error) return setErro(error.message || 'Erro ao excluir categoria.');
    voltarLista();
    await carregarDados();
    if (onRefresh) onRefresh();
  };

  const toggleAtivo = async (servico) => {
    const { error } = await supabase
      .from('servicos')
      .update({ ativo: !servico.ativo })
      .eq('id', servico.id)
      .eq('empresa_id', empresaId);

    if (error) return setErro(error.message || 'Erro ao alterar status.');
    await carregarDados();
    if (onRefresh) onRefresh();
  };

  const editarAvulso = (servico) => {
    setFormServico({
      id: servico.id,
      nome: servico.nome || '',
      preco: servico.preco || '',
      duracao_minutos: servico.duracao_minutos || 30,
    });
    setModo('avulso');
    setErro('');
  };

  const editarServicoCategoria = (servico) => {
    setFormServico({
      id: servico.id,
      nome: servico.nome || '',
      preco: servico.preco || '',
      duracao_minutos: servico.duracao_minutos || 30,
    });
    setErro('');
  };

  const abrirCategoria = (categoria) => {
    setCategoriaSelecionada(categoria);
    setNomeCategoria(categoria.nome || '');
    setModo('categoria');
    limparServico();
  };

  const abrirNovoAvulso = () => {
    setModo('avulso');
    setFormServico(servicoInicial);
    setErro('');
  };

  const alternarFiltro = (proximoFiltro) => {
    setFiltro(filtro === proximoFiltro ? 'todos' : proximoFiltro);
  };

  if (!isOpen) return null;

  const mostrarCategorias = filtro === 'todos' || filtro === 'categorias';
  const mostrarAvulsos = filtro === 'todos' || filtro === 'avulsos';
  const listaVazia = (!mostrarCategorias || categorias.length === 0) && (!mostrarAvulsos || servicosAvulsos.length === 0);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-hidden overscroll-none">
      <div className="bg-[#09090b] border border-[#27272a] w-full max-w-md max-h-[92vh] rounded-[32px] overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out] flex flex-col">
        <div className="relative p-6 pb-0">
          <button
            onClick={modo === 'lista' ? onClose : voltarLista}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
          >
            {modo === 'lista' ? <Icon name="x" className="w-4 h-4" /> : <Icon name="arrow" className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#CEAA6B]/10 flex items-center justify-center text-[#CEAA6B]">
              <Icon name={modo === 'categoria' ? 'folder' : 'bag'} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                {modo === 'categoria' ? categoriaAtual?.nome || 'Categoria' : 'Serviços'}
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                {modo === 'lista' ? 'Categorias e avulsos' : modo === 'avulso' ? 'Serviço avulso' : 'Edição da categoria'}
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 pt-2 ${modo === 'lista' ? 'flex flex-col min-h-[360px] max-h-[58vh] overflow-hidden' : 'space-y-3 max-h-[68vh] overflow-y-auto custom-scrollbar overscroll-contain'}`}>
          {loading ? (
            <p className="text-center text-zinc-500 text-sm py-6">Carregando...</p>
          ) : (
            <>
              {modo === 'lista' && (
                <>
                  <div className="grid grid-cols-2 gap-2 flex-shrink-0 pb-3">
                    {[
                      { id: 'categorias', label: 'Categorias' },
                      { id: 'avulsos', label: 'Avulsos' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => alternarFiltro(item.id)}
                        className={`py-2.5 rounded-full border text-[12px] font-black transition-colors ${filtro === item.id ? 'border-[#CEAA6B] bg-[#CEAA6B] text-black shadow-[inset_0_0_0_2px_rgba(0,0,0,.35)]' : 'border-[#27272a] bg-[#121212] text-zinc-500'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div
                    className="h-[300px] max-h-[42vh] overflow-y-auto custom-scrollbar space-y-3 pr-1"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
                  >
                  {listaVazia && (
                    <div className="text-center py-6 border border-dashed border-[#27272a] rounded-2xl">
                      <p className="text-zinc-600 text-xs leading-relaxed">
                        Nenhum servico ou categoria ativa ainda. Use os botoes abaixo para adicionar um avulso ou criar uma categoria.
                      </p>
                    </div>
                  )}

                  {mostrarCategorias && categorias.map(categoria => {
                    const totalServicos = servicos.filter(servico => servico.categoria_id === categoria.id).length;

                    return (
                      <button
                        key={categoria.id}
                        type="button"
                        onClick={() => abrirCategoria(categoria)}
                        className="w-full bg-[#121212] border border-[#27272a] rounded-2xl p-4 flex items-center gap-3 text-left hover:border-[#CEAA6B]/40 transition-colors"
                      >
                        <div className="w-11 h-11 rounded-xl bg-[#2c281b] text-[#CEAA6B] flex items-center justify-center flex-shrink-0">
                          <Icon name="folder" className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-white uppercase truncate">{categoria.nome}</p>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            {totalServicos} serviço{totalServicos === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span className="text-[#CEAA6B] text-lg leading-none">›</span>
                      </button>
                    );
                  })}

                  {mostrarAvulsos && servicosAvulsos.map(servico => (
                    <ServicoCard
                      key={servico.id}
                      servico={servico}
                      subtitulo="Avulso"
                      onEditar={() => editarAvulso(servico)}
                      onToggle={() => toggleAtivo(servico)}
                      onExcluir={() => excluirServico(servico)}
                    />
                  ))}
                  </div>
                </>
              )}

              {modo === 'avulso' && (
                <ServicoForm
                  titulo={formServico.id ? 'Editar avulso' : 'Novo avulso'}
                  formServico={formServico}
                  onChange={atualizarServico}
                  onSalvar={() => salvarServico({ categoriaId: null })}
                  onCancelar={voltarLista}
                  salvando={salvando}
                />
              )}

              {modo === 'novaCategoria' && (
                <div className="bg-[#121212] border border-[#CEAA6B]/30 rounded-2xl p-4 space-y-3">
                  <Input label="Nome da categoria" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} placeholder="Ex: Cabelo" />
                  {erro && <p className="text-red-500 text-[11px] font-medium">{erro}</p>}
                  <div className="flex gap-2">
                    <button onClick={voltarLista} className="flex-1 py-3 rounded-xl border border-[#27272a] text-zinc-500 text-xs font-bold uppercase tracking-wider">Cancelar</button>
                    <button onClick={criarCategoria} disabled={salvando} className="flex-1 py-3 rounded-xl bg-[#CEAA6B] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50">
                      {salvando ? 'Criando...' : 'Criar'}
                    </button>
                  </div>
                </div>
              )}

              {modo === 'categoria' && categoriaAtual && (
                <>
                  <div className="bg-[#121212] border border-[#27272a] rounded-2xl p-4 space-y-3">
                    <Input label="Nome da categoria" value={nomeCategoria} onChange={(e) => setNomeCategoria(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={excluirCategoria} className="flex-1 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold uppercase tracking-wider">Excluir</button>
                      <button onClick={salvarNomeCategoria} disabled={salvando} className="flex-1 py-3 rounded-xl bg-[#CEAA6B] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50">Salvar nome</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {servicosDaCategoria.map(servico => (
                      <ServicoCard
                        key={servico.id}
                        servico={servico}
                        subtitulo="Categoria"
                        onEditar={() => editarServicoCategoria(servico)}
                        onToggle={() => toggleAtivo(servico)}
                        onExcluir={() => excluirServico(servico)}
                      />
                    ))}
                  </div>

                  <ServicoForm
                    titulo={formServico.id ? 'Editar serviço da categoria' : 'Adicionar serviço na categoria'}
                    formServico={formServico}
                    onChange={atualizarServico}
                    onSalvar={() => salvarServico({ categoriaId: categoriaAtual.id })}
                    onCancelar={limparServico}
                    salvando={salvando}
                  />
                </>
              )}

              {erro && modo !== 'novaCategoria' && <p className="text-red-500 text-[11px] font-medium">{erro}</p>}
            </>
          )}
        </div>

        <div className="p-6 pt-0 space-y-2">
          {modo === 'lista' && (
            <>
              <ModalButton onClick={abrirNovoAvulso}>+ Novo avulso</ModalButton>
              <ModalButton variant="dark" onClick={() => { setModo('novaCategoria'); setErro(''); }}>+ Categorias</ModalButton>
              <button onClick={onClose} className="w-full bg-white text-black font-black py-4 rounded-[20px] uppercase tracking-[0.2em] text-[9px] active:scale-95 transition-all shadow-[0_8px_15px_rgba(255,255,255,0.1)]">
                Fechar
              </button>
            </>
          )}
          {modo !== 'lista' && <ModalButton variant="dark" onClick={voltarLista}>Voltar</ModalButton>}
        </div>
      </div>
    </div>
  );
}

function ServicoCard({ servico, subtitulo, onEditar, onToggle, onExcluir }) {
  return (
    <div className="bg-[#121212] border border-[#27272a] rounded-2xl p-4 flex items-center justify-between gap-3">
      <button type="button" onClick={onEditar} className="flex-1 min-w-0 text-left">
        <p className="font-black text-sm text-white uppercase truncate">{servico.nome}</p>
        <p className="text-[10px] text-zinc-500 mt-1 truncate">{subtitulo}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] text-[#CEAA6B] font-bold">R$ {Number(servico.preco).toFixed(2).replace('.', ',')}</p>
          <span className="text-zinc-600 text-[10px]">-</span>
          <p className="text-[10px] text-zinc-500">{servico.duracao_minutos || 30} min</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${servico.ativo ? 'bg-[#CEAA6B]' : 'bg-[#27272a]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${servico.ativo ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <button type="button" onClick={onExcluir} className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
        x
      </button>
    </div>
  );
}

function ServicoForm({ titulo, formServico, onChange, onSalvar, onCancelar, salvando }) {
  return (
    <div className="bg-[#121212] border border-[#CEAA6B]/30 rounded-2xl p-4 space-y-3">
      <p className="text-[10px] text-[#CEAA6B] font-black uppercase tracking-widest">{titulo}</p>
      <Input label="Nome" value={formServico.nome} onChange={(e) => onChange('nome', e.target.value)} placeholder="Ex: Corte de cabelo" />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Preço" type="number" min="0" step="0.01" value={formServico.preco} onChange={(e) => onChange('preco', e.target.value)} placeholder="0,00" />
        <Input label="Duração" type="number" min="5" step="5" value={formServico.duracao_minutos} onChange={(e) => onChange('duracao_minutos', e.target.value)} placeholder="30" />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancelar} className="flex-1 py-3 rounded-xl border border-[#27272a] text-zinc-500 text-xs font-bold uppercase tracking-wider">
          Cancelar
        </button>
        <button onClick={onSalvar} disabled={salvando} className="flex-1 py-3 rounded-xl bg-[#CEAA6B] text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
