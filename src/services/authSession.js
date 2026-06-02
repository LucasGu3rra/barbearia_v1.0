import { disableCurrentPushSubscription } from './pushNotifications';
import { supabase } from './supabase';

export const signOutWithPushCleanup = async ({ empresaId, userId } = {}) => {
  try {
    await disableCurrentPushSubscription({ supabase, empresaId, userId });
  } catch (error) {
    console.error('Erro ao desativar push no logout:', error);
  }

  return supabase.auth.signOut();
};
