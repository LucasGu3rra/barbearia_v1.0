import { useCallback, useEffect, useMemo, useState } from 'react';
import { PwaInstallContext } from './PwaInstallContextObject';

const INSTALL_PROMPT_DISMISSED_KEY = 'barberPwaInstallPromptDismissed';

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

export const PwaInstallProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    let promptTimer = null;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);

      const promptDismissed = window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
      if (!promptDismissed && !isStandaloneMode()) {
        promptTimer = window.setTimeout(() => setShowInstallPrompt(true), 900);
      }
    };

    const handleAppInstalled = () => {
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'installed');
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowInstallPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (promptTimer) window.clearTimeout(promptTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const canInstall = Boolean(deferredPrompt) && !isInstalled;

  const dismissInstallPrompt = useCallback(() => {
    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'dismissed');
    setShowInstallPrompt(false);
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;

    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'prompted');
    setShowInstallPrompt(false);
    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'installed');
      return true;
    }

    return false;
  }, [deferredPrompt]);

  const value = useMemo(() => ({
    canInstall,
    isInstalled,
    installApp,
    dismissInstallPrompt,
  }), [canInstall, dismissInstallPrompt, installApp, isInstalled]);

  return (
    <PwaInstallContext.Provider value={value}>
      {children}

      {showInstallPrompt && canInstall && (
        <div className="fixed inset-x-0 bottom-0 z-[10000] flex justify-center px-4 pb-4">
          <div className="w-full max-w-[390px] rounded-[24px] border border-[#2b2b2f] bg-[#09090b] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#d5b451]/10 text-[#d5b451]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <rect x="4" y="17" width="16" height="4" rx="1" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-white">Instalar app</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Acesse a barbearia pela tela inicial e mantenha a sessao salva neste aparelho.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={dismissInstallPrompt}
                className="rounded-[14px] border border-[#27272a] bg-[#121212] py-3 text-sm font-black text-zinc-400 active:scale-[0.99]"
              >
                Agora nao
              </button>
              <button
                type="button"
                onClick={installApp}
                className="rounded-[14px] bg-[#d5b451] py-3 text-sm font-black text-black active:scale-[0.99]"
              >
                Instalar
              </button>
            </div>
          </div>
        </div>
      )}
    </PwaInstallContext.Provider>
  );
};
