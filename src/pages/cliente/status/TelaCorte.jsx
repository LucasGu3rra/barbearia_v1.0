/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../contexts/useAuth';
import { montarRotaEmpresa } from '../../../services/empresa';

export default function TelaCorte() {
  const navigate = useNavigate();
  const { empresaSlug } = useParams();
  const { user, empresaAtual, loading: authLoading } = useAuth();
  const empresaId = empresaAtual?.id;
  const slugEmpresa = empresaAtual?.slug || empresaSlug;
  const [cancelando, setCancelando] = useState(false);
  const [agoraMs, setAgoraMs] = useState(0);
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
    setAgoraMs(new Date().getTime());
    const id = user?.id || localStorage.getItem('clienteId') || sessionStorage.getItem('clienteId');

    if (!id) {
      navigate(empresaSlug ? montarRotaEmpresa(empresaSlug, '') : '/');
      return;
    }

    const { data: dadosPlanos } = await supabase
      .from('planos')
      .select('slug, nome, limite, ilimitado')
      .eq('empresa_id', empresaId);
    const mapaPlanos = {};
    dadosPlanos?.forEach((plano) => {
      mapaPlanos[plano.slug] = plano;
    });

    const { data: cli } = await supabase
      .from('clientes')
      .select('nome, assinaturas(status, data_vencimento, plano_escolhido)')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .single();

    const assinatura = cli?.assinaturas?.find((item) => item.status === 'ativa') || cli?.assinaturas?.[0];
    const planoAtual = mapaPlanos[assinatura?.plano_escolhido] || null;
    const limiteDoPlano = planoAtual?.ilimitado ? 0 : planoAtual?.limite || 0;

    const { data: ultimoCorte } = await supabase
      .from('historico_cortes')
      .select('id, tipo_corte, created_at, origem, status, cancelavel_ate')
      .eq('empresa_id', empresaId)
      .eq('cliente_id', id)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();

    const { count } = await supabase
      .from('historico_cortes')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('cliente_id', id)
      .neq('status', 'cancelado')
      .gte('created_at', primeiroDiaMes);

    setDados({
      nome: cli?.nome || 'Cliente',
      cortes: count || 0,
      ilimitado: Boolean(planoAtual?.ilimitado),
      limiteTotal: limiteDoPlano,
      planoNome: planoAtual?.nome || 'Plano',
      vencimento: assinatura?.data_vencimento
        ? new Date(assinatura.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '--/--',
      tipoCorte: ultimoCorte?.tipo_corte || planoAtual?.nome || 'Plano',
      corteId: ultimoCorte?.origem === 'plano_confirmacao' ? ultimoCorte.id : null,
      cancelavelAte: ultimoCorte?.origem === 'plano_confirmacao' ? ultimoCorte.cancelavel_ate : null,
    });
  }, [empresaId, empresaSlug, navigate, user?.id]);

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
    setCancelando(true);
    const { error } = await supabase.rpc('cancelar_corte_plano', { p_corte_id: dados.corteId });
    setCancelando(false);

    if (error) {
      alert('Nao foi possivel cancelar este corte. O prazo pode ter expirado.');
      return;
    }

    await carregarDadosValidacao();
    navigate(montarRotaEmpresa(slugEmpresa, '/dashboard'));
  };

  const scissorsPath = 'M9.64,7.64 C9.87,7.14 10,6.59 10,6 C10,3.79 8.21,2 6,2 C3.79,2 2,3.79 2,6 C2,8.21 3.79,10 6,10 C6.59,10 7.14,9.87 7.64,9.64 L10,12 L7.64,14.36 C7.14,14.13 6.59,14 6,14 C3.79,14 2,15.79 2,18 C2,20.21 3.79,22 6,22 C8.21,22 10,20.21 10,18 C10,17.41 9.87,16.86 9.64,16.36 L12,14 L19,21 H22 V20 L9.64,7.64 Z M6,8 C4.9,8 4,7.1 4,6 C4,4.9 4.9,4 6,4 C7.1,4 8,4.9 8,6 C8,7.1 7.1,8 6,8 Z M6,20 C4.9,20 4,19.1 4,18 C4,16.9 4.9,16 6,16 C7.1,16 8,16.9 8,18 C8,19.1 7.1,20 6,20 Z M19,3 L12,10 L14,12 L22,4 V3 H19 Z';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center pt-10 pb-8 px-5 font-sans relative">
      <h2 className="text-[#b67b36] text-[10px] font-medium tracking-[0.25em] uppercase text-center mb-8">
        {(empresaAtual?.nome || 'Barbearia').toUpperCase()}
      </h2>

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

        <p className="text-[#22a04c] text-[11px] font-bold uppercase tracking-[0.1em] mb-1">
          Plano confirmado
        </p>
        <h1 className="text-[#3bf876] text-4xl font-black tracking-tight mb-2 drop-shadow-[0_0_8px_rgba(59,248,118,0.3)]">
          LIBERADO
        </h1>
        <p className="text-[#1b6231] text-sm mb-8 font-medium">
          Mostre esta tela ao barbeiro.
        </p>

        <div className="w-full bg-[#070c08] border border-[#102115] rounded-xl p-3 flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-[#0e351d] rounded-full flex items-center justify-center font-bold text-[#3cf072] text-sm">
            {dados.nome ? dados.nome.substring(0, 2).toUpperCase() : ''}
          </div>
          <div>
            <p className="font-bold text-[15px] text-white tracking-wide">{dados.nome}</p>
            <p className="text-[11px] text-[#3cf072] font-bold uppercase mt-[2px]">{dados.planoNome}</p>
            <p className="text-[10px] text-[#1b6231] font-bold uppercase mt-[2px]">{dados.tipoCorte}</p>
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
          <button
            type="button"
            onClick={cancelarCorte}
            disabled={cancelando}
            className="w-full mt-4 bg-[#1b0b0b] border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm font-black disabled:opacity-60"
          >
            {cancelando ? 'Cancelando...' : 'Cancelar confirmacao do corte'}
          </button>
        )}
      </div>

      <div className="mt-8 mb-6 text-center">
        <p className="text-[#2a2a2a] text-[11px] font-medium mb-6">
          O cancelamento fica disponivel somente dentro do prazo configurado.
        </p>
        <button
          onClick={() => navigate(montarRotaEmpresa(slugEmpresa, '/dashboard'))}
          className="bg-[#070707] border border-[#1c1c1c] text-[#3f3f3f] px-6 py-2.5 rounded-lg text-sm font-medium hover:text-[#555] transition-colors"
        >
          Voltar ao inicio
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
