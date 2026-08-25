'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

// password auth for local testing — sidesteps Supabase's shared-mailer rate
// limit that magic-link sign-in hits. requires "Confirm email" turned off in
// Supabase → Authentication → Providers → Email, otherwise signup still
// sends a confirmation email and we're back to the same limit.
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true); setError('');
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message); else { router.push('/dashboard'); router.refresh(); }
  }

  async function signUp() {
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true); setError('');
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push('/dashboard'); router.refresh();
  }

  return (
    <main style={{ maxWidth: 380, margin: '0 auto', padding: '80px 24px' }}>
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 34, marginBottom: 6, fontWeight: 400 }}>
        Sign in
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 20 }}>
        New here? Pick a password and use "Create account" below.
      </p>

      {error && <p className="err">{error}</p>}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} autoComplete="email"
               onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} autoComplete="current-password"
               onChange={(e) => setPassword(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && signIn()} />
      </div>

      <button className="btn wide" onClick={signIn} disabled={busy}>
        {busy ? 'Working…' : 'Sign in'}
      </button>
      <button className="btn wide ghost" style={{ marginTop: 8 }} onClick={signUp} disabled={busy}>
        {busy ? 'Working…' : 'Create account'}
      </button>
    </main>
  );
}
