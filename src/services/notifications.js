import { supabase } from './supabase';

const aguardar = (milissegundos) => new Promise((resolve) => {
  window.setTimeout(resolve, milissegundos);
});

export const notificarAgendamento = async ({ agendamentoId }) => {
  if (!agendamentoId) return { ok: false, reason: 'missing-data' };

  const intervalos = [0, 600, 1500];
  let ultimoErro = null;

  for (const intervalo of intervalos) {
    if (intervalo > 0) await aguardar(intervalo);

    const { data, error } = await supabase.functions.invoke('notificar-agendamento', {
      body: {
        agendamento_id: agendamentoId,
      },
    });

    if (!error) return data || { ok: true };
    ultimoErro = error;
  }

  console.error('Erro ao notificar agendamento apos novas tentativas:', ultimoErro);

  return { ok: false, reason: 'function-error', error: ultimoErro };
};

export const enviarPushParaUsuarios = async ({
  empresaId,
  userIds,
  titulo,
  corpo,
  tipo,
  dados = {},
}) => {
  const destinatarios = [...new Set((userIds || []).filter(Boolean))];
  if (!empresaId || destinatarios.length === 0) return { ok: false, reason: 'missing-targets' };

  const { data, error } = await supabase.functions.invoke('enviar-push', {
    body: {
      action: 'send',
      empresa_id: empresaId,
      target_user_ids: destinatarios,
      titulo,
      corpo,
      tipo,
      dados,
    },
  });

  if (error) {
    console.error('Erro ao enviar push:', error);
    return { ok: false, reason: 'function-error', error };
  }

  return data || { ok: true };
};
