'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { slugify } from '@/lib/money';

export default function Setup({ userId }: { userId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    const clean = name.trim();
    if (clean.length < 2) { setError('Enter your restaurant name.'); return; }

    setBusy(true); setError('');
    try {
      // userId comes from the server component, which already confirmed the
      // session via supabase.auth.getUser() — no need to ask the browser
      // client again. the RPC still authenticates independently using
      // auth.uid() from the request's own JWT, this prop is just for display.
      void userId;
      const supabase = supabaseBrowser();

      let slug = slugify(clean);
      if (slug.length < 3) slug = `menu-${Math.random().toString(36).slice(2, 8)}`;

      // account + owner membership + first outlet all happen inside one
      // security-definer RPC — see create_account_with_outlet in schema.sql.
      // client-side inserts can't do this: the account has no members yet at
      // the moment it's created, so RLS has nothing to check ownership against.
      let created: { restaurant_id: string; restaurant_slug: string } | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const candidate = attempt === 0 ? slug : `${slug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data, error } = await supabase
          .rpc('create_account_with_outlet', {
            p_account_name: clean,
            p_outlet_name: clean,
            p_slug: candidate,
            p_tagline: tagline.trim() || null,
          })
          .single();
        if (!error) { created = data as { restaurant_id: string; restaurant_slug: string }; break; }
        if (error.code !== '23505') { setError(error.message); return; }
        // 23505 = slug collision — loop again with a new suffixed candidate
      }

      if (!created) { setError('Could not create a unique menu address. Try a different name.'); return; }

      router.push('/dashboard');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '70px 24px' }}>
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 34, marginBottom: 6, fontWeight: 400 }}>
        Name your restaurant
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 22 }}>
        This becomes your menu address. You can change the name later.
      </p>

      {error && <p className="err">{error}</p>}

      <div className="field">
        <label htmlFor="rname">Restaurant name</label>
        <input id="rname" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="tag">Tagline (optional)</label>
        <input id="tag" value={tagline} placeholder="Since 1974"
               onChange={(e) => setTagline(e.target.value)} />
      </div>

      {name.trim().length > 1 && (
        <p className="hint" style={{ marginBottom: 14 }}>
          Menu address: /m/{slugify(name)}
        </p>
      )}

      <button className="btn wide" onClick={create} disabled={busy}>
        {busy ? 'Creating…' : 'Create my menu'}
      </button>
    </main>
  );
}
