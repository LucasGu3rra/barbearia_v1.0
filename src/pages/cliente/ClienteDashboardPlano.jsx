import { HeroCard, SectionTitle, Icon } from './ClienteDashboardParts';
import { parseDataSupabase } from './clienteDashboardUtils';

const formatarDataHora = (valor) => {
  if (!valor) return 'Sem data';
  const data = parseDataSupabase(valor);
  return `${data.toLocaleDateString('pt-BR')} - ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const PedidoRecente = ({ pedido }) => {
  if (!pedido) {
    return (
      <div className="p-6 text-center border border-dashed border-[#333] rounded-[12px]">
        <p className="text-zinc-600 text-xs italic">Nenhum servico registrado ainda.</p>
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

function PlanStatCard({ label, pending, children }) {
  return (
    <div className="relative overflow-hidden bg-[#1b1b1b] border border-[#333] rounded-[14px] p-4 min-h-[152px]">
      <div className={pending ? 'opacity-35 blur-[1.5px]' : ''}>
        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-3">{label}</p>
        {children}
      </div>
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-full border border-[#d5b451]/45 bg-[#090909]/80 text-[#d5b451] text-xl font-black shadow-[0_0_24px_rgba(213,180,81,0.16)]">
            Pendente
          </span>
        </div>
      )}
    </div>
  );
}

export default function ClienteDashboardPlano({
  dados,
  statusPlano,
  historicoMes,
  pedidoRecente,
  agendamentoAtivo,
  onAbrirAgendamentoPlano,
  onAbrirOutroServico,
}) {
  const planoAtivo = statusPlano === 'ativo';
  const podeAgendarComPlano = planoAtivo && agendamentoAtivo;
  const podeAgendarAvulso = agendamentoAtivo;

  return (
    <div className="page on">
      <div className="scroll">
        <HeroCard
          dados={dados}
          sub={planoAtivo ? `Plano vence em ${dados.vencimentoFormatado}` : 'Aguardando ativacao do plano'}
          status={{
            icon: planoAtivo ? 'check' : 'clock',
            label: planoAtivo ? `Plano ${dados.planoNome}` : 'Plano pendente',
            variant: planoAtivo ? '' : 'pending',
          }}
        />

        <div className="row2">
          <PlanStatCard label="Cortes restantes" pending={!planoAtivo}>
            {!dados.ilimitado && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[...Array(dados.limiteTotal || 5)].map((_, index) => (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-[4px] ${planoAtivo && index < dados.cortesRestantes ? 'bg-[#d5b451]' : 'bg-[#303030]'}`}
                  />
                ))}
              </div>
            )}
            <p className="text-3xl font-black text-[#d5b451]">
              {dados.ilimitado ? 'Livre' : dados.cortesRestantes}
              <span className="text-xs text-zinc-500 font-normal ml-1">
                {dados.ilimitado ? 'ilimitado' : `de ${dados.limiteTotal}`}
              </span>
            </p>
          </PlanStatCard>

          <PlanStatCard label="Vencimento" pending={!planoAtivo}>
            <p className="text-3xl font-black text-white">{dados.vencimentoFormatado || '--/--'}</p>
            <p className="text-xs text-zinc-500 mt-1">mensalidade</p>
          </PlanStatCard>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAbrirAgendamentoPlano}
            disabled={!podeAgendarComPlano}
            className="btn primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Agendar com plano
          </button>
          <button
            onClick={onAbrirOutroServico}
            disabled={!podeAgendarAvulso}
            className="btn secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Outro servico
          </button>
        </div>

        <SectionTitle>{planoAtivo ? 'Historico do mes' : 'Ultimo pedido'}</SectionTitle>
        <div className="space-y-2">
          {planoAtivo && historicoMes.length > 0 ? (
            historicoMes.slice(0, 3).map((corte) => (
              <PedidoRecente
                key={corte.id}
                pedido={{
                  tipo: 'feito',
                  nome: corte.tipo_corte,
                  data: corte.created_at,
                  status: 'feito',
                }}
              />
            ))
          ) : (
            <PedidoRecente pedido={pedidoRecente} />
          )}
        </div>
      </div>
    </div>
  );
}
