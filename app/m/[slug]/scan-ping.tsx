'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

// Counts one scan per browser per day. Fire-and-forget: if it fails,
// the diner never notices, which is the correct priority.
export default function ScanPing({ restaurantId }: { restaurantId: string }) {
  useEffect(() => {
    const key = `scan:${restaurantId}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* private browsing — count it anyway */ }

    supabaseBrowser().rpc('record_scan', { rid: restaurantId }).then(() => {});
  }, [restaurantId]);

  return null;
}
