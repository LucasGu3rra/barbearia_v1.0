import { supabase } from './supabase';

export const EMPRESA_PADRAO_ID = '00000000-0000-0000-0000-000000000001';
export const EMPRESA_PADRAO_SLUG = 'barbearia-do-joao';
export const ULTIMA_EMPRESA_SLUG_KEY = 'ultimaEmpresaSlug';

const slugSeguro = (slug) => /^[a-z0-9-]+$/.test(String(slug || ''));

export const salvarUltimaEmpresaSlug = (slug) => {
  if (typeof window === 'undefined' || !slugSeguro(slug)) return;
  window.localStorage.setItem(ULTIMA_EMPRESA_SLUG_KEY, slug);
};

export const obterUltimaEmpresaSlug = () => {
  if (typeof window === 'undefined') return null;
  const slug = window.localStorage.getItem(ULTIMA_EMPRESA_SLUG_KEY);
  return slugSeguro(slug) ? slug : null;
};

export const limparSessaoPreservandoEmpresa = () => {
  if (typeof window === 'undefined') return;
  const slug = obterUltimaEmpresaSlug();
  window.localStorage.clear();
  window.sessionStorage.clear();
  if (slug) salvarUltimaEmpresaSlug(slug);
};

export const getEmpresaPorSlug = async (slug) => {
  const slugBusca = slug || EMPRESA_PADRAO_SLUG;

  const { data, error } = await supabase
    .from('empresas')
    .select('id, nome, slug, whatsapp, chave_pix, ativa')
    .eq('slug', slugBusca)
    .eq('ativa', true)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;
  if (slug) return null;

  return {
    id: EMPRESA_PADRAO_ID,
    slug: EMPRESA_PADRAO_SLUG,
    nome: 'Barbearia do Joao',
    whatsapp: '5581988468182',
    chave_pix: '81988468182',
    ativa: true,
  };
};

export const montarRotaEmpresa = (slug, rota = '') => {
  const slugFinal = slug || EMPRESA_PADRAO_SLUG;
  const rotaFinal = rota.startsWith('/') ? rota : `/${rota}`;
  return `/${slugFinal}${rotaFinal}`;
};

export const normalizarTelefoneBrasil = (valor) => {
  const numeros = String(valor || '').replace(/\D/g, '');
  if (!numeros) return '';
  if (numeros.startsWith('55')) return numeros;
  if (numeros.length === 10 || numeros.length === 11) return `55${numeros}`;
  return numeros;
};
