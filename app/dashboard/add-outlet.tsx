'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { slugify } from '@/lib/money';

export default function AddOutlet({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    const clean = name.trim();
    if (clean.length < 2) { setError('Enter a name for the new outlet.'); return; }
    setBusy(true); setError('');

    const supabase = supabaseBrowser();
    let slug = slugify(clean);
    if (slug.length < 3) slug = `menu-${Math.random().toString(36).slice(2, 8)}`;

    let created: { restaurant_id: string; restaurant_slug: string } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const candidate = attempt === 0 ? slug : `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase
        .rpc('add_outlet', { p_account_id: accountId, p_outlet_name: clean, p_slug: candidate })
        .single();
      if (!error) { created = data as { restaurant_id: string; restaurant_slug: string }; break; }
      if (error.message !== 'slug_taken') { setError(error.message); setBusy(false); return; }
    }

    if (!created) { setError('Could not create a unique menu address.'); setBusy(false); return; }

    setBusy(false); setOpen(false); setName('');
    router.push(`/dashboard?outlet=${created.restaurant_slug}`);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn ghost wide" onClick={() => setOpen(true)}>
        + Add another outlet
      </button>
    );
  }

  return (
    <div className="card pad">
      {error && <p className="err">{error}</p>}
      <div className="field">
        <label htmlFor="outlet-name">Outlet name</label>
        <input id="outlet-name" value={name} autoFocus
               onChange={(e) => setName(e.target.value)} />
      </div>
      <button className="btn" onClick={create} disabled={busy}>
        {busy ? 'Creating…' : 'Create outlet'}
      </button>
      <button className="btn ghost" style={{ marginLeft: 8 }} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
