import { HeroCard, SectionTitle, StatCard, Icon } from './ClienteDashboardParts';
import { parseDataSupabase } from './clienteDashboardUtils';

export default function ClienteDashboardAtivo({
  dados,
  historicoMes,
  corteCancelavel,
  salvandoCorte,
  agendamentoAtivo,
  onCancelarCorte,
  onAbrirAgendamento,
  onConfirmarCorte,
}) {
  const textoBotaoCorte = salvandoCorte
    ? 'Registrando...'
    : dados.ilimitado || dados.cortesRestantes > 0
      ? 'Confirmar servico'
      : 'Limite esgotado';

  return (
    <div className="page on">
      <div className="scroll">
        <HeroCard
          dados={dados}
          sub={`Plano vence em ${dados.vencimentoFormatado}`}
          status={{ icon: 'check', label: `Plano ${dados.planoNome}` }}
        />

        <div className="row2">
          <StatCard label="Cortes restantes">
            {!dados.ilimitado && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[...Array(dados.limiteTotal)].map((_, index) => (
                  <div key={index} className={`w-4 h-4 rounded-[4px] ${index < dados.cortesRestantes ? 'bg-[#d5b451]' : 'bg-[#303030]'}`} />
                ))}
              </div>
            )}
            <p className="text-3xl font-black text-[#d5b451]">
              {dados.ilimitado ? 'Livre' : dados.cortesRestantes} <span className="text-xs text-zinc-500 font-normal">{dados.ilimitado ? 'ilimitado' : `de ${dados.limiteTotal}`}</span>
            </p>
          </StatCard>

          <StatCard label="Vencimento">
            <p className="text-3xl font-black text-white">{dados.vencimentoFormatado}</p>
            <p className="text-xs text-zinc-500 mt-1">mensalidade</p>
          </StatCard>
        </div>

        {corteCancelavel ? (
          <button disabled={salvandoCorte} onClick={onCancelarCorte} className="btn bg-red-500/10 text-red-500 border border-red-500/50 font-bold">
            Cancelar corte ate 15 min
          </button>
        ) : agendamentoAtivo ? (
          <button onClick={onAbrirAgendamento} className="btn primary">
            Agendar horario
          </button>
        ) : (
          <button disabled={(!dados.ilimitado && dados.cortesRestantes === 0) || salvandoCorte} onClick={onConfirmarCorte} className="btn primary disabled:opacity-50">
            {textoBotaoCorte}
          </button>
        )}

        <SectionTitle>Historico do mes</SectionTitle>
        <div className="space-y-2">
          {historicoMes.length > 0 ? historicoMes.map((corte) => {
            const dataCorte = parseDataSupabase(corte.created_at);

            return (
              <div key={corte.id} className="bg-[#1b1b1b] border border-[#333] rounded-[10px] p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2c281b] text-[#d5b451] flex items-center justify-center">
                    <Icon name="scissors" className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{corte.tipo_corte}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {dataCorte.toLocaleDateString('pt-BR')} - {dataCorte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Feito</span>
              </div>
            );
          }) : (
            <div className="p-6 text-center border border-dashed border-[#333] rounded-[12px]">
              <p className="text-zinc-600 text-xs italic">Nenhum servico registrado neste mes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
