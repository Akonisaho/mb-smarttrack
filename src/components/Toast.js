import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const remove = (id) => setToasts(t => t.filter(x => x.id !== id));

  const colors = {
    success: { bg: '#16a34a', border: '#15803d' },
    error:   { bg: '#dc2626', border: '#b91c1c' },
    info:    { bg: '#1B3A6B', border: '#1e3a5f' },
    warning: { bg: '#d97706', border: '#b45309' },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:10, maxWidth:360 }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.success;
          return (
            <div key={t.id} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 8, padding: '12px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              fontFamily: "'DM Sans',system-ui,sans-serif",
              animation: 'slideIn 0.2s ease',
            }}>
              <span style={{ fontSize: 14, color: '#fff', flex: 1, lineHeight: 1.5 }}>{t.message}</span>
              <button onClick={() => remove(t.id)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:16, padding:0, lineHeight:1, flexShrink:0 }}>✕</button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
