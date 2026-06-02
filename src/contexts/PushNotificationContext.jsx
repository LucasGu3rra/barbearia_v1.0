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

  const value = useMemo(() => ({
    available,
    visible,
    configured,
    supported,
    enabled,
    permission,
    status,
    enablePush,
  }), [available, configured, enabled, enablePush, permission, status, supported, visible]);

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};
