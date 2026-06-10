import { createContext } from 'react';

export const PwaInstallContext = createContext({
  canInstall: false,
  installMode: 'unsupported',
  isInstalled: false,
  installApp: async () => false,
  dismissInstallPrompt: () => {},
});
