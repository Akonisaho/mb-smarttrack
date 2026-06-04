import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const cache = { data: null };

export function useFirmSettings() {
  const [settings, setSettings] = useState(cache.data || {
    firm_name: 'SmartTrack',
    logo_url: '',
    vat_number: '',
    bank_name: '',
    bank_account: '',
    bank_branch: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    default_rate: 150,
    invoice_footer: '',
  });

  useEffect(() => {
    if (cache.data) return;
    supabase.from('firm_settings').select('*').limit(1).single().then(({ data }) => {
      if (data) { cache.data = data; setSettings(data); }
    });
  }, []);

  return settings;
}
