'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { toRupees, toPaise } from '@/lib/money';

type Category = { id: string; name: string; note: string | null };
type Item = {
  id: string; category_id: string; name: string; description: string | null;
  price_paise: number; is_veg: boolean; is_available: boolean;
};

export default function MenuManager({
  restaurantId, categories, items,
}: { restaurantId: string; categories: Category[]; items: Item[] }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function toggle(item: Item) {
    setBusyId(item.id); setError('');
    const { error } = await supabase
      .from('items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);
    setBusyId(null);
    if (error) { setError('Could not save. Check your connection and try again.'); return; }
    start(() => router.refresh());
  }

  async function remove(item: Item) {
    if (!confirm(`Remove ${item.name} from the menu?`)) return;
    setBusyId(item.id);
    const { error } = await supabase.from('items').delete().eq('id', item.id);
    setBusyId(null);
    if (error) { setError('Could not remove the item.'); return; }
    start(() => router.refresh());
  }

  return (
    <section className="card">
      <div className="card-h">
        <h2>Menu</h2>
        <span className="hint">Changes appear instantly on the QR page</span>
      </div>

      {error && <p className="err" style={{ padding: '10px 16px 0' }}>{error}</p>}

      {categories.length === 0 && (
        <p className="empty">No sections yet.</p>
      )}

      {categories.map((cat) => {
        const rows = items.filter((i) => i.category_id === cat.id);
        return (
          <div key={cat.id}>
            <div className="cat">
              <h3>{cat.name}</h3><i />
              {cat.note && <em>{cat.note}</em>}
            </div>

            {rows.length === 0 && <p className="empty">Nothing in this section yet.</p>}

            {rows.map((item) => (
              <div key={item.id} className={`row${item.is_available ? '' : ' off'}`}>
                <span className={`mark ${item.is_veg ? 'veg' : 'non'}`}
                      aria-label={item.is_veg ? 'Vegetarian' : 'Non-vegetarian'} />
                <span className="nm">
                  <p>{item.name}</p>
                  <small>{item.is_available ? (item.description ?? '') : 'Sold out'}</small>
                </span>
                <span className="pr">₹{toRupees(item.price_paise)}</span>
                <button
                  className="tg"
                  aria-pressed={item.is_available}
                  aria-label={`${item.name} availability`}
                  disabled={busyId === item.id || pending}
                  onClick={() => toggle(item)}
                />
                <button className="btn ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => remove(item)} disabled={busyId === item.id}>
                  Remove
                </button>
              </div>
            ))}

            {adding === cat.id ? (
              <AddItem
                restaurantId={restaurantId}
                categoryId={cat.id}
                position={rows.length}
                onDone={() => { setAdding(null); start(() => router.refresh()); }}
                onCancel={() => setAdding(null)}
              />
            ) : (
              <button
                onClick={() => setAdding(cat.id)}
                style={{ width: '100%', padding: 12, background: 'transparent', border: 0,
                         borderTop: '1px dashed var(--edge)', fontSize: 13, fontWeight: 500,
                         color: 'var(--ink-2)', cursor: 'pointer' }}>
                + Add item to {cat.name}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

function AddItem({
  restaurantId, categoryId, position, onDone, onCancel,
}: {
  restaurantId: string; categoryId: string; position: number;
  onDone: () => void; onCancel: () => void;
}) {
  const supabase = supabaseBrowser();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isVeg, setIsVeg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const clean = name.trim();
    const paise = toPaise(price);
    if (clean.length < 1) { setError('Give the dish a name.'); return; }
    if (paise === null) { setError('Enter a price, like 90 or 90.50.'); return; }

    setBusy(true); setError('');
    const { error } = await supabase.from('items').insert({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name: clean,
      description: description.trim() || null,
      price_paise: paise,
      is_veg: isVeg,
      position,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    onDone();
  }

  return (
    <div className="pad" style={{ borderTop: '1px dashed var(--edge)', background: '#FAF8F1' }}>
      {error && <p className="err">{error}</p>}
      <div className="grid2">
        <div className="field">
          <label>Dish name</label>
          <input value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Price (₹)</label>
          <input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Description (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label>Type</label>
        <select value={isVeg ? 'veg' : 'non'} onChange={(e) => setIsVeg(e.target.value === 'veg')}>
          <option value="veg">Vegetarian</option>
          <option value="non">Non-vegetarian</option>
        </select>
      </div>
      <button className="btn" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Add to menu'}
      </button>
      <button className="btn ghost" style={{ marginLeft: 8 }} onClick={onCancel}>Cancel</button>
    </div>
  );
}
