import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabase';

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

export default function MasterDashboard() {
  const [session, setSession] = useState(null);
  const [verificando, setVerificando] = useState(true);
  const [verificandoMaster, setVerificandoMaster] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [login, setLogin] = useState({ email: '', senha: '' });
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingCriacao, setLoadingCriacao] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);
  const [form, setForm] = useState({
    empresaNome: '',
    slug: '',
    empresaWhatsapp: '',
    chavePix: '',
    donoNome: '',
    donoEmail: '',
    donoSenha: '',
    donoWhatsapp: '',
    filialNome: 'Matriz',
  });

  const slugSugerido = useMemo(() => slugify(form.empresaNome), [form.empresaNome]);

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
        setErro('Nao foi possivel verificar o acesso master.');
        setVerificandoMaster(false);
        return;
      }

      setIsMaster(Boolean(data));
      setVerificandoMaster(false);
    };

    checarMaster();

    return () => {
      ativo = false;
    };
  }, [session]);

  const atualizarCampo = (campo, valor) => {
    setResultado(null);
    setErro('');
    setForm((atual) => ({ ...atual, [campo]: valor }));
  };

  const preencherSlug = () => {
    setForm((atual) => ({ ...atual, slug: slugSugerido }));
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
    await supabase.auth.signOut();
    setResultado(null);
    setErro('');
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
    };

    const { data, error } = await supabase.functions.invoke('criar-empresa-master', {
      body: payload,
    });

    if (error || data?.error) {
      setErro(data?.error || error?.message || 'Nao foi possivel criar a empresa.');
    } else {
      setResultado(data);
      setForm({
        empresaNome: '',
        slug: '',
        empresaWhatsapp: '',
        chavePix: '',
        donoNome: '',
        donoEmail: '',
        donoSenha: '',
        donoWhatsapp: '',
        filialNome: 'Matriz',
      });
    }

    setLoadingCriacao(false);
  };

  if (verificando || verificandoMaster) return null;

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-[380px] bg-[#121212] border border-[#27272a] rounded-[28px] p-8 shadow-2xl">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white">Master</h1>
            <p className="text-zinc-500 text-xs mt-1">Acesse para criar novas barbearias</p>
          </header>

          <form onSubmit={entrar} className="space-y-5">
            <input
              required
              type="email"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm"
              placeholder="E-mail"
              value={login.email}
              onChange={(event) => setLogin((atual) => ({ ...atual, email: event.target.value }))}
            />
            <input
              required
              type="password"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm"
              placeholder="Senha"
              value={login.senha}
              onChange={(event) => setLogin((atual) => ({ ...atual, senha: event.target.value }))}
            />
            {erro && <p className="text-red-400 text-xs text-center">{erro}</p>}
            <button type="submit" disabled={loadingLogin} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl active:scale-95 transition-all">
              {loadingLogin ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!isMaster) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-[380px] bg-[#121212] border border-[#27272a] rounded-[28px] p-8 shadow-2xl text-center">
          <h1 className="text-2xl font-bold">Acesso negado</h1>
          <p className="text-zinc-500 text-sm mt-3">Esta conta nao tem permissao master.</p>
          <button onClick={sair} className="mt-6 w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl active:scale-95 transition-all">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white px-6 py-8 font-sans">
      <main className="w-full max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Master</h1>
            <p className="text-zinc-500 text-sm mt-1">Criar nova barbearia</p>
          </div>
          <button onClick={sair} className="bg-[#121212] border border-[#27272a] text-zinc-300 px-4 py-3 rounded-xl text-sm font-bold">
            Sair
          </button>
        </header>

        <form onSubmit={criarEmpresa} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-[#121212] border border-[#27272a] rounded-[20px] p-6 space-y-4">
            <h2 className="text-lg font-bold">Empresa</h2>
            <input required className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="Nome da barbearia" value={form.empresaNome} onChange={(event) => atualizarCampo('empresaNome', event.target.value)} />
            <div className="flex gap-2">
              <input required className="flex-1 bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="slug-da-barbearia" value={form.slug} onChange={(event) => atualizarCampo('slug', slugify(event.target.value))} />
              <button type="button" onClick={preencherSlug} className="bg-[#27272a] text-white px-4 rounded-xl text-xs font-bold">
                Gerar
              </button>
            </div>
            <input required className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="WhatsApp da empresa" value={form.empresaWhatsapp} onChange={(event) => atualizarCampo('empresaWhatsapp', event.target.value)} />
            <input className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="Chave Pix" value={form.chavePix} onChange={(event) => atualizarCampo('chavePix', event.target.value)} />
            <input className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="Nome da filial" value={form.filialNome} onChange={(event) => atualizarCampo('filialNome', event.target.value)} />
          </section>

          <section className="bg-[#121212] border border-[#27272a] rounded-[20px] p-6 space-y-4">
            <h2 className="text-lg font-bold">Dono</h2>
            <input required className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="Nome do dono" value={form.donoNome} onChange={(event) => atualizarCampo('donoNome', event.target.value)} />
            <input required type="email" className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="E-mail do dono" value={form.donoEmail} onChange={(event) => atualizarCampo('donoEmail', event.target.value)} />
            <input required type="password" className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="Senha temporaria" value={form.donoSenha} onChange={(event) => atualizarCampo('donoSenha', event.target.value)} />
            <input className="w-full bg-[#09090b] border border-[#27272a] rounded-xl p-4 outline-none focus:border-[#CEAA6B] text-sm" placeholder="WhatsApp do dono" value={form.donoWhatsapp} onChange={(event) => atualizarCampo('donoWhatsapp', event.target.value)} />

            {erro && <p className="text-red-400 text-sm">{erro}</p>}
            <button type="submit" disabled={loadingCriacao} className="w-full bg-[#CEAA6B] text-black font-bold py-4 rounded-2xl active:scale-95 transition-all">
              {loadingCriacao ? 'Criando...' : 'Criar barbearia'}
            </button>
          </section>
        </form>

        {resultado?.ok && (
          <section className="mt-6 bg-[#121212] border border-[#27272a] rounded-[20px] p-6">
            <h2 className="text-lg font-bold text-[#CEAA6B]">Barbearia criada</h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <p className="bg-[#09090b] border border-[#27272a] rounded-xl p-4">/{resultado.empresa.slug}/login</p>
              <p className="bg-[#09090b] border border-[#27272a] rounded-xl p-4">{resultado.links.admin}</p>
              <p className="bg-[#09090b] border border-[#27272a] rounded-xl p-4">{resultado.links.cadastro}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
