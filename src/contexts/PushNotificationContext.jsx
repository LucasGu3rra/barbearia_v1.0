import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { PushNotificationContext } from './PushNotificationContextObject';
import { supabase } from '../services/supabase';
import {
  getNotificationPermission,
  isPushSupported,
  pushConfig,
  registerPushSubscription,
} from '../services/pushNotifications';

const getPapelNotificacao = ({ papelEmpresa, isAdmin }) => {
  if (papelEmpresa) return papelEmpresa;
  if (isAdmin) return 'admin';
  return 'cliente';
};

export const PushNotificationProvider = ({ children }) => {
  const { user, empresaAtual, papelEmpresa, isAdmin } = useAuth();
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('idle');
  const userId = user?.id;
  const empresaId = empresaAtual?.id;
  const supported = isPushSupported();
  const configured = pushConfig.configured;
  const visible = Boolean(userId && empresaId);

  const available = Boolean(visible && supported && configured);

  const syncSubscription = useCallback(async ({ requestPermission = false } = {}) => {
    setPermission(getNotificationPermission());

    if (!userId || !empresaId) return { ok: false, reason: 'missing-context' };
    if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
    if (!pushConfig.configured) return { ok: false, reason: 'missing-key' };
    if (!requestPermission && getNotificationPermission() !== 'granted') {
      return { ok: false, reason: 'permission-not-granted' };
    }

    const result = await registerPushSubscription({
      supabase,
      empresaId,
      userId,
      papel: getPapelNotificacao({ papelEmpresa, isAdmin }),
    });

    setPermission(getNotificationPermission());
    setEnabled(Boolean(result.ok));
    return result;
  }, [empresaId, isAdmin, papelEmpresa, userId]);

  const enablePush = useCallback(async () => {
    setStatus('saving');

    try {
      const result = await syncSubscription({ requestPermission: true });
      if (result.ok) {
        setStatus('enabled');
        return result;
      }

      setStatus(result.reason || 'error');
      return result;
    } catch (error) {
      console.error('Erro ao ativar notificacoes:', error);
      setStatus('error');
      return { ok: false, reason: 'error', error };
    }
  }, [syncSubscription]);

  useEffect(() => {
    if (!available || getNotificationPermission() !== 'granted') return;
    Promise.resolve().then(() => syncSubscription());
  }, [available, syncSubscription]);

  const sendTestPush = useCallback(async () => {
    if (!empresaId) return { ok: false, reason: 'missing-context' };

    setStatus('testing');

    const { data, error } = await supabase.functions.invoke('enviar-push', {
      body: {
        action: 'self_test',
        empresa_id: empresaId,
        titulo: 'Notificacoes ativadas',
        corpo: 'Este aparelho ja pode receber avisos da barbearia.',
        tipo: 'teste_push',
        dados: {
          url: window.location.pathname || '/',
        },
      },
    });

    if (error) {
      console.error('Erro ao enviar notificacao de teste:', error);
      setStatus('error');
      return { ok: false, reason: 'error', error };
    }

    setStatus('enabled');
    return data || { ok: true };
  }, [empresaId]);

  const sendDelayedTestPush = useCallback(async () => {
    if (!empresaId) return { ok: false, reason: 'missing-context' };

    setStatus('testing-delayed');

    const { data, error } = await supabase.functions.invoke('teste-push-1min', {
      body: {
        delay_seconds: 60,
        empresa_id: empresaId,
        titulo: 'Teste com app fechado',
        corpo: 'Esta notificacao foi enviada 1 minuto depois pelo servidor.',
        tipo: 'teste_push_atrasado',
        dados: {
          url: window.location.pathname || '/',
        },
      },
    });

    if (error) {
      console.error('Erro ao agendar notificacao de teste:', error);
      setStatus('error');
      return { ok: false, reason: 'error', error };
    }

    setStatus('enabled');
    return data || { ok: true };
  }, [empresaId]);

  const value = useMemo(() => ({
    available,
    visible,
    configured,
    supported,
    enabled,
    permission,
    status,
    enablePush,
    sendTestPush,
    sendDelayedTestPush,
  }), [available, configured, enabled, enablePush, permission, sendDelayedTestPush, sendTestPush, status, supported, visible]);

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};
