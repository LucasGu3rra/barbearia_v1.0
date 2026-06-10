const BASE_MANIFEST = {
  name: 'BarbeariaClick',
  short_name: 'BarbeariaClick',
  description: 'Agendamento online, planos mensais e controle simples para barbearias.',
  scope: '/',
  display: 'standalone',
  background_color: '#09090b',
  theme_color: '#09090b',
  icons: [
    {
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/maskable-icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/maskable-icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

const SEGMENTOS_RESERVADOS = new Set([
  'admin',
  'api',
  'assets',
  'auth',
  'barbeiro',
  'favicon.ico',
  'login',
  'manifest.webmanifest',
  'master',
  'site.webmanifest',
]);

const normalizarSlug = (valor) => {
  const slugBruto = Array.isArray(valor) ? valor[0] : valor;
  const slug = String(slugBruto || '').replace(/\.webmanifest$/i, '').trim().toLowerCase();
  if (SEGMENTOS_RESERVADOS.has(slug)) return '';
  return /^[a-z0-9-]+$/.test(slug) ? slug : '';
};

const obterSlugDoReferer = (referer = '') => {
  try {
    const url = new URL(referer);
    const [segmento] = url.pathname.split('/').filter(Boolean);
    return normalizarSlug(segmento);
  } catch {
    return '';
  }
};

export default function handler(req, res) {
  const slugParam = normalizarSlug(req.query.slug);
  const slug = slugParam === 'current' ? obterSlugDoReferer(req.headers.referer) : slugParam;
  const rotaInicial = slug ? `/${slug}` : '/';

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({
    ...BASE_MANIFEST,
    id: rotaInicial,
    start_url: rotaInicial,
  });
}
