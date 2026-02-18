function Modal({ onClose, className = '', children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`bg-slate-800 rounded-xl ${className}`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default Modal;
