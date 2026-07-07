export const parseDataSupabase = (dataStr) => {
  if (!dataStr) return new Date();

  const valor = String(dataStr).trim();
  const normalizada = (valor.includes('T') ? valor : valor.replace(' ', 'T'))
    .replace(/\.(\d{3})\d+/, '.$1')
    .replace(/([+-]\d{2})$/, '$1:00')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const temTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(normalizada);
  const data = new Date(temTimezone ? normalizada : `${normalizada}Z`);

  return Number.isNaN(data.getTime()) ? new Date() : data;
};

export const formatarMoeda = (valor) => `R$ ${Number(valor || 0).toFixed(0)}`;
