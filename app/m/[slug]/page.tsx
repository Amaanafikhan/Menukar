import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { toRupees } from '@/lib/money';
import ScanPing from './scan-ping';
import './menu.css';

// Revalidate every 10 seconds: fast for the diner, near-instant for the owner.
export const revalidate = 10;

// Anonymous client — this page has no session and needs none.
// RLS allows public SELECT and nothing else.
const anon = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { data } = await anon()
    .from('restaurants').select('name, tagline').eq('slug', params.slug).maybeSingle();
  return {
    title: data ? `${data.name} — Menu` : 'Menu',
    description: data?.tagline ?? undefined,
  };
}

export default async function PublicMenu({ params }: { params: { slug: string } }) {
  const supabase = anon();

  const { data: restaurant } = await supabase
    .from('restaurants').select('*').eq('slug', params.slug).maybeSingle();

  if (!restaurant) notFound();

  const [{ data: categories }, { data: items }, { data: banners }] = await Promise.all([
    supabase.from('categories').select('*')
      .eq('restaurant_id', restaurant.id).order('position'),
    supabase.from('items').select('*')
      .eq('restaurant_id', restaurant.id).order('position'),
    supabase.from('banners').select('*')
      .eq('restaurant_id', restaurant.id).eq('is_active', true).order('position'),
  ]);

  const theme = restaurant.template === 'slate' ? 'phone t-slate' : 'phone';

  return (
    <div className="stage">
      <ScanPing restaurantId={restaurant.id} />

      <div className={theme}>
        <header className="top">
          {restaurant.tagline && <p className="est">{restaurant.tagline}</p>}
          <h1 className="brand">{restaurant.name}</h1>
          <div className="meta">
            <span>
              <i className={restaurant.is_open ? 'dot-live' : 'dot-off'} />
              {restaurant.is_open ? 'Open now' : 'Closed'}
            </span>
            {restaurant.phone && <span>{restaurant.phone}</span>}
          </div>
        </header>

        {(banners ?? []).length > 0 && (
          <section className="promo" aria-label="Today at the restaurant">
            <p className="promo-label">Today</p>
            <div className="promo-rail">
              {(banners ?? []).map((b) => (
                <article key={b.id} className={`banner b${b.style}`}>
                  <h4>{b.title}</h4>
                  {b.subtitle && <p>{b.subtitle}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        <main className="sheet">
          {(categories ?? []).map((cat) => {
            const rows = (items ?? []).filter((i) => i.category_id === cat.id);
            if (rows.length === 0) return null;
            return (
              <section key={cat.id}>
                <div className="sec-head">
                  <h3>{cat.name}</h3><i />
                  {cat.note && <em>{cat.note}</em>}
                </div>
                {rows.map((item) => (
                  <div key={item.id} className={`item${item.is_available ? '' : ' out'}`}>
                    <span className={`mark ${item.is_veg ? 'veg' : 'non'}`}
                          aria-label={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'} />
                    <div className="item-body">
                      <p className="item-name">
                        {item.name}
                        {!item.is_available && <span className="stamp">Sold out</span>}
                      </p>
                      {item.description && <p className="item-desc">{item.description}</p>}
                    </div>
                    <p className="price">₹{toRupees(item.price_paise)}</p>
                  </div>
                ))}
              </section>
            );
          })}

          {(items ?? []).length === 0 && (
            <p className="empty-menu">This menu is being set up.</p>
          )}
        </main>

        <footer className="foot">
          <p><strong>Prices include taxes</strong></p>
        </footer>
      </div>
    </div>
  );
}
