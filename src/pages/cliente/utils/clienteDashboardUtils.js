export const parseDataSupabase = (dataStr) => {
  if (!dataStr) return new Date();
  const dataLimpa = dataStr.split('.')[0].replace(' ', 'T') + 'Z';
  return new Date(dataLimpa);
};

export const formatarMoeda = (valor) => `R$ ${Number(valor || 0).toFixed(0)}`;
