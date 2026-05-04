// src/components/ModalAlerta.jsx
export default function ModalAlerta({ isOpen, onClose, onConfirm, title, message, type = 'alert' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/80 backdrop-blur-sm transition-opacity">
      <div className="bg-[#121212] border border-[#27272a] rounded-[28px] p-6 w-full max-w-[340px] shadow-2xl animate-[fadeIn_0.2s_ease-out]">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">{message}</p>
        
        <div className="flex gap-3">
          {type === 'confirm' && (
            <button 
              onClick={onClose} 
              className="flex-1 py-3.5 rounded-xl border border-[#27272a] text-zinc-400 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
            >
              Cancelar
            </button>
          )}
          <button 
            onClick={onConfirm || onClose} 
            className="flex-1 py-3.5 rounded-xl bg-[#CEAA6B] text-black font-bold text-xs uppercase tracking-wider active:scale-95 transition-all"
          >
            {type === 'confirm' ? 'Confirmar' : 'Entendi'}
          </button>
        </div>
      </div>
    </div>
  );
}