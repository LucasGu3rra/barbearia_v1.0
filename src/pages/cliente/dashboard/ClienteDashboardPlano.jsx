import { HeroCard, Icon, SectionTitle } from '../../components/clientes/ClienteDashboardParts';
import { parseDataSupabase } from '../utils/clienteDashboardUtils';

const formatarDataHora = (valor) => {
  if (!valor) return 'Sem data';
  const data = parseDataSupabase(valor);
  return `${data.toLocaleDateString('pt-BR')} - ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const dataValida = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const formatarDataAgendamento = (valor) => {
  const data = dataValida(valor);
  if (!data) return 'Sem data';

  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (data.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  if (data.toDateString() === amanha.toDateString()) return `Amanha, ${hora}`;
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`;
};

const detalheAgendamento = (agendamento) => {
  if (!agendamento) return null;
  return [
    agendamento.servicos?.nome || 'Serviço',
    agendamento.barbeiros?.nome,
    agendamento.filiais?.nome,
  ].filter(Boolean).join(' - ');
};

const PedidoRecente = ({ pedido }) => {
  if (!pedido) {
    return (
      <div className="p-6 text-center border border-dashed border-[#333] rounded-[12px]">
        <p className="text-zinc-600 text-xs italic">Nenhum serviço registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1b1b1b] border border-[#333] rounded-[10px] p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-[#2c281b] text-[#d5b451] flex items-center justify-center flex-shrink-0">
          <Icon name={pedido.tipo === 'agendamento' ? 'calendar' : 'scissors'} className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{pedido.nome}</p>
          <p className="text-[10px] text-zinc-500 mt-1">{formatarDataHora(pedido.data)}</p>
        </div>
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-widest ${pedido.status === 'feito' ? 'text-emerald-400' : 'text-[#d5b451]'}`}>
        {pedido.status}
      </span>
    </div>
  );
};

function InfoCard({ label, title, subtitle, pending = false }) {
  return (
    <div className="relative overflow-hidden bg-[#1b1b1b] border border-[#333] rounded-[14px] p-4 min-h-[112px]">
      <div className={pending ? 'opacity-40 blur-[1px]' : ''}>
        <p className="text-[10px] text-zinc-400 font-bold">{label}</p>
        <p className="text-white text-xl font-black mt-3">{title}</p>
        {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
      </div>
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full border border-[#d5b451]/45 bg-[#090909]/80 text-[#d5b451] text-sm font-black">
            Pendente
          </span>
        </div>
      )}
    </div>
  );
}

function UsoPlanoCard({ dados, planoAtivo, usados, pending = false }) {
  const limite = Math.max(0, Number(dados.limiteTotal || 0));
  const usadosSeguro = Math.min(limite, Math.max(0, Number(usados || 0)));
  const restantes = Math.max(0, Number(dados.cortesRestantes || 0));

  return (
    <div className="relative overflow-hidden bg-[#1b1b1b] border border-[#333] rounded-[14px] p-4 min-h-[112px]">
      <div className={pending ? 'opacity-40 blur-[1px]' : ''}>
        <p className="text-[10px] text-zinc-400 font-bold">{dados.ilimitado ? 'Uso do plano' : 'Cortes restantes'}</p>
        {dados.ilimitado ? (
          <>
            <p className="text-white text-3xl font-black mt-3 leading-none">∞</p>
            <p className="text-zinc-500 text-xs mt-1">plano ilimitado</p>
          </>
        ) : (
          <>
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: Math.max(limite, 1) }).map((_, index) => {
                const usado = index < usadosSeguro;
                return (
                  <span
                    key={index}
                    className={`h-3.5 w-3.5 rounded-[4px] ${usado ? 'bg-[#3a3a3a]' : 'bg-[#d5b451]'}`}
                  />
                );
              })}
            </div>
            <p className="text-white text-2xl font-black mt-3">
              {planoAtivo ? restantes : limite}
              <span className="ml-1 text-xs font-bold text-zinc-500">de {limite}</span>
            </p>
          </>
        )}
      </div>
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full border border-[#d5b451]/45 bg-[#090909]/80 text-[#d5b451] text-sm font-black">
            Pendente
          </span>
        </div>
      )}
    </div>
  );
}

function ActionCard({ icon, title, subtitle, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative bg-[#1b1b1b] border border-[#333] rounded-[14px] p-3 min-h-[92px] text-left transition-transform ${disabled ? 'opacity-55 cursor-not-allowed' : 'active:scale-[0.99]'}`}
    >
      <div className="w-8 h-8 rounded-[10px] mb-2 bg-[#2c281b] text-[#d5b451] flex items-center justify-center">
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <p className="text-white text-sm font-black leading-tight">{title}</p>
      <p className="text-zinc-500 text-[11px] mt-1">{subtitle}</p>
      {!disabled && <Icon name="chevron" className="absolute right-4 top-5 w-4 h-4 text-[#d5b451]" />}
    </button>
  );
}

export default function ClienteDashboardPlano({
  dados,
  statusPlano,
  historicoMes,
  pedidoRecente,
  proximoAgendamento,
  prazoCancelamentoMinutos = 120,
  agendamentoAtivo,
  onAbrirAgendamentoPlano,
  onAbrirOutroServico,
  onConfirmarCortePlano,
  onVerAgendamento,
  onCancelarAgendamento,
}) {
  const planoAtivo = statusPlano === 'ativo';
  const podeAgendarComPlano = planoAtivo && agendamentoAtivo;
  const podeAgendarAvulso = agendamentoAtivo;
  const podeConfirmarCorte = planoAtivo && (!dados.ilimitado ? Number(dados.cortesRestantes || 0) > 0 : true);
  const usados = Math.max(0, Number(dados.limiteTotal || 0) - Number(dados.cortesRestantes || 0));
  const temAgendamentoAtivo = Boolean(proximoAgendamento);

  return (
    <div className="page on">
      <div className="scroll">
        <HeroCard
          dados={dados}
          sub={planoAtivo ? `Plano vence em ${dados.vencimentoFormatado}` : 'Aguardando ativação do plano'}
          status={{
            icon: planoAtivo ? 'check' : 'clock',
            label: planoAtivo ? `Plano ${dados.planoNome}` : 'Plano pendente',
            variant: planoAtivo ? '' : 'pending',
          }}
        />

        <div className="border-t border-[#252525] pt-4">
          {!(planoAtivo && !agendamentoAtivo && !temAgendamentoAtivo) && (
            <p className="text-[#d5b451] text-[10px] font-black uppercase tracking-[0.22em] mb-2">
              {temAgendamentoAtivo ? 'Proximo agendamento' : planoAtivo ? 'Plano ativo' : 'Plano pendente'}
            </p>
          )}
          <p className="text-white text-xl font-black">
            {temAgendamentoAtivo ? formatarDataAgendamento(proximoAgendamento.data_hora) : planoAtivo && !agendamentoAtivo ? 'Confirme o corte no local' : planoAtivo ? dados.planoNome : 'Aguardando ativação'}
          </p>
          <p className="text-[#d8d3c8] text-xs mt-2 leading-relaxed">
            {temAgendamentoAtivo
              ? detalheAgendamento(proximoAgendamento)
              : planoAtivo && !agendamentoAtivo
              ? 'Os agendamentos pelo sistema estão pausados. Ao chegar na barbearia, toque em Confirmar corte. O sistema irá consumir 1 uso do plano e liberar a tela de confirmação para mostrar ao barbeiro.'
              : planoAtivo
              ? 'Use seu plano para agendar o serviço incluso ou escolha outro serviço avulso.'
              : agendamentoAtivo
              ? 'Seu plano foi solicitado. Enquanto aguarda ativação, você ainda pode agendar serviços avulsos.'
              : 'Seu plano foi solicitado. O agendamento online está pausado no momento.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#252525] pt-4">
          <UsoPlanoCard dados={dados} planoAtivo={planoAtivo} usados={usados} pending={!planoAtivo} />
          <InfoCard
            label="Vencimento"
            title={planoAtivo ? dados.vencimentoFormatado || '--/--' : '--/--'}
            subtitle={planoAtivo ? 'mensalidade' : 'após ativação'}
            pending={!planoAtivo}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {temAgendamentoAtivo ? (
            <>
              <ActionCard
                icon="clock"
                title="Ver agendamento"
                subtitle="codigo, local e acoes"
                onClick={() => onVerAgendamento?.(proximoAgendamento)}
              />
              <ActionCard
                icon="x"
                title="Cancelar"
                subtitle={`ate ${prazoCancelamentoMinutos} min antes`}
                onClick={() => onCancelarAgendamento?.(proximoAgendamento)}
              />
            </>
          ) : (
            <>
              {agendamentoAtivo ? (
                <ActionCard
                  icon={planoAtivo ? 'calendar' : 'clock'}
                  title={planoAtivo ? 'Agendar com plano' : 'Plano pendente'}
                  subtitle={planoAtivo ? 'serviço incluso' : 'aguarde ativação'}
                  onClick={onAbrirAgendamentoPlano}
                  disabled={!podeAgendarComPlano}
                />
              ) : (
                <ActionCard
                  icon={planoAtivo ? 'check' : 'clock'}
                  title={planoAtivo ? 'Confirmar corte' : 'Plano pendente'}
                  subtitle={planoAtivo ? 'consome 1 uso do plano' : 'aguarde ativação'}
                  onClick={onConfirmarCortePlano}
                  disabled={!podeConfirmarCorte}
                />
              )}
              <ActionCard
                icon={agendamentoAtivo ? 'scissors' : 'calendarOff'}
                title={agendamentoAtivo ? 'Outro serviço' : 'Agendamento pausado'}
                subtitle={agendamentoAtivo ? 'serviço avulso' : 'somente na barbearia'}
                onClick={onAbrirOutroServico}
                disabled={!podeAgendarAvulso}
              />
            </>
          )}
        </div>

        <div className="border-t border-[#252525] pt-4">
          <SectionTitle>{planoAtivo ? 'Historico do mes' : 'Ultimo pedido'}</SectionTitle>
          <div className="space-y-2">
            {planoAtivo && historicoMes.length > 0 ? (
              historicoMes.slice(0, 3).map((corte) => (
                <PedidoRecente
                  key={corte.id}
                  pedido={{
                    tipo: corte.status === 'agendado' ? 'agendamento' : 'feito',
                    nome: corte.tipo_corte,
                    data: corte.created_at,
                    status: corte.status || 'feito',
                  }}
                />
              ))
            ) : (
              <PedidoRecente pedido={pedidoRecente} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
