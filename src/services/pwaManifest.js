const MANIFEST_PADRAO = '/site.webmanifest?v=2';
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

const obterSlugDaRota = (pathname = '/') => {
  const [segmento] = String(pathname)
    .split('/')
    .filter(Boolean);

  if (!segmento) return '';

  const slug = decodeURIComponent(segmento).trim().toLowerCase();
  if (SEGMENTOS_RESERVADOS.has(slug)) return '';
  return /^[a-z0-9-]+$/.test(slug) ? slug : '';
};

export const obterHrefManifestPwa = (pathname = '/') => {
  const slug = obterSlugDaRota(pathname);
  if (!slug) return MANIFEST_PADRAO;
  return `/api/manifest/${encodeURIComponent(slug)}.webmanifest?v=3`;
};

export const atualizarManifestPwa = (pathname = window.location.pathname) => {
  if (typeof document === 'undefined') return;

  const manifest = document.querySelector('link[rel="manifest"]');
  if (!manifest) return;

  const href = obterHrefManifestPwa(pathname);
  if (manifest.getAttribute('href') !== href) {
    manifest.setAttribute('href', href);
  }
};
