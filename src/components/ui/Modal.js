export default function Modal({ onClose, maxWidth = 460, children }) {
  return (
    <div className="mb-overlay" onClick={onClose}>
      <div className="mb-modal-box" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
