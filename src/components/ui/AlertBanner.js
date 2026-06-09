export default function AlertBanner({ msg, type = 'success', onDismiss, extra }) {
  if (!msg) return null;
  return (
    <div className={type === 'error' ? 'mb-alert-error' : 'mb-alert-success'}>
      <span style={{ flex: 1 }}>{msg}</span>
      {extra}
      <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', flexShrink: 0 }} onClick={onDismiss}>✕</button>
    </div>
  );
}
