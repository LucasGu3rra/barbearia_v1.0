import { createContext } from 'react';

export const PwaInstallContext = createContext({
  canInstall: false,
  isInstalled: false,
  installApp: async () => false,
  dismissInstallPrompt: () => {},
});
