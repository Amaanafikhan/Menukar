import { supabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Setup from './setup';
import MenuManager from './menu-manager';
import QrPanel from './qr-panel';
import AddOutlet from './add-outlet';

export const dynamic = 'force-dynamic';

export default async function Dashboard({
  searchParams,
}: { searchParams: { outlet?: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // a user can belong to several accounts (rare, but e.g. a manager helping
  // out two separate hotels); take the first membership for now
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('account_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error('[dashboard] membership lookup failed for user', user.id, membershipError);
  }

  if (!membership) return <Setup userId={user.id} />;

  // an account owning multiple outlets (a hotel's several shops) lists them
  // all here; ?outlet= picks which one this page is scoped to
  const { data: outlets } = await supabase
    .from('restaurants')
    .select('*')
    .eq('account_id', membership.account_id)
    .order('created_at');

  if (!outlets || outlets.length === 0) return <Setup userId={user.id} />;

  const restaurant = outlets.find((o) => o.slug === searchParams.outlet) ?? outlets[0];

  const [{ data: categories }, { data: items }, { data: banners }, { data: scan }] =
    await Promise.all([
      supabase.from('categories').select('*')
        .eq('restaurant_id', restaurant.id).order('position'),
      supabase.from('items').select('*')
        .eq('restaurant_id', restaurant.id).order('position'),
      supabase.from('banners').select('*')
        .eq('restaurant_id', restaurant.id).order('position'),
      supabase.from('scans').select('count')
        .eq('restaurant_id', restaurant.id)
        .eq('day', new Date().toISOString().slice(0, 10))
        .maybeSingle(),
    ]);

  const live = (items ?? []).filter((i) => i.is_available).length;
  const out = (items ?? []).length - live;

  return (
    <>
      <header className="bar">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span className="logo">MENUKAR</span>
          <span className="crumb">{restaurant.name}</span>
        </div>
        {outlets.length > 1 && (
          <nav style={{ display: 'flex', gap: 8 }}>
            {outlets.map((o) => (
              <a key={o.id} href={`/dashboard?outlet=${o.slug}`}
                 style={{ fontSize: 13, fontWeight: o.id === restaurant.id ? 700 : 400,
                          textDecoration: o.id === restaurant.id ? 'underline' : 'none' }}>
                {o.name}
              </a>
            ))}
          </nav>
        )}
        <span className="live"><i className="pulse" /> Menu is live</span>
      </header>

      <div className="wrap">
        <div>
          <div className="stats">
            <div className="stat hero"><b>{scan?.count ?? 0}</b><p>Scans today</p></div>
            <div className="stat"><b>{live}</b><p>Items live</p></div>
            <div className="stat"><b>{out}</b><p>Sold out</p></div>
          </div>

          <MenuManager
            restaurantId={restaurant.id}
            categories={categories ?? []}
            items={items ?? []}
          />
        </div>

        <aside>
          <QrPanel
            slug={restaurant.slug}
            restaurantId={restaurant.id}
            banners={banners ?? []}
          />
          <AddOutlet accountId={membership.account_id} />
        </aside>
      </div>
    </>
  );
}
