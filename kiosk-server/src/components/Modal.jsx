function Modal({ onClose, className = '', children }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`bg-slate-800 rounded-xl ${className}`} onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
