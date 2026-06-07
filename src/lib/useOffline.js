import { useState, useEffect } from 'react';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

// Cache data in localStorage
export function cacheData(key, data) {
  try { localStorage.setItem(`mbst_cache_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function getCachedData(key) {
  try {
    const raw = localStorage.getItem(`mbst_cache_${key}`);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch { return null; }
}

// Offline queue — store actions taken while offline
export function queueOfflineAction(action, payload) {
  try {
    const queue = JSON.parse(localStorage.getItem('mbst_offline_queue') || '[]');
    queue.push({ action, payload, ts: Date.now(), id: Math.random().toString(36).slice(2) });
    localStorage.setItem('mbst_offline_queue', JSON.stringify(queue));
  } catch {}
}

export function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem('mbst_offline_queue') || '[]'); } catch { return []; }
}

export function clearOfflineQueue() {
  try { localStorage.removeItem('mbst_offline_queue'); } catch {}
}
