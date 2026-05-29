import { createContext } from 'react';

export const PushNotificationContext = createContext({
  available: false,
  visible: false,
  configured: false,
  supported: false,
  enabled: false,
  permission: 'unsupported',
  status: 'idle',
  enablePush: async () => ({ ok: false }),
  sendTestPush: async () => ({ ok: false }),
});
