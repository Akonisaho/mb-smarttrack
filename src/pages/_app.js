import '../styles/globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && router.pathname !== '/login') {
        router.replace('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return <Component {...pageProps} />;
}
