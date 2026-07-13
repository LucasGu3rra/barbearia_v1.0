/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../contexts/useAuth';
import { montarRotaEmpresa } from '../../../services/empresa';

export default function TelaCorte() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { empresaSlug } = useParams();
  const { user, empresaAtual, loading: authLoading } = useAuth();
  const empresaId = empresaAtual?.id;
  const slugEmpresa = empresaAtual?.slug || empresaSlug;
  const corteIdRota = searchParams.get('corte');
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [agoraMs, setAgoraMs] = useState(0);
  const [validando, setValidando] = useState(true);
  const [dados, setDados] = useState({
    nome: '',
    cortes: 0,
    vencimento: '',
    tipoCorte: 'Carregando...',
    planoNome: 'Plano',
    ilimitado: false,
    limiteTotal: 0,
    corteId: null,
    cancelavelAte: null,
  });

  const carregarDadosValidacao = useCallback(async () => {
    setValidando(true);
    setAgoraMs(Date.now());
    const id = user?.id;

    if (!id || !empresaId || !corteIdRota) {
      navigate(id ? montarRotaEmpresa(slugEmpresa, '/dashboard') : empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/', { replace: true });
      return;
    }

    const { data: confirmacao, error } = await supabase.rpc('obter_confirmacao_corte_plano', {
      p_empresa_id: empresaId,
      p_corte_id: corteIdRota,
    });

    if (error || !confirmacao?.corte_id) {
      if (error) console.error('Erro ao validar confirmação do corte:', error);
      navigate(montarRotaEmpresa(slugEmpresa, '/dashboard'), { replace: true });
      return;
    }

    setDados({
      nome: confirmacao.nome || 'Cliente',
      cortes: Number(confirmacao.cortes || 0),
      ilimitado: Boolean(confirmacao.ilimitado),
      limiteTotal: Number(confirmacao.limite_total || 0),
      planoNome: confirmacao.plano_nome || 'Plano',
      vencimento: confirmacao.vencimento
        ? new Date(confirmacao.vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '--/--',
      tipoCorte: confirmacao.tipo_corte || confirmacao.plano_nome || 'Plano',
      corteId: confirmacao.corte_id,
      cancelavelAte: confirmacao.cancelavel_ate || null,
    });
    setValidando(false);
  }, [corteIdRota, empresaId, empresaSlug, navigate, slugEmpresa, user?.id]);

  useEffect(() => {
    if (authLoading || !empresaId) return;
    if (!empresaSlug || empresaAtual?.slug !== empresaSlug) {
      navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/');
      return;
    }

    carregarDadosValidacao();
  }, [authLoading, empresaId, empresaSlug, empresaAtual?.slug, navigate, carregarDadosValidacao]);

  const podeCancelar = (() => {
    if (!dados.corteId || !dados.cancelavelAte) return false;
    const limite = new Date(dados.cancelavelAte);
    return !Number.isNaN(limite.getTime()) && agoraMs <= limite.getTime();
  })();

  const cancelarCorte = async () => {
    if (!dados.corteId || cancelando) return;
    if (!confirmarCancelamento) {
      setConfirmarCancelamento(true);
      return;
    }
    setCancelando(true);
    const { error } = await supabase.rpc('cancelar_corte_plano', { p_corte_id: dados.corteId });
    setCancelando(false);

    if (error) {
      alert('Não foi possível cancelar este corte. O prazo pode ter expirado.');
      return;
    }

    navigate(montarRotaEmpresa(slugEmpresa, '/dashboard'));
  };

  const scissorsPath = 'M9.64,7.64 C9.87,7.14 10,6.59 10,6 C10,3.79 8.21,2 6,2 C3.79,2 2,3.79 2,6 C2,8.21 3.79,10 6,10 C6.59,10 7.14,9.87 7.64,9.64 L10,12 L7.64,14.36 C7.14,14.13 6.59,14 6,14 C3.79,14 2,15.79 2,18 C2,20.21 3.79,22 6,22 C8.21,22 10,20.21 10,18 C10,17.41 9.87,16.86 9.64,16.36 L12,14 L19,21 H22 V20 L9.64,7.64 Z M6,8 C4.9,8 4,7.1 4,6 C4,4.9 4.9,4 6,4 C7.1,4 8,4.9 8,6 C8,7.1 7.1,8 6,8 Z M6,20 C4.9,20 4,19.1 4,18 C4,16.9 4.9,16 6,16 C7.1,16 8,16.9 8,18 C8,19.1 7.1,20 6,20 Z M19,3 L12,10 L14,12 L22,4 V3 H19 Z';

  if (validando) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center pt-8 pb-8 px-5 font-sans relative">
      <div className="w-full max-w-[340px] bg-[#08100a] border border-[#1bc64d] rounded-[24px] p-6 flex flex-col items-center shadow-[0_0_30px_-10px_rgba(27,198,77,0.15)]">
        <div className="w-24 h-24 bg-[#0b1e11] border-2 border-[#143d21] rounded-full mb-6 flex items-center justify-center shadow-[0_0_20px_inset_rgba(59,248,118,0.1)] overflow-hidden">
          <div className="scene flex items-center justify-center w-full h-full">
            <div className="scissor-3d w-12 h-12 relative">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  viewBox="0 0 24 24"
                  className="absolute inset-0 w-full h-full"
                  style={{
                    transform: `translateZ(${(i - 2) * 4}px)`,
                    filter: i === 0 || i === 4 ? 'drop-shadow(0 0 4px #3bf876)' : 'none',
                  }}
                >
                  <path d={scissorsPath} fill="none" stroke="#3bf876" strokeWidth="0.8" className="opacity-80" />
                </svg>
              ))}
            </div>
          </div>
        </div>

        <h1 className="text-[#3bf876] text-4xl font-black tracking-tight mb-2 drop-shadow-[0_0_8px_rgba(59,248,118,0.3)]">
          LIBERADO
        </h1>
        <p className="text-[#7ee89a] text-sm mb-8 font-bold">
          Mostre esta tela ao barbeiro.
        </p>

        <div className="w-full bg-[#070c08] border border-[#102115] rounded-xl p-3 flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-[#0e351d] rounded-full flex items-center justify-center font-bold text-[#3cf072] text-sm">
            {dados.nome ? dados.nome.substring(0, 2).toUpperCase() : ''}
          </div>
          <div>
            <p className="font-bold text-[15px] text-white tracking-wide">{dados.nome}</p>
            <p className="text-[11px] text-[#3cf072] font-bold uppercase mt-[2px]">{dados.planoNome}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-[#070c08] border border-[#102115] p-4 rounded-xl text-center">
            <p className="text-[#16582a] text-[9px] font-bold uppercase tracking-wide mb-2">Cortes Restantes</p>
            <p className="text-2xl font-bold text-[#3df474]">
              {dados.ilimitado ? 'Livre' : Math.max(0, dados.limiteTotal - dados.cortes)}
              <span className="text-[#197034] text-[11px] font-medium ml-1">{dados.ilimitado ? 'ilimitado' : `de ${dados.limiteTotal}`}</span>
            </p>
          </div>
          <div className="bg-[#070c08] border border-[#102115] p-4 rounded-xl text-center">
            <p className="text-[#16582a] text-[9px] font-bold uppercase tracking-wide mb-2">Vencimento</p>
            <p className="text-2xl font-bold text-[#3df474]">{dados.vencimento}</p>
          </div>
        </div>

        {podeCancelar && (
          <div className="w-full mt-4">
            {confirmarCancelamento && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-left">
                <p className="text-sm font-black text-red-200">Atenção!</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-red-100/85">
                  Tem certeza que deseja cancelar este corte? O uso do plano será devolvido.
                </p>
              </div>
            )}
            <div className={confirmarCancelamento ? 'grid grid-cols-2 gap-2' : ''}>
              {confirmarCancelamento && (
                <button
                  type="button"
                  onClick={() => setConfirmarCancelamento(false)}
                  disabled={cancelando}
                  className="w-full border border-[#253329] bg-[#09110b] text-[#9ae8ad] px-4 py-3 rounded-xl text-sm font-black disabled:opacity-60"
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={cancelarCorte}
                disabled={cancelando}
                className="w-full bg-[#1b0b0b] border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm font-black disabled:opacity-60"
              >
                {cancelando ? 'Cancelando...' : confirmarCancelamento ? 'Confirmar' : 'Cancelar confirmação do corte'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 mb-6 text-center">
        <p className="text-zinc-400 text-[12px] font-semibold mb-6 leading-relaxed">
          O cancelamento fica disponível somente dentro do prazo configurado.
        </p>
        <button
          onClick={() => navigate(montarRotaEmpresa(slugEmpresa, '/dashboard'))}
          className="bg-[#101010] border border-[#2a2a2a] text-zinc-300 px-6 py-2.5 rounded-lg text-sm font-bold hover:text-white transition-colors"
        >
          Voltar ao início
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .scene { perspective: 600px; }
        .scissor-3d { transform-style: preserve-3d; animation: spin3D 4s linear infinite; }
        @keyframes spin3D {
          0% { transform: rotateX(-15deg) rotateY(0deg) rotateZ(10deg); }
          100% { transform: rotateX(-15deg) rotateY(360deg) rotateZ(10deg); }
        }
      ` }} />
    </div>
  );
}
