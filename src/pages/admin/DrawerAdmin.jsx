import { useState } from 'react';
import { usePwaInstall } from '../../contexts/usePwaInstall';
import { useAuth } from '../../contexts/useAuth';
import { supabase } from '../../services/supabase';
import { LOGO_PADRAO_URL, resolverLogoEmpresa } from '../../services/empresa';

const LOGO_BUCKET = 'logos-empresas';

const caminhoLogoStorage = (logoUrl, empresaId) => {
  const valor = String(logoUrl || '').trim();
  if (!valor || !empresaId) return null;

  try {
    const url = new URL(valor);
    const marcador = `/storage/v1/object/public/${LOGO_BUCKET}/`;
    const indice = url.pathname.indexOf(marcador);
    if (indice === -1) return null;

    const caminho = decodeURIComponent(url.pathname.slice(indice + marcador.length));
    return caminho.startsWith(`${empresaId}/`) ? caminho : null;
  } catch {
    return null;
  }
};

export default function DrawerAdmin({ 
  isOpen, 
  onClose, 
  onLogout, 
  dadosFinanceiros,
  onOpenPlanos,
  onOpenFiliais,
  onOpenBarbeiros,
  onOpenServicos,
  onOpenConfiguracoes,
  onOpenHistorico,
  novosCortes = 0,
}) {
  const [modalFinanceiro, setModalFinanceiro] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const [modalLogo, setModalLogo] = useState(false);
  const [modalPix, setModalPix] = useState(false);
  const [confirmarPix, setConfirmarPix] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoErro, setLogoErro] = useState('');
  const [salvandoLogo, setSalvandoLogo] = useState(false);
  const [chavePix, setChavePix] = useState('');
  const [pixErro, setPixErro] = useState('');
  const [salvandoPix, setSalvandoPix] = useState(false);
  const { canInstall, installApp } = usePwaInstall();
  const { empresaAtual, selecionarEmpresaPorSlug } = useAuth();

  if (!isOpen) return null;

  const logoAtualStoragePath = caminhoLogoStorage(empresaAtual?.logo_url, empresaAtual?.id);

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const handleConfigItem = (acao) => {
    if (acao) {
      onClose();
      acao();
    }
  };

  const instalarApp = async () => {
    await installApp();
    onClose();
  };

  const abrirModalLogo = () => {
    setLogoErro('');
    setLogoFile(null);
    setModalLogo(true);
  };

  const abrirModalPix = () => {
    setPixErro('');
    setConfirmarPix(false);
    setChavePix(empresaAtual?.chave_pix || '');
    setModalPix(true);
  };

  const excluirLogoStorage = async (logoUrl) => {
    const caminho = caminhoLogoStorage(logoUrl, empresaAtual?.id);
    if (!caminho) return;

    const { error } = await supabase.storage.from(LOGO_BUCKET).remove([caminho]);
    if (error) {
      console.warn('Nao foi possivel excluir a logo antiga do Storage.', error);
    }
  };

  const salvarLogo = async () => {
    if (!empresaAtual?.id || !empresaAtual?.slug) return;
    if (!logoFile) {
      setLogoErro('Selecione uma imagem para continuar.');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(logoFile.type)) {
      setLogoErro('Use PNG, JPG ou WEBP.');
      return;
    }

    if (logoFile.size > 2 * 1024 * 1024) {
      setLogoErro('A imagem deve ter no maximo 2 MB.');
      return;
    }

    setSalvandoLogo(true);
    setLogoErro('');

    try {
      const extensao = logoFile.type === 'image/jpeg' ? 'jpg' : logoFile.type.replace('image/', '');
      const caminho = `${empresaAtual.id}/logo-${Date.now()}.${extensao}`;
      const logoAnteriorUrl = empresaAtual.logo_url;
      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(caminho, logoFile, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(caminho);
      const logoUrl = publicData?.publicUrl;
      if (!logoUrl) throw new Error('Nao foi possivel gerar a URL da logo.');

      const { error: updateError } = await supabase
        .from('empresas')
        .update({ logo_url: logoUrl })
        .eq('id', empresaAtual.id);

      if (updateError) {
        await supabase.storage.from(LOGO_BUCKET).remove([caminho]);
        throw updateError;
      }

      await excluirLogoStorage(logoAnteriorUrl);
      await selecionarEmpresaPorSlug(empresaAtual.slug);
      setModalLogo(false);
      setLogoFile(null);
    } catch (error) {
      setLogoErro(error.message || 'Nao foi possivel alterar a logo.');
    } finally {
      setSalvandoLogo(false);
    }
  };

  const removerLogo = async () => {
    if (!empresaAtual?.id || !empresaAtual?.slug) return;
    if (!logoAtualStoragePath) {
      setLogoErro('Nao existe uma logo salva para remover.');
      return;
    }

    setSalvandoLogo(true);
    setLogoErro('');

    try {
      const logoAnteriorUrl = empresaAtual.logo_url;
      const { error: updateError } = await supabase
        .from('empresas')
        .update({ logo_url: LOGO_PADRAO_URL })
        .eq('id', empresaAtual.id);

      if (updateError) throw updateError;

      await excluirLogoStorage(logoAnteriorUrl);
      await selecionarEmpresaPorSlug(empresaAtual.slug);
      setModalLogo(false);
      setLogoFile(null);
    } catch (error) {
      setLogoErro(error.message || 'Nao foi possivel remover a logo.');
    } finally {
      setSalvandoLogo(false);
    }
  };

  const solicitarConfirmacaoPix = () => {
    const chave = chavePix.trim();
    setPixErro('');

    if (!chave) {
      setPixErro('Informe a nova chave Pix.');
      return;
    }

    if (chave.length < 5) {
      setPixErro('Confira a chave Pix informada.');
      return;
    }

    setConfirmarPix(true);
  };

  const salvarPix = async () => {
    if (!empresaAtual?.id || !empresaAtual?.slug) return;

    const novaChavePix = chavePix.trim();
    setSalvandoPix(true);
    setPixErro('');

    try {
      const { error: rpcError } = await supabase.rpc('atualizar_chave_pix_empresa', {
        p_empresa_id: empresaAtual.id,
        p_chave_pix: novaChavePix,
      });

      if (rpcError) {
        const mensagem = String(rpcError.message || '');
        const funcaoNaoExiste = mensagem.includes('atualizar_chave_pix_empresa') || mensagem.includes('Could not find the function');

        if (!funcaoNaoExiste) throw rpcError;

        const { error: updateError } = await supabase
          .from('empresas')
          .update({ chave_pix: novaChavePix })
          .eq('id', empresaAtual.id);

        if (updateError) throw updateError;
      }

      await selecionarEmpresaPorSlug(empresaAtual.slug);
      setModalPix(false);
      setConfirmarPix(false);
    } catch (error) {
      setPixErro(error.message || 'Nao foi possivel alterar a chave Pix.');
      setConfirmarPix(false);
    } finally {
      setSalvandoPix(false);
    }
  };
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-72 bg-[#09090b] border-l border-[#27272a] z-[70] p-6 flex flex-col animate-[slideIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-[#CEAA6B] font-bold uppercase tracking-widest text-sm">Menu Admin</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto">
          {/* Financeiro */}
          <button
            onClick={() => setModalFinanceiro(true)}
            className="flex w-full items-center gap-3 rounded-[10px] border border-[#27272a] bg-[#121212] p-3 text-white transition-all active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2c281b] text-[#d5b451]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div className="min-w-0 text-left">
              <span className="block truncate text-sm font-bold">Financeiro</span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-500">Renda e previsão</span>
            </div>
          </button>

          {/* Instalar app */}
          {canInstall && (
            <button
              onClick={instalarApp}
              className="flex w-full items-center gap-3 rounded-[10px] border border-[#27272a] bg-[#121212] p-3 text-white transition-all active:scale-[0.99]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2c281b] text-[#d5b451]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><rect x="4" y="17" width="16" height="4" rx="1"></rect></svg>
              </div>
              <div className="min-w-0 text-left">
                <span className="block truncate text-sm font-bold">Instalar app</span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-500">Adicionar na tela inicial</span>
              </div>
            </button>
          )}

          <button
            onClick={() => { if(onOpenPlanos) onOpenPlanos(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-[10px] border border-[#27272a] bg-[#121212] p-3 text-white transition-all active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2c281b] text-[#d5b451]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <div className="min-w-0 text-left">
              <span className="block truncate text-sm font-bold">Planos</span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-500">Gerenciar assinaturas</span>
            </div>
          </button>

          {/* Serviços */}
          <button
            onClick={() => { if(onOpenServicos) onOpenServicos(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-[10px] border border-[#27272a] bg-[#121212] p-3 text-white transition-all active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2c281b] text-[#d5b451]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg>
            </div>
            <div className="min-w-0 text-left">
              <span className="block truncate text-sm font-bold">Serviços</span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-500">Categorias e avulsos</span>
            </div>
          </button>

          <button
            onClick={() => { if(onOpenHistorico) onOpenHistorico(); onClose(); }}
            className="relative flex w-full items-center gap-3 rounded-[10px] border border-[#27272a] bg-[#121212] p-3 text-white transition-all active:scale-[0.99]"
          >
            {novosCortes > 0 && (
              <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#CEAA6B] px-1 text-[10px] font-black text-black shadow-[0_0_0_2px_#121212]">
                {novosCortes > 9 ? '9+' : novosCortes}
              </span>
            )}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#2c281b] text-[#d5b451]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div className="min-w-0 text-left">
              <span className="block truncate text-sm font-bold">Histórico</span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-500">Cortes realizados</span>
            </div>
          </button>

          {/* Configurações */}
          <div>
            <button
              onClick={() => setConfigAberto(!configAberto)}
              className={`flex w-full items-center gap-3 rounded-[10px] border bg-[#121212] p-3 text-white transition-all active:scale-[0.99] ${configAberto ? 'border-[#CEAA6B]/50' : 'border-[#27272a]'}`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-all ${configAberto ? 'bg-[#CEAA6B] text-black' : 'bg-[#2c281b] text-[#d5b451]'}`}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-bold">Configurações</span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-500">Filiais, barbeiros e mais</span>
              </div>
              <svg
                className={`text-zinc-500 transition-transform duration-300 flex-shrink-0 ${configAberto ? 'rotate-180 text-[#CEAA6B]' : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {/* Submenu accordion */}
            <div className={`overflow-hidden transition-all duration-300 ${configAberto ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              <div className="ml-3 space-y-1.5 border-l border-[#27272a] pl-3">

                <button
                  onClick={abrirModalLogo}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#2c281b] flex items-center justify-center text-[#d5b451] group-hover:bg-[#d5b451] group-hover:text-black transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Alterar logo</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Imagem da barbearia</span>
                  </div>
                </button>

                <button
                  onClick={abrirModalPix}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#2c281b] flex items-center justify-center text-[#d5b451] group-hover:bg-[#d5b451] group-hover:text-black transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block font-bold text-xs">Chave Pix</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Editar pagamento</span>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-600 group-hover:text-[#d5b451]"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                </button>

                <button
                  onClick={() => handleConfigItem(onOpenFiliais)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#2c281b] flex items-center justify-center text-[#d5b451] group-hover:bg-[#d5b451] group-hover:text-black transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Filiais</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Gerenciar Unidades</span>
                  </div>
                </button>

                <button
                  onClick={() => handleConfigItem(onOpenBarbeiros)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#2c281b] flex items-center justify-center text-[#d5b451] group-hover:bg-[#d5b451] group-hover:text-black transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Barbeiros</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Gerenciar Profissionais</span>
                  </div>
                </button>

                <button
                  onClick={() => handleConfigItem(onOpenServicos)}
                  className="hidden w-full items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#2c281b] flex items-center justify-center text-[#d5b451] group-hover:bg-[#d5b451] group-hover:text-black transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Serviços</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Gerenciar serviços avulsos</span>
                  </div>
                </button>

                <button
                  onClick={() => handleConfigItem(onOpenConfiguracoes)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#121212] border border-[#27272a] text-white hover:border-[#CEAA6B]/50 hover:bg-[#18181b] transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#2c281b] flex items-center justify-center text-[#d5b451] group-hover:bg-[#d5b451] group-hover:text-black transition-all flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                  </div>
                  <div className="text-left">
                    <span className="block font-bold text-xs">Fluxo de Agendamento</span>
                    <span className="block text-[9px] text-zinc-500 uppercase tracking-wider">Configurar Jornada</span>
                  </div>
                </button>

              </div>
            </div>
          </div>
        </nav>

        <button onClick={onLogout} className="mt-6 w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-500/5 text-red-500/60 font-bold text-xs uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sair do Painel
        </button>
      </div>

      {modalLogo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-end justify-center p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-[#27272a] bg-[#09090b] p-5 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#CEAA6B]">Configurações</p>
                <h3 className="mt-1 text-xl font-black text-white">Alterar logo</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalLogo(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#181818] text-zinc-500"
              >
                x
              </button>
            </div>

            <div className="mb-4 flex items-center gap-4 rounded-2xl border border-[#27272a] bg-[#121212] p-4">
              <img
                src={resolverLogoEmpresa(empresaAtual?.logo_url)}
                alt="Logo atual"
                className="h-16 w-16 shrink-0 rounded-2xl border border-[#27272a] bg-black object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{empresaAtual?.nome || 'Barbearia'}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">PNG, JPG ou WEBP até 2 MB.</p>
              </div>
            </div>

            <label className="block cursor-pointer rounded-2xl border border-dashed border-[#CEAA6B]/35 bg-[#CEAA6B]/5 p-4 text-center active:scale-[0.99]">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  setLogoErro('');
                  setLogoFile(event.target.files?.[0] || null);
                }}
              />
              <span className="block text-sm font-black text-[#CEAA6B]">
                {logoFile ? logoFile.name : 'Selecionar imagem'}
              </span>
            </label>

            {logoErro && (
              <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                {logoErro}
              </p>
            )}

            <button
              type="button"
              onClick={salvarLogo}
              disabled={salvandoLogo}
              className="mt-4 w-full rounded-2xl bg-[#CEAA6B] py-4 text-sm font-black text-black active:scale-95 disabled:opacity-60"
            >
              {salvandoLogo ? 'Salvando...' : 'Salvar logo'}
            </button>

            {logoAtualStoragePath && (
              <button
                type="button"
                onClick={removerLogo}
                disabled={salvandoLogo}
                className="mt-3 w-full rounded-2xl border border-red-500/20 bg-red-500/5 py-4 text-xs font-black uppercase tracking-[0.16em] text-red-400 active:scale-95 disabled:opacity-60"
              >
                Remover logo
              </button>
            )}
          </div>
        </div>
      )}

      {modalPix && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-end justify-center p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-[#27272a] bg-[#09090b] p-5 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#CEAA6B]">Pagamento</p>
                <h3 className="mt-1 text-xl font-black text-white">Chave Pix</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalPix(false);
                  setConfirmarPix(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#181818] text-zinc-500"
              >
                x
              </button>
            </div>

            {!confirmarPix ? (
              <>
                <div className="mb-4 rounded-2xl border border-[#27272a] bg-[#121212] p-4">
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Nova chave Pix
                  </label>
                  <input
                    type="text"
                    value={chavePix}
                    onChange={(event) => {
                      setPixErro('');
                      setChavePix(event.target.value);
                    }}
                    placeholder="CPF, telefone, email ou chave aleatoria"
                    className="w-full rounded-xl border border-[#27272a] bg-[#09090b] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-[#CEAA6B]/60"
                  />
                  <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                    Essa chave aparece para o cliente nas telas de pagamento do plano.
                  </p>
                </div>

                {pixErro && (
                  <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                    {pixErro}
                  </p>
                )}

                <button
                  type="button"
                  onClick={solicitarConfirmacaoPix}
                  disabled={salvandoPix}
                  className="w-full rounded-2xl bg-[#CEAA6B] py-4 text-sm font-black text-black active:scale-95 disabled:opacity-60"
                >
                  Continuar
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 rounded-2xl border border-[#CEAA6B]/30 bg-[#CEAA6B]/5 p-4">
                  <p className="text-sm font-black text-white">Confirme antes de alterar</p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    Verifique se a chave Pix abaixo esta correta. Ela sera mostrada aos clientes nos pagamentos.
                  </p>
                  <div className="mt-4 rounded-xl border border-[#27272a] bg-[#09090b] px-4 py-3 text-sm font-black text-[#CEAA6B] break-words">
                    {chavePix.trim()}
                  </div>
                </div>

                {pixErro && (
                  <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                    {pixErro}
                  </p>
                )}

                <button
                  type="button"
                  onClick={salvarPix}
                  disabled={salvandoPix}
                  className="w-full rounded-2xl bg-[#CEAA6B] py-4 text-sm font-black text-black active:scale-95 disabled:opacity-60"
                >
                  {salvandoPix ? 'Salvando...' : 'Sim, alterar chave Pix'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarPix(false)}
                  disabled={salvandoPix}
                  className="mt-2 w-full rounded-2xl border border-[#27272a] bg-[#121212] py-4 text-xs font-black uppercase tracking-[0.16em] text-zinc-400 active:scale-95 disabled:opacity-60"
                >
                  Voltar e corrigir
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Modal Financeiro */}
      {modalFinanceiro && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#09090b] border border-[#27272a] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out]">
            <div className="relative p-6 pb-0">
              <button
                onClick={() => setModalFinanceiro(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-[#121212] border border-[#27272a] flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#CEAA6B] flex items-center justify-center text-black shadow-[0_0_15px_rgba(206,170,107,0.2)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">Financeiro</h3>
              </div>
            </div>

            <div className="p-6 pt-2 space-y-4">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#121212] to-[#09090b] p-5 rounded-[24px] border border-[#27272a] group">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#CEAA6B]/5 rounded-full blur-2xl group-hover:bg-[#CEAA6B]/10 transition-all" />
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1.5">Faturamento Atual</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white tracking-tighter">
                    {formatarMoeda(dadosFinanceiros?.faturamentoMensal || 0).split(',')[0]}
                  </span>
                  <span className="text-base font-bold text-[#CEAA6B]">
                    ,{formatarMoeda(dadosFinanceiros?.faturamentoMensal || 0).split(',')[1]}
                  </span>
                </div>
              </div>

              <div className="bg-[#121212]/50 p-5 rounded-[24px] border border-[#27272a] flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-0.5">Previsão próximo mês</p>
                  <p className="text-lg font-black text-emerald-500 tracking-tight">{formatarMoeda(dadosFinanceiros?.previsaoProximoMes || 0)}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                </div>
              </div>

              <div className="flex justify-between items-center px-4 py-3 bg-[#121212] rounded-xl border border-[#27272a]">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Assinantes Ativos</span>
                <span className="text-xs font-black text-white">{dadosFinanceiros?.totalAtivos || 0}</span>
              </div>

              <button
                onClick={() => setModalFinanceiro(false)}
                className="w-full bg-white text-black font-black py-4 rounded-[20px] uppercase tracking-[0.2em] text-[9px] active:scale-95 transition-all shadow-[0_8px_15px_rgba(255,255,255,0.1)]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


