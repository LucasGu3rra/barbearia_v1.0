import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PwaInstallContext } from './PwaInstallContextObject';
import { atualizarManifestPwa } from '../services/pwaManifest';

const INSTALL_PROMPT_DISMISSED_KEY = 'barberPwaInstallPromptDismissed';

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

const detectarPlataformaPwa = () => {
  if (typeof window === 'undefined') {
    return { isIos: false, mode: 'unsupported' };
  }

  const userAgent = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const isIpadDesktopMode = platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || isIpadDesktopMode;

  return {
    isIos,
    mode: isIos ? 'ios' : 'native',
  };
};

const podeMostrarPromptNaRota = (pathname) => (
  /\/dashboard(?:\/)?$/.test(pathname)
  || /\/admin\/dashboard(?:\/)?$/.test(pathname)
  || /\/barbeiro\/dashboard(?:\/)?$/.test(pathname)
);

export const PwaInstallProvider = ({ children }) => {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const platformInfo = useMemo(() => detectarPlataformaPwa(), []);
  const installPromptAllowed = podeMostrarPromptNaRota(location.pathname);
  const installMode = platformInfo.isIos ? 'ios' : 'native';

  useEffect(() => {
    atualizarManifestPwa(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
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
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (isInstalled || isStandaloneMode()) {
      return undefined;
    }

    if (!installPromptAllowed) {
      return undefined;
    }

    if (!deferredPrompt && !platformInfo.isIos) {
      return undefined;
    }

    const promptDismissed = window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
    if (promptDismissed) {
      return undefined;
    }

    const promptTimer = window.setTimeout(() => setShowInstallPrompt(true), 900);
    return () => window.clearTimeout(promptTimer);
  }, [deferredPrompt, installPromptAllowed, isInstalled, platformInfo.isIos]);

  const canInstall = !isInstalled && (Boolean(deferredPrompt) || platformInfo.isIos);

  const dismissInstallPrompt = useCallback(() => {
    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'dismissed');
    setShowInstallPrompt(false);
  }, []);

  const installApp = useCallback(async () => {
    if (platformInfo.isIos) {
      window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, 'prompted');
      setShowInstallPrompt(false);
      setShowIosInstallGuide(true);
      return false;
    }

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
  }, [deferredPrompt, platformInfo.isIos]);

  const value = useMemo(() => ({
    canInstall,
    installMode,
    isInstalled,
    installApp,
    dismissInstallPrompt,
  }), [canInstall, dismissInstallPrompt, installApp, installMode, isInstalled]);

  const promptTitle = platformInfo.isIos ? 'Adicionar a tela inicial' : 'Instalar app';
  const promptDescription = platformInfo.isIos
    ? 'No iPhone, salve a barbearia pela tela inicial para abrir direto neste acesso.'
    : 'Acesse a barbearia pela tela inicial e mantenha a sessao salva neste aparelho.';
  const promptButton = platformInfo.isIos ? 'Ver como adicionar' : 'Instalar';

  return (
    <PwaInstallContext.Provider value={value}>
      {children}

      {showInstallPrompt && canInstall && installPromptAllowed && (
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
                <p className="text-base font-black text-white">{promptTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {promptDescription}
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
                {promptButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIosInstallGuide && (
        <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/70 px-4 pb-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setShowIosInstallGuide(false)}
            aria-label="Fechar instrucoes de instalacao"
          />

          <div className="relative w-full max-w-[390px] rounded-[24px] border border-[#2b2b2f] bg-[#09090b] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d5b451]">iPhone</p>
                <h2 className="mt-1 text-xl font-black text-white">Adicionar a tela inicial</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowIosInstallGuide(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2b2b2f] bg-[#171717] text-zinc-500"
                aria-label="Fechar"
              >
                x
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-[16px] border border-[#27272a] bg-[#121212] p-4">
                <p className="text-sm font-black text-white">1. Toque em Compartilhar</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Use o botao de compartilhar do Safari, na barra inferior ou superior.</p>
              </div>
              <div className="rounded-[16px] border border-[#27272a] bg-[#121212] p-4">
                <p className="text-sm font-black text-white">2. Escolha Adicionar a Tela de Inicio</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">O iPhone vai criar o app com o link desta barbearia.</p>
              </div>
              <div className="rounded-[16px] border border-[#27272a] bg-[#121212] p-4">
                <p className="text-sm font-black text-white">3. Confirme em Adicionar</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Depois disso, abra pela tela inicial para entrar direto no sistema.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosInstallGuide(false)}
              className="mt-5 w-full rounded-[16px] bg-[#d5b451] py-4 text-sm font-black text-black active:scale-[0.99]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </PwaInstallContext.Provider>
  );
};
