import '../styles/globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { ToastProvider } from '../components/Toast';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && router.pathname !== '/login') {
        router.replace('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <ToastProvider>
      <Component {...pageProps} />
    </ToastProvider>
  );
}
