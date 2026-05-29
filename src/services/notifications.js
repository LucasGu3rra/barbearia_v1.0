import { supabase } from './supabase';

export const notificarAgendamento = async ({ agendamentoId, evento }) => {
  if (!agendamentoId || !evento) return { ok: false, reason: 'missing-data' };

  const { data, error } = await supabase.functions.invoke('notificar-agendamento', {
    body: {
      agendamento_id: agendamentoId,
      evento,
    },
  });

  if (error) {
    console.error('Erro ao notificar agendamento:', error);
    return { ok: false, reason: 'function-error', error };
  }

  return data || { ok: true };
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
