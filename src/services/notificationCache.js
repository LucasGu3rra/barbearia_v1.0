const CACHE_PREFIX = 'barber.notifications';
const MAX_NOTIFICACOES_CACHE = 80;

const chaveCache = ({ empresaId, userId }) => {
  if (!empresaId || !userId) return null;
  return `${CACHE_PREFIX}.${empresaId}.${userId}`;
};

const normalizarNotificacao = (notificacao) => ({
  id: notificacao.id,
  titulo: notificacao.titulo || 'Notificacao',
  corpo: notificacao.corpo || '',
  tipo: notificacao.tipo || 'geral',
  dados: notificacao.dados || {},
  created_at: notificacao.created_at || new Date().toISOString(),
});

export const carregarNotificacoesCache = ({ empresaId, userId }) => {
  const chave = chaveCache({ empresaId, userId });
  if (!chave || typeof window === 'undefined') return [];

  try {
    const valor = window.localStorage.getItem(chave);
    if (!valor) return [];
    const notificacoes = JSON.parse(valor);
    return Array.isArray(notificacoes) ? notificacoes.map(normalizarNotificacao) : [];
  } catch {
    return [];
  }
};

export const salvarNotificacoesCache = ({ empresaId, userId, notificacoes }) => {
  const chave = chaveCache({ empresaId, userId });
  if (!chave || typeof window === 'undefined') return [];

  const mapa = new Map();
  notificacoes.forEach((notificacao) => {
    const item = normalizarNotificacao(notificacao);
    if (item.id) mapa.set(item.id, item);
  });

  const lista = [...mapa.values()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_NOTIFICACOES_CACHE);

  window.localStorage.setItem(chave, JSON.stringify(lista));
  return lista;
};

export const mesclarNotificacoesCache = ({ empresaId, userId, notificacoes }) => {
  const atuais = carregarNotificacoesCache({ empresaId, userId });
  return salvarNotificacoesCache({
    empresaId,
    userId,
    notificacoes: [...notificacoes, ...atuais],
  });
};

export const limparNotificacoesCache = ({ empresaId, userId }) => {
  const chave = chaveCache({ empresaId, userId });
  if (!chave || typeof window === 'undefined') return;
  window.localStorage.removeItem(chave);
};
