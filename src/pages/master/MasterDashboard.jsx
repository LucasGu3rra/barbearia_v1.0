import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOutWithPushCleanup } from '../../services/authSession';
import { supabase } from '../../services/supabase';

const DIAS_VENCIMENTO = [5, 10, 15, 20];

const slugify = (valor) => valor
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizarTelefoneBrasil = (valor) => {
  const numeros = valor.replace(/\D/g, '');
  if (!numeros) return '';
  if (numeros.startsWith('55')) return numeros;
  if (numeros.length === 10 || numeros.length === 11) return `55${numeros}`;
  return numeros;
};

const proximoVencimentoParaDia = (dia) => {
  const hoje = new Date();
  let data = new Date(hoje.getFullYear(), hoje.getMonth(), Number(dia), 12, 0, 0);
  if (data <= hoje) data = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Number(dia), 12, 0, 0);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const numeroDia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${numeroDia}`;
};

const criarFormularioInicial = () => ({
  empresaNome: '',
  slug: '',
  empresaWhatsapp: '',
  chavePix: '',
  donoNome: '',
  donoEmail: '',
  donoSenha: '',
  donoWhatsapp: '',
  filialNome: 'Matriz',
  planoSistemaCodigo: 'basico',
  valorMensal: '',
  diaVencimento: '10',
  primeiroVencimento: proximoVencimentoParaDia(10),
});

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(valor || 0));

const formatarData = (valor) => {
  if (!valor) return 'Sem vencimento';
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
  if (!ano || !mes || !dia) return 'Data inválida';
  return `${dia}/${mes}/${ano}`;
};

const statusVisual = {
  ativo: { label: 'Ativo', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  cortesia: { label: 'Cortesia', className: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  vencido: { label: 'Vencido', className: 'border-red-500/30 bg-red-500/10 text-red-400' },
  suspenso: { label: 'Suspenso', className: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
  cancelado: { label: 'Cancelado', className: 'border-zinc-600 bg-zinc-800 text-zinc-400' },
};

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    building: <><path d="M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" /><path d="M16 8h3a1 1 0 0 1 1 1v12" /><path d="M8 7h4M8 11h4M8 15h4M3 21h18" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    wallet: <><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6" /><path d="M16 13h2" /></>,
    alert: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 11a8 8 0 1 0 2 5" /><path d="M20 4v7h-7" /></>,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.building}
    </svg>
  );
}

function StatusBadge({ status }) {
  const visual = statusVisual[status] || statusVisual.cancelado;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${visual.className}`}>
      {visual.label}
    </span>
  );
}

function StatCard({ label, value, icon, tone = 'default' }) {
  const toneClass = tone === 'danger' ? 'text-red-400' : tone === 'gold' ? 'text-[#d5b451]' : 'text-white';
  return (
    <div className="rounded-lg border border-[#27272a] bg-[#121212] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#211e16] text-[#d5b451]">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-[#2b2b2f] bg-[#09090b] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#CEAA6B]/70';
const labelClass = 'mb-2 block text-[11px] font-bold text-zinc-500';

export default function MasterDashboard() {
  const [session, setSession] = useState(null);
  const [verificando, setVerificando] = useState(true);
  const [verificandoMaster, setVerificandoMaster] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [login, setLogin] = useState({ email: '', senha: '' });
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingCriacao, setLoadingCriacao] = useState(false);
  const [carregandoPainel, setCarregandoPainel] = useState(true);
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false);
  const [confirmandoPagamento, setConfirmandoPagamento] = useState(false);
  const [confirmacaoPagamentoAberta, setConfirmacaoPagamentoAberta] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [resultado, setResultado] = useState(null);
  const [painel, setPainel] = useState({ resumo: {}, empresas: [], planos: [] });
  const [busca, setBusca] = useState('');
  const [modalNovaEmpresa, setModalNovaEmpresa] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);
  const [form, setForm] = useState(criarFormularioInicial);
  const [assinaturaForm, setAssinaturaForm] = useState({
    planoCodigo: 'basico',
    status: 'cortesia',
    valorMensal: '',
    diaVencimento: '10',
    primeiroVencimento: proximoVencimentoParaDia(10),
  });

  const slugSugerido = useMemo(() => slugify(form.empresaNome), [form.empresaNome]);
  const planoNovaEmpresa = painel.planos.find((plano) => plano.codigo === form.planoSistemaCodigo);
  const planoEdicao = painel.planos.find((plano) => plano.codigo === assinaturaForm.planoCodigo);
  const cobrancaNovaEmpresa = !planoNovaEmpresa?.sem_vencimento;
  const cobrancaEdicao = !planoEdicao?.sem_vencimento && !['cortesia', 'cancelado'].includes(assinaturaForm.status);

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return painel.empresas;
    return painel.empresas.filter((empresa) => [empresa.nome, empresa.slug, empresa.dono_email]
      .some((valor) => String(valor || '').toLocaleLowerCase('pt-BR').includes(termo)));
  }, [busca, painel.empresas]);

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      const { data } = await supabase.auth.getSession();
      if (!ativo) return;
      setSession(data.session);
      setVerificando(false);
    };

    carregar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, novaSession) => {
      setSession(novaSession);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    const checarMaster = async () => {
      setErro('');
      setIsMaster(false);
      if (!session?.user) {
        setVerificandoMaster(false);
        return;
      }

      setVerificandoMaster(true);
      const { data, error } = await supabase
        .from('master_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!ativo) return;
      if (error) {
        setErro('Não foi possível verificar o acesso master.');
        setVerificandoMaster(false);
        return;
      }

      setIsMaster(Boolean(data));
      setVerificandoMaster(false);
    };

    checarMaster();
    return () => { ativo = false; };
  }, [session]);

  const carregarPainel = useCallback(async () => {
    setCarregandoPainel(true);
    setErro('');
    const { data, error } = await supabase.rpc('master_dashboard_bootstrap');
    if (error) {
      setErro('Não foi possível carregar as barbearias.');
    } else {
      setPainel({
        resumo: data?.resumo || {},
        empresas: data?.empresas || [],
        planos: data?.planos || [],
      });
    }
    setCarregandoPainel(false);
  }, []);

  useEffect(() => {
    if (!isMaster) return undefined;

    let ativo = true;
    const carregar = async () => {
      const { data, error } = await supabase.rpc('master_dashboard_bootstrap');
      if (!ativo) return;

      if (error) {
        setErro('Não foi possível carregar as barbearias.');
      } else {
        setPainel({
          resumo: data?.resumo || {},
          empresas: data?.empresas || [],
          planos: data?.planos || [],
        });
      }
      setCarregandoPainel(false);
    };

    carregar();
    return () => { ativo = false; };
  }, [isMaster]);

  const atualizarCampo = (campo, valor) => {
    setResultado(null);
    setErro('');
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const atualizarDiaNovaEmpresa = (valor) => {
    setForm((atual) => ({
      ...atual,
      diaVencimento: valor,
      primeiroVencimento: proximoVencimentoParaDia(Number(valor)),
    }));
  };

  const atualizarDiaAssinatura = (valor) => {
    setAssinaturaForm((atual) => ({
      ...atual,
      diaVencimento: valor,
      primeiroVencimento: proximoVencimentoParaDia(Number(valor)),
    }));
  };

  const entrar = async (event) => {
    event.preventDefault();
    setErro('');
    setLoadingLogin(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: login.email.trim().toLowerCase(),
      password: login.senha,
    });
    if (error) setErro('E-mail ou senha incorretos.');
    setLoadingLogin(false);
  };

  const sair = async () => {
    await signOutWithPushCleanup();
    setResultado(null);
    setErro('');
  };

  const abrirNovaEmpresa = () => {
    setForm(criarFormularioInicial());
    setResultado(null);
    setErro('');
    setModalNovaEmpresa(true);
  };

  const criarEmpresa = async (event) => {
    event.preventDefault();
    setErro('');
    setResultado(null);
    setLoadingCriacao(true);

    const payload = {
      ...form,
      slug: form.slug || slugSugerido,
      empresaWhatsapp: normalizarTelefoneBrasil(form.empresaWhatsapp),
      donoWhatsapp: normalizarTelefoneBrasil(form.donoWhatsapp || form.empresaWhatsapp),
      valorMensal: cobrancaNovaEmpresa ? Number(form.valorMensal) : 0,
      diaVencimento: cobrancaNovaEmpresa ? Number(form.diaVencimento) : null,
      primeiroVencimento: cobrancaNovaEmpresa ? form.primeiroVencimento : null,
    };

    const { data, error } = await supabase.functions.invoke('criar-empresa-master', { body: payload });

    if (error || data?.error) {
      setErro(data?.error || error?.message || 'Não foi possível criar a empresa.');
    } else {
      setResultado(data);
      setModalNovaEmpresa(false);
      setMensagem(`${data.empresa.nome} foi criada com o plano ${data.assinatura.plano}.`);
      await carregarPainel();
    }

    setLoadingCriacao(false);
  };

  const abrirEmpresa = (empresa) => {
    const assinatura = empresa.assinatura || {};
    const dia = String(assinatura.dia_vencimento || 10);
    setEmpresaSelecionada(empresa);
    setConfirmacaoPagamentoAberta(false);
    setErro('');
    setMensagem('');
    setAssinaturaForm({
      planoCodigo: assinatura.plano_codigo || 'basico',
      status: assinatura.status || 'cortesia',
      valorMensal: assinatura.valor_mensal ? String(assinatura.valor_mensal) : '',
      diaVencimento: dia,
      primeiroVencimento: assinatura.proximo_vencimento || proximoVencimentoParaDia(Number(dia)),
    });
  };

  const salvarAssinatura = async () => {
    if (!empresaSelecionada || salvandoAssinatura) return;
    setSalvandoAssinatura(true);
    setErro('');

    const { error } = await supabase.rpc('master_atualizar_assinatura_empresa', {
      p_empresa_id: empresaSelecionada.id,
      p_plano_codigo: assinaturaForm.planoCodigo,
      p_status: assinaturaForm.status,
      p_valor_mensal: cobrancaEdicao ? Number(assinaturaForm.valorMensal) : 0,
      p_dia_vencimento: cobrancaEdicao ? Number(assinaturaForm.diaVencimento) : null,
      p_primeiro_vencimento: cobrancaEdicao ? assinaturaForm.primeiroVencimento : null,
    });

    if (error) {
      const mensagens = {
        valor_mensal_invalido: 'Informe um valor mensal maior que zero.',
        dia_vencimento_invalido: 'Selecione um dia de vencimento válido.',
        primeiro_vencimento_invalido: 'O vencimento precisa usar o dia selecionado.',
      };
      setErro(mensagens[error.message] || 'Não foi possível atualizar a assinatura.');
    } else {
      setMensagem('Assinatura atualizada com segurança.');
      setEmpresaSelecionada(null);
      await carregarPainel();
    }
    setSalvandoAssinatura(false);
  };

  const confirmarPagamento = async () => {
    if (!empresaSelecionada || confirmandoPagamento) return;
    setConfirmandoPagamento(true);
    setErro('');
    const { error } = await supabase.rpc('master_confirmar_mensalidade_empresa', {
      p_empresa_id: empresaSelecionada.id,
    });
    if (error) {
      setErro('Não foi possível confirmar esta mensalidade.');
    } else {
      setMensagem('Pagamento confirmado e próximo vencimento gerado.');
      setEmpresaSelecionada(null);
      await carregarPainel();
    }
    setConfirmandoPagamento(false);
  };

  if (verificando || verificandoMaster) {
    return <div className="min-h-screen bg-[#09090b]" />;
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-5 text-white">
        <div className="w-full max-w-[360px] rounded-lg border border-[#27272a] bg-[#121212] p-6 shadow-2xl">
          <header className="mb-6">
            <p className="text-xs font-bold text-[#CEAA6B]">BarbeariaClick</p>
            <h1 className="mt-2 text-2xl font-black">Painel master</h1>
            <p className="mt-2 text-sm text-zinc-500">Acesso administrativo da plataforma.</p>
          </header>
          <form onSubmit={entrar} className="space-y-4">
            <input required type="email" className={inputClass} placeholder="E-mail" value={login.email} onChange={(event) => setLogin((atual) => ({ ...atual, email: event.target.value }))} />
            <input required type="password" className={inputClass} placeholder="Senha" value={login.senha} onChange={(event) => setLogin((atual) => ({ ...atual, senha: event.target.value }))} />
            {erro && <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{erro}</p>}
            <button type="submit" disabled={loadingLogin} className="w-full rounded-lg bg-[#CEAA6B] py-3.5 text-sm font-black text-black disabled:opacity-60">
              {loadingLogin ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-5 text-white">
        <div className="w-full max-w-[360px] rounded-lg border border-[#27272a] bg-[#121212] p-6 text-center">
          <h1 className="text-xl font-black">Acesso negado</h1>
          <p className="mt-3 text-sm text-zinc-500">Esta conta não possui permissão master.</p>
          <button onClick={sair} className="mt-6 w-full rounded-lg bg-[#CEAA6B] py-3 text-sm font-black text-black">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-6 text-white sm:px-6">
      <main className="mx-auto w-full max-w-6xl pb-24">
        <header className="flex items-center justify-between gap-4 border-b border-[#202024] pb-5">
          <h1 className="text-lg font-black tracking-tight sm:text-xl">BarbeariaClick <span className="font-medium text-zinc-500">- Master</span></h1>
          <button type="button" onClick={sair} className="h-10 rounded-xl border border-[#2b2b2f] bg-[#121212] px-4 text-sm font-bold text-zinc-300 transition-colors hover:border-[#CEAA6B]/45 hover:text-white">Sair</button>
        </header>

        {mensagem && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <span>{mensagem}</span>
            <button type="button" onClick={() => setMensagem('')} className="text-emerald-300"><Icon name="close" className="h-4 w-4" /></button>
          </div>
        )}
        {erro && !modalNovaEmpresa && !empresaSelecionada && (
          <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{erro}</div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Empresas ativas" value={painel.resumo.empresas_ativas || 0} icon="building" />
          <StatCard label="Clientes cadastrados" value={painel.resumo.clientes_total || 0} icon="users" />
          <StatCard label="Receita mensal" value={formatarMoeda(painel.resumo.receita_mensal_prevista)} icon="wallet" tone="gold" />
          <StatCard label="Mensalidades vencidas" value={painel.resumo.mensalidades_atrasadas || 0} icon="alert" tone={painel.resumo.mensalidades_atrasadas > 0 ? 'danger' : 'default'} />
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Barbearias cadastradas</h2>
              <p className="mt-1 text-xs text-zinc-500">{empresasFiltradas.length} empresa(s) na lista</p>
            </div>
          </div>

          <label className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[#2b2b2f] bg-[#121212] px-4 py-3 text-zinc-500 shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-colors focus-within:border-[#CEAA6B]/50">
            <Icon name="search" className="h-4 w-4 shrink-0" />
            <input value={busca} onChange={(event) => setBusca(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" placeholder="Buscar empresa" />
          </label>

          {carregandoPainel && painel.empresas.length === 0 ? (
            <div className="space-y-3">
              {[0, 1].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg border border-[#27272a] bg-[#121212]" />)}
            </div>
          ) : empresasFiltradas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#333] p-10 text-center text-sm text-zinc-500">Nenhuma barbearia encontrada.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {empresasFiltradas.map((empresa) => {
                const assinatura = empresa.assinatura || {};
                return (
                  <button key={empresa.id} type="button" onClick={() => abrirEmpresa(empresa)} className="group w-full rounded-2xl border border-[#2b2b2f] bg-[#121212] p-4 text-left shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:border-[#CEAA6B]/50 hover:bg-[#151515] hover:shadow-[0_18px_42px_rgba(0,0,0,0.24)]">
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#211e16] text-[#d5b451]"><Icon name="building" className="h-[18px] w-[18px]" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-white">{empresa.nome}</span>
                          <span className="mt-1 block truncate text-[11px] text-zinc-500">/{empresa.slug}</span>
                        </span>
                      </span>
                      <span className="shrink-0"><StatusBadge status={assinatura.status || 'cancelado'} /></span>
                    </span>

                    <span className="mt-4 flex items-end justify-between gap-3 border-b border-[#242428] pb-3">
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Plano atual</span>
                        <span className="mt-1 block truncate text-base font-black text-white">{assinatura.plano_nome || 'Sem plano'}</span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {assinatura.sem_vencimento ? 'Sem vencimento' : `${formatarMoeda(assinatura.valor_mensal)} · vence ${formatarData(assinatura.proximo_vencimento)}`}
                        </span>
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#27272a] text-zinc-600 transition-colors group-hover:border-[#CEAA6B]/40 group-hover:text-[#CEAA6B]"><Icon name="chevron" className="h-4 w-4" /></span>
                    </span>

                    <span className="grid grid-cols-3 gap-3 pt-3">
                      <span><span className="block text-[10px] font-medium text-zinc-600">Clientes</span><span className="mt-1 block text-sm font-black text-zinc-200">{empresa.clientes_total}</span></span>
                      <span><span className="block text-[10px] font-medium text-zinc-600">Barbeiros</span><span className="mt-1 block text-sm font-black text-zinc-200">{empresa.barbeiros_total}</span></span>
                      <span><span className="block text-[10px] font-medium text-zinc-600">Agendamentos</span><span className="mt-1 block text-sm font-black text-zinc-200">{empresa.agendamentos_total}</span></span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <button type="button" onClick={abrirNovaEmpresa} title="Nova barbearia" className="fixed bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#CEAA6B] text-black shadow-xl transition-transform hover:scale-105">
        <Icon name="plus" />
      </button>

      {modalNovaEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#2b2b2f] bg-[#101010] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#242428] bg-[#101010] px-5 py-4">
              <div><p className="text-xs font-bold text-[#CEAA6B]">Cadastro</p><h2 className="mt-1 text-xl font-black">Nova barbearia</h2></div>
              <button type="button" onClick={() => setModalNovaEmpresa(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d1d20] text-zinc-500"><Icon name="close" className="h-4 w-4" /></button>
            </div>

            <form onSubmit={criarEmpresa} className="p-5">
              <div className="grid gap-5 md:grid-cols-2">
                <section>
                  <h3 className="mb-4 text-sm font-black">Empresa</h3>
                  <div className="space-y-4">
                    <div><label className={labelClass}>Nome da barbearia</label><input required className={inputClass} value={form.empresaNome} onChange={(event) => atualizarCampo('empresaNome', event.target.value)} /></div>
                    <div><label className={labelClass}>Slug</label><div className="flex gap-2"><input required className={inputClass} value={form.slug} placeholder={slugSugerido || 'slug-da-barbearia'} onChange={(event) => atualizarCampo('slug', slugify(event.target.value))} /><button type="button" onClick={() => atualizarCampo('slug', slugSugerido)} className="rounded-lg border border-[#333] bg-[#1d1d20] px-4 text-xs font-bold">Gerar</button></div></div>
                    <div><label className={labelClass}>WhatsApp da empresa</label><input required className={inputClass} value={form.empresaWhatsapp} onChange={(event) => atualizarCampo('empresaWhatsapp', event.target.value)} /></div>
                    <div><label className={labelClass}>Chave Pix</label><input className={inputClass} value={form.chavePix} onChange={(event) => atualizarCampo('chavePix', event.target.value)} /></div>
                    <div><label className={labelClass}>Filial inicial</label><input className={inputClass} value={form.filialNome} onChange={(event) => atualizarCampo('filialNome', event.target.value)} /></div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-black">Dono e acesso</h3>
                  <div className="space-y-4">
                    <div><label className={labelClass}>Nome do dono</label><input required className={inputClass} value={form.donoNome} onChange={(event) => atualizarCampo('donoNome', event.target.value)} /></div>
                    <div><label className={labelClass}>E-mail do dono</label><input required type="email" className={inputClass} value={form.donoEmail} onChange={(event) => atualizarCampo('donoEmail', event.target.value)} /></div>
                    <div><label className={labelClass}>Senha temporária</label><input required minLength={6} type="password" className={inputClass} value={form.donoSenha} onChange={(event) => atualizarCampo('donoSenha', event.target.value)} /></div>
                    <div><label className={labelClass}>WhatsApp do dono</label><input className={inputClass} value={form.donoWhatsapp} onChange={(event) => atualizarCampo('donoWhatsapp', event.target.value)} /></div>
                  </div>
                </section>
              </div>

              <section className="mt-6 border-t border-[#242428] pt-5">
                <h3 className="mb-4 text-sm font-black">Assinatura BarbeariaClick</h3>
                <div className={`grid gap-4 ${cobrancaNovaEmpresa ? 'md:grid-cols-4' : 'md:grid-cols-1'}`}>
                  <div><label className={labelClass}>Plano</label><select className={inputClass} value={form.planoSistemaCodigo} onChange={(event) => atualizarCampo('planoSistemaCodigo', event.target.value)}>{painel.planos.map((plano) => <option key={plano.id} value={plano.codigo}>{plano.nome}</option>)}</select></div>
                  {cobrancaNovaEmpresa && <><div><label className={labelClass}>Valor mensal</label><input required type="number" min="0.01" step="0.01" className={inputClass} value={form.valorMensal} onChange={(event) => atualizarCampo('valorMensal', event.target.value)} /></div><div><label className={labelClass}>Dia do vencimento</label><select className={inputClass} value={form.diaVencimento} onChange={(event) => atualizarDiaNovaEmpresa(event.target.value)}>{DIAS_VENCIMENTO.map((dia) => <option key={dia} value={dia}>Dia {dia}</option>)}</select></div><div><label className={labelClass}>Primeiro vencimento</label><input required type="date" className={inputClass} value={form.primeiroVencimento} onChange={(event) => atualizarCampo('primeiroVencimento', event.target.value)} /></div></>}
                </div>
                {planoNovaEmpresa?.sem_vencimento && <p className="mt-3 text-xs text-zinc-500">O plano ilimitado não gera mensalidade nem vencimento.</p>}
              </section>

              {erro && <p className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{erro}</p>}
              <div className="mt-6 flex justify-end gap-3 border-t border-[#242428] pt-5">
                <button type="button" onClick={() => setModalNovaEmpresa(false)} className="rounded-lg border border-[#333] px-5 py-3 text-sm font-bold text-zinc-400">Cancelar</button>
                <button type="submit" disabled={loadingCriacao} className="rounded-lg bg-[#CEAA6B] px-6 py-3 text-sm font-black text-black disabled:opacity-60">{loadingCriacao ? 'Criando...' : 'Criar barbearia'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {empresaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#2b2b2f] bg-[#101010] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0"><p className="truncate text-lg font-black">{empresaSelecionada.nome}</p><p className="mt-1 truncate text-xs text-zinc-500">/{empresaSelecionada.slug} · {empresaSelecionada.dono_email}</p></div>
              <button type="button" onClick={() => setEmpresaSelecionada(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d1d20] text-zinc-500"><Icon name="close" className="h-4 w-4" /></button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-y border-[#242428] py-4 text-center">
              <div><p className="text-[10px] text-zinc-600">Clientes</p><p className="mt-1 text-base font-black">{empresaSelecionada.clientes_total}</p></div>
              <div><p className="text-[10px] text-zinc-600">Barbeiros</p><p className="mt-1 text-base font-black">{empresaSelecionada.barbeiros_total}</p></div>
              <div><p className="text-[10px] text-zinc-600">Agendamentos</p><p className="mt-1 text-base font-black">{empresaSelecionada.agendamentos_total}</p></div>
            </div>

            <div className="mt-5 space-y-4">
              <div><label className={labelClass}>Plano da BarbeariaClick</label><select className={inputClass} value={assinaturaForm.planoCodigo} onChange={(event) => setAssinaturaForm((atual) => ({ ...atual, planoCodigo: event.target.value }))}>{painel.planos.map((plano) => <option key={plano.id} value={plano.codigo}>{plano.nome}</option>)}</select></div>
              {!planoEdicao?.sem_vencimento && <div><label className={labelClass}>Status</label><select className={inputClass} value={assinaturaForm.status} onChange={(event) => setAssinaturaForm((atual) => ({ ...atual, status: event.target.value }))}><option value="ativo">Ativo</option><option value="cortesia">Cortesia</option><option value="vencido">Vencido</option><option value="suspenso">Suspenso</option><option value="cancelado">Cancelado</option></select></div>}

              {cobrancaEdicao && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><label className={labelClass}>Valor mensal</label><input type="number" min="0.01" step="0.01" className={inputClass} value={assinaturaForm.valorMensal} onChange={(event) => setAssinaturaForm((atual) => ({ ...atual, valorMensal: event.target.value }))} /></div><div><label className={labelClass}>Dia</label><select className={inputClass} value={assinaturaForm.diaVencimento} onChange={(event) => atualizarDiaAssinatura(event.target.value)}>{DIAS_VENCIMENTO.map((dia) => <option key={dia} value={dia}>Dia {dia}</option>)}</select></div><div><label className={labelClass}>Próximo vencimento</label><input type="date" className={inputClass} value={assinaturaForm.primeiroVencimento} onChange={(event) => setAssinaturaForm((atual) => ({ ...atual, primeiroVencimento: event.target.value }))} /></div></div>}
            </div>

            {empresaSelecionada.mensalidade_aberta && (
              <div className="mt-5 rounded-lg border border-[#CEAA6B]/25 bg-[#CEAA6B]/5 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-zinc-500">Mensalidade aberta</p><p className="mt-1 text-base font-black">{formatarMoeda(empresaSelecionada.mensalidade_aberta.valor)}</p><p className="mt-1 text-xs text-zinc-500">Vence em {formatarData(empresaSelecionada.mensalidade_aberta.vencimento)}</p></div><StatusBadge status={empresaSelecionada.mensalidade_aberta.status === 'vencida' ? 'vencido' : 'ativo'} /></div>
                {!confirmacaoPagamentoAberta ? <button type="button" onClick={() => setConfirmacaoPagamentoAberta(true)} className="mt-4 w-full rounded-lg border border-[#CEAA6B]/35 py-3 text-sm font-black text-[#CEAA6B]">Confirmar pagamento</button> : <div className="mt-4"><p className="text-xs leading-relaxed text-zinc-400">Confirma que o pagamento foi recebido? O próximo vencimento será criado automaticamente.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmacaoPagamentoAberta(false)} className="rounded-lg border border-[#333] py-3 text-xs font-bold text-zinc-400">Voltar</button><button type="button" onClick={confirmarPagamento} disabled={confirmandoPagamento} className="rounded-lg bg-[#CEAA6B] py-3 text-xs font-black text-black disabled:opacity-60">{confirmandoPagamento ? 'Confirmando...' : 'Sim, confirmar'}</button></div></div>}
              </div>
            )}

            {erro && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{erro}</p>}
            <button type="button" onClick={salvarAssinatura} disabled={salvandoAssinatura} className="mt-5 w-full rounded-lg bg-[#CEAA6B] py-3.5 text-sm font-black text-black disabled:opacity-60">{salvandoAssinatura ? 'Salvando...' : 'Salvar assinatura'}</button>
          </div>
        </div>
      )}

      {resultado?.ok && <span className="sr-only">Empresa criada: {resultado.empresa.nome}</span>}
    </div>
  );
}
