import { supabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: admin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // grant access with: insert into platform_admins (user_id) values ('<uuid>');
  // run from the Supabase SQL editor — there is no self-service path on purpose
  if (!admin) redirect('/dashboard');

  const [{ data: accounts }, { data: restaurants }] = await Promise.all([
    supabase.from('accounts').select('id, name, kind, is_suspended, created_at').order('created_at', { ascending: false }),
    supabase.from('restaurants').select('id, account_id, name, slug, is_open, created_at').order('created_at', { ascending: false }),
  ]);

  const outletsByAccount = new Map<string, typeof restaurants>();
  for (const r of restaurants ?? []) {
    const list = outletsByAccount.get(r.account_id) ?? [];
    list.push(r);
    outletsByAccount.set(r.account_id, list);
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 28, marginBottom: 4, fontWeight: 400 }}>
        Platform admin
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 28 }}>
        {(accounts ?? []).length} accounts · {(restaurants ?? []).length} outlets
      </p>

      {(accounts ?? []).map((a) => (
        <section key={a.id} style={{ border: '1px solid var(--edge)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong>{a.name}</strong>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {a.kind} · {a.is_suspended ? 'suspended' : 'active'} · {new Date(a.created_at).toLocaleDateString()}
            </span>
          </div>
          <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 13.5 }}>
            {(outletsByAccount.get(a.id) ?? []).map((o) => (
              <li key={o.id}>
                <a href={`/m/${o.slug}`} target="_blank" rel="noreferrer">{o.name}</a>
                {' — '}
                <span style={{ color: 'var(--ink-3)' }}>{o.is_open ? 'open' : 'closed'}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
