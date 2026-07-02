import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CadastroBody = {
  empresa_slug?: string;
  nome?: string;
  whatsapp?: string;
  aceita_contato_whatsapp?: boolean;
  email?: string;
  senha?: string;
};

const jsonResponse = (body: unknown, status = 200) => (
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
);

const limparTelefone = (valor: string) => valor.replace(/\D/g, "");

const hashTexto = async (valor: string) => {
  const bytes = new TextEncoder().encode(valor);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const obterIpCliente = (req: Request) => {
  const encaminhado = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || encaminhado
    || "ip-desconhecido";
};

const verificarRateLimit = async (
  adminClient: ReturnType<typeof createClient>,
  identificador: string,
  limite: number,
  janelaMinutos: number,
  bloqueioMinutos: number,
) => {
  const { data, error } = await adminClient.rpc("registrar_tentativa_cadastro", {
    p_identificador: identificador,
    p_limite: limite,
    p_janela_minutos: janelaMinutos,
    p_bloqueio_minutos: bloqueioMinutos,
  });

  if (error) throw error;
  return data as { allowed?: boolean; retry_after_seconds?: number } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Metodo nao permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "Ambiente do Supabase incompleto." }, 500);
  }

  const body = await req.json().catch(() => ({})) as CadastroBody;
  const empresaSlug = String(body.empresa_slug || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();
  const aceitaContatoWhatsapp = body.aceita_contato_whatsapp === true;
  const email = String(body.email || "").trim().toLowerCase();
  const senha = String(body.senha || "");

  if (!empresaSlug) return jsonResponse({ ok: false, error: "Link da barbearia invalido." }, 400);
  if (nome.length < 2) return jsonResponse({ ok: false, error: "Informe seu nome completo." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ ok: false, error: "Informe um e-mail valido." }, 400);
  if (senha.length < 6) return jsonResponse({ ok: false, error: "A senha deve ter no minimo 6 digitos." }, 400);
  if (limparTelefone(whatsapp).length < 10) return jsonResponse({ ok: false, error: "Informe um WhatsApp valido." }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const ipHash = await hashTexto(`cadastro:ip:${obterIpCliente(req)}`);
    const emailHash = await hashTexto(`cadastro:email:${empresaSlug}:${email}`);

    const limiteIp = await verificarRateLimit(adminClient, ipHash, 20, 60, 30);
    const limiteEmail = await verificarRateLimit(adminClient, emailHash, 5, 60, 60);

    if (limiteIp?.allowed === false || limiteEmail?.allowed === false) {
      return jsonResponse({
        ok: false,
        error: "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
      }, 429);
    }
  } catch (error) {
    console.error("Erro ao validar limite de cadastro:", error);
    return jsonResponse({ ok: false, error: "Nao foi possivel validar o cadastro agora." }, 500);
  }

  const { data: empresa, error: empresaError } = await adminClient
    .from("empresas")
    .select("id, slug")
    .eq("slug", empresaSlug)
    .eq("ativa", true)
    .maybeSingle();

  if (empresaError) return jsonResponse({ ok: false, error: "Erro ao validar barbearia." }, 500);
  if (!empresa) return jsonResponse({ ok: false, error: "Barbearia nao encontrada ou inativa." }, 404);

  const { data: clienteExistente, error: clienteExistenteError } = await adminClient
    .from("clientes")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (clienteExistenteError) return jsonResponse({ ok: false, error: "Erro ao validar e-mail." }, 500);
  if (clienteExistente) return jsonResponse({ ok: false, error: "Este e-mail ja esta cadastrado." }, 409);

  let userId: string | null = null;
  let usuarioCriadoAgora = false;

  try {
    const { data: authEmail, error: authEmailError } = await adminClient
      .from("auth_user_emails")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (authEmailError) {
      return jsonResponse({ ok: false, error: "Erro ao validar usuario." }, 500);
    }

    if (authEmail?.user_id) {
      const { data: vinculosExistentes, error: vinculosError } = await adminClient
        .from("usuarios_empresas")
        .select("empresa_id")
        .eq("user_id", authEmail.user_id);

      if (vinculosError) return jsonResponse({ ok: false, error: "Erro ao validar vinculos." }, 500);
      if ((vinculosExistentes || []).length > 0) {
        return jsonResponse({ ok: false, error: "Este e-mail ja esta cadastrado." }, 409);
      }

      const { error: atualizarAuthError } = await adminClient.auth.admin.updateUserById(authEmail.user_id, {
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome,
          papel: "cliente",
          empresa_id: empresa.id,
        },
      });

      if (atualizarAuthError) {
        return jsonResponse({ ok: false, error: "Nao foi possivel recuperar este cadastro." }, 400);
      }

      userId = authEmail.user_id;
    } else {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome,
          papel: "cliente",
          empresa_id: empresa.id,
        },
      });

      if (authError || !authData.user) {
        const mensagem = authError?.message || "Erro ao criar usuario.";
        if (mensagem.toLowerCase().includes("already")) {
          return jsonResponse({ ok: false, error: "Este e-mail ja esta cadastrado." }, 409);
        }
        return jsonResponse({ ok: false, error: mensagem }, 400);
      }

      userId = authData.user.id;
      usuarioCriadoAgora = true;
    }

    const { error: clienteError } = await adminClient
      .from("clientes")
      .insert({
        id: userId,
        nome,
        whatsapp,
        aceita_contato_whatsapp: aceitaContatoWhatsapp,
        email,
        empresa_id: empresa.id,
        eh_admin: false,
      });

    if (clienteError) throw clienteError;

    const { error: vinculoError } = await adminClient
      .from("usuarios_empresas")
      .insert({
        user_id: userId,
        empresa_id: empresa.id,
        papel: "cliente",
      });

    if (vinculoError) throw vinculoError;

    return jsonResponse({
      ok: true,
      user_id: userId,
      empresa_id: empresa.id,
      empresa_slug: empresa.slug,
    });
  } catch (error) {
    if (userId) {
      await adminClient.from("usuarios_empresas").delete().eq("user_id", userId).eq("empresa_id", empresa.id);
      await adminClient.from("clientes").delete().eq("id", userId);
      if (usuarioCriadoAgora) {
        await adminClient.auth.admin.deleteUser(userId);
      }
    }

    const mensagem = error instanceof Error ? error.message : "Erro ao finalizar cadastro.";
    return jsonResponse({ ok: false, error: mensagem }, 500);
  }
});
