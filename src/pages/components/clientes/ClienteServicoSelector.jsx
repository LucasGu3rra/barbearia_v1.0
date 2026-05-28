import { useMemo, useState } from 'react';
import { Icon } from './ClienteDashboardParts';
import { formatarMoeda } from '../../cliente/utils/clienteDashboardUtils';

const normalizar = (valor = '') => String(valor)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const descricaoCategoria = (categoria, total) => {
  const nome = normalizar(categoria);
  if (nome.includes('barba')) return 'Manutencao rapida, desenho e cuidado completo.';
  if (nome.includes('cabelo') || nome.includes('corte')) return 'Toque para ver cortes, combos e outros servicos.';
  if (nome.includes('estet')) return 'Complementos simples para aumentar o cuidado.';
  if (nome.includes('visag')) return 'Analise e estilo para servicos consultivos.';
  return `${total} servicos disponiveis nesta categoria.`;
};

const iconeCategoria = (categoria) => {
  const nome = normalizar(categoria);
  if (nome.includes('barba')) return 'tool';
  if (nome.includes('combo')) return 'sparkles';
  return 'scissors';
};

const separarServicos = (servicos = [], busca = '') => {
  const termo = normalizar(busca);
  const grupos = {};
  const avulsos = [];

  servicos.forEach((servico) => {
    const categoria = servico.servico_categorias?.nome || '';
    const subcategoria = servico.servico_subcategorias?.nome || '';
    const textoBusca = normalizar(`${servico.nome} ${categoria} ${subcategoria}`);
    if (termo && !textoBusca.includes(termo)) return;

    if (!categoria) {
      avulsos.push(servico);
      return;
    }

    const nomeSubcategoria = subcategoria || 'Geral';
    if (!grupos[categoria]) grupos[categoria] = {};
    if (!grupos[categoria][nomeSubcategoria]) grupos[categoria][nomeSubcategoria] = [];
    grupos[categoria][nomeSubcategoria].push(servico);
  });

  return { grupos, avulsos };
};

function ServicoItem({ servico, onClick }) {
  const detalhe = servico.descricao || servico.servico_subcategorias?.nome || 'Servico avulso';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[#1b1b1b] border border-[#333] rounded-[16px] p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
    >
      <div className="w-12 h-12 rounded-[14px] bg-[#2c281b] text-[#d5b451] flex items-center justify-center flex-shrink-0">
        <Icon name={iconeCategoria(servico.servico_categorias?.nome || servico.nome)} className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-black uppercase truncate">{servico.nome}</p>
        <p className="text-zinc-500 text-[11px] mt-1 truncate">{detalhe}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-white text-sm font-black">{formatarMoeda(servico.preco)}</p>
        <p className="text-zinc-500 text-[10px] mt-1">{servico.duracao_minutos || 30} min</p>
      </div>
    </button>
  );
}

export default function ClienteServicoSelector({
  servicos = [],
  onSelecionarServico,
  className = '',
  emptyText = 'Nenhum servico encontrado.',
  scrollable = false,
}) {
  const [busca, setBusca] = useState('');
  const [categoriaAberta, setCategoriaAberta] = useState(null);
  const { grupos, avulsos } = useMemo(() => separarServicos(servicos, busca), [servicos, busca]);
  const categorias = Object.keys(grupos);
  const listaVazia = categorias.length === 0 && avulsos.length === 0;

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex gap-2 mb-3 flex-shrink-0">
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar servico, combo ou especialidade"
          className="flex-1 min-w-0 bg-[#111] border border-[#333] rounded-[16px] px-4 py-3 text-sm text-white outline-none focus:border-[#d5b451]/60 placeholder-zinc-600"
        />
        <div className="w-12 h-12 rounded-full bg-[#151515] border border-[#333] text-[#d5b451] flex items-center justify-center">
          <Icon name="scissors" className="w-4 h-4" />
        </div>
      </div>

      <div className={`space-y-3 min-h-0 ${scrollable ? 'overflow-y-auto pr-1 custom-scrollbar overscroll-contain' : ''}`}>
        {categorias.map((categoria) => {
          const subgrupos = grupos[categoria];
          const servicosDaCategoria = Object.values(subgrupos).flat();
          const aberta = categoriaAberta === categoria;

          return (
            <div key={categoria} className={`bg-[#1b1b1b] border rounded-[22px] overflow-hidden ${aberta ? 'border-[#d5b451]/50' : 'border-[#333]'}`}>
              <button
                type="button"
                onClick={() => setCategoriaAberta(aberta ? null : categoria)}
                className="w-full p-4 flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-[#2c281b] text-[#d5b451] flex items-center justify-center flex-shrink-0">
                  <Icon name={iconeCategoria(categoria)} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-black uppercase">{categoria}</p>
                  <p className="text-zinc-400 text-[11px] mt-1 leading-snug">{descricaoCategoria(categoria, servicosDaCategoria.length)}</p>
                </div>
                <span className="text-[#d5b451] border border-[#d5b451]/30 bg-[#d5b451]/10 rounded-full px-3 py-1 text-[10px] font-black whitespace-nowrap">
                  {servicosDaCategoria.length} opcoes
                </span>
                <span className="text-[#d5b451] text-sm">{aberta ? '^' : 'v'}</span>
              </button>

              {aberta && (
                <div className="border-t border-[#333] p-4 space-y-4 bg-[#111]">
                  {Object.entries(subgrupos).map(([subcategoria, lista]) => (
                    <div key={subcategoria} className="space-y-2">
                      <p className="text-[#d5b451] text-[10px] font-black uppercase tracking-widest">{subcategoria}</p>
                      {lista.map((servico) => (
                        <ServicoItem key={servico.id} servico={servico} onClick={() => onSelecionarServico(servico.id)} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {avulsos.length > 0 && (
          <div className={`space-y-3 ${categorias.length > 0 ? 'pt-2' : ''}`}>
            {categorias.length > 0 && (
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.22em] px-1">
                Servicos avulsos
              </p>
            )}
            {avulsos.map((servico) => (
              <ServicoItem key={servico.id} servico={servico} onClick={() => onSelecionarServico(servico.id)} />
            ))}
          </div>
        )}

        {listaVazia && (
          <div className="text-center py-10 border border-dashed border-[#333] rounded-[12px]">
            <p className="text-zinc-600 text-xs italic">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
