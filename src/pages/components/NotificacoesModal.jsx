export default function NotificacoesModal({ isOpen, onClose, notificacoes, onLimpar, limpando }) {
  if (!isOpen) return null;

  const formatarNotificacao = (valor) => {
    if (!valor) return '';
    return new Date(valor).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-[390px] max-h-[82vh] bg-[#09090b] border border-[#27272a] rounded-[28px] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-5 border-b border-[#1f1f22] flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] text-[#CEAA6B] font-black uppercase tracking-[0.24em]">Notificacoes</p>
            <h2 className="mt-1 text-xl font-black text-white">Avisos recentes</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#171717] border border-[#27272a] text-zinc-500 flex items-center justify-center"
            aria-label="Fechar notificacoes"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notificacoes.length > 0 ? notificacoes.map((notificacao) => (
            <div
              key={notificacao.id}
              className="rounded-[18px] border border-[#CEAA6B]/35 bg-[#17140b] p-4"
            >
              <p className="text-sm font-black text-white">{notificacao.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{notificacao.corpo}</p>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                {formatarNotificacao(notificacao.created_at)}
              </p>
            </div>
          )) : (
            <div className="rounded-[20px] border border-dashed border-[#27272a] px-5 py-10 text-center">
              <p className="text-sm font-bold text-zinc-500">Nenhuma notificacao por enquanto.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#1f1f22]">
          <button
            type="button"
            onClick={onLimpar}
            disabled={limpando || notificacoes.length === 0}
            className="w-full rounded-[16px] bg-[#CEAA6B] py-3 text-sm font-black text-black disabled:opacity-50"
          >
            {limpando ? 'Limpando...' : 'Limpar notificacoes'}
          </button>
        </div>
      </div>
    </div>
  );
}
