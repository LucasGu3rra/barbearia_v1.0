import { parseDataSupabase } from '../../cliente/utils/clienteDashboardUtils';
import { Icon } from './ClienteDashboardParts';

export default function ClienteHistoricoModal({
  isOpen,
  historicoCompleto = [],
  agendamentos = [],
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 pb-0">
      <div className="client-device rounded-t-[28px] sm:rounded-[28px] min-h-0 max-h-[92vh] overflow-y-auto">
        <div className="back-bar">
          <button className="back-btn" onClick={onClose}>
            <Icon name="chevron" className="w-4 h-4 rotate-180" />
          </button>
          <span className="back-title">Historico</span>
        </div>

        <div className="scroll" style={{ paddingTop: 12 }}>
          <div className="sec">CORTES</div>
          <div className="space-y-2">
            {historicoCompleto.length > 0 ? historicoCompleto.map((corte) => {
              const dataCorte = parseDataSupabase(corte.created_at);
              return (
                <div key={corte.id} className="bg-[#1b1b1b] border border-[#333] rounded-[10px] p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{corte.tipo_corte}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {dataCorte.toLocaleDateString('pt-BR')} as {dataCorte.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Feito</span>
                </div>
              );
            }) : (
              <div className="p-6 text-center border border-dashed border-[#333] rounded-[12px]">
                <p className="text-zinc-600 text-xs italic">Nenhum corte registrado.</p>
              </div>
            )}
          </div>

          <div className="sec">AGENDAMENTOS</div>
          <div className="space-y-2">
            {agendamentos.length > 0 ? agendamentos.map((agendamento, index) => {
              const dataAgendamento = agendamento.data_hora ? new Date(agendamento.data_hora) : null;
              return (
                <div key={agendamento.id || index} className="bg-[#1b1b1b] border border-[#333] rounded-[10px] p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{agendamento.servicos?.nome || 'Servico'}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {dataAgendamento
                        ? `${dataAgendamento.toLocaleDateString('pt-BR')} as ${dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Sem data'}
                      {agendamento.barbeiros?.nome ? ` - ${agendamento.barbeiros.nome}` : ''}
                    </p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#d5b451]">{agendamento.status}</span>
                </div>
              );
            }) : (
              <div className="p-6 text-center border border-dashed border-[#333] rounded-[12px]">
                <p className="text-zinc-600 text-xs italic">Nenhum agendamento registrado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
