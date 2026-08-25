'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { supabaseBrowser } from '@/lib/supabase-browser';

type Banner = {
  id: string; title: string; subtitle: string | null;
  style: string; is_active: boolean;
};

export default function QrPanel({
  slug, restaurantId, banners,
}: { slug: string; restaurantId: string; banners: Banner[] }) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [png, setPng] = useState('');
  const [url, setUrl] = useState('');
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const full = `${base}/m/${slug}`;
    setUrl(full);
    QRCode.toDataURL(full, {
      width: 900, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#12302A', light: '#FFFFFF' },
    }).then(setPng).catch(() => setPng(''));
  }, [slug]);

  async function toggleBanner(b: Banner) {
    await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id);
    start(() => router.refresh());
  }

  async function addBanner() {
    if (title.trim().length < 1) return;
    const styles = ['a', 'b', 'c'];
    await supabase.from('banners').insert({
      restaurant_id: restaurantId,
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      style: styles[banners.length % 3],
      position: banners.length,
    });
    setTitle(''); setSubtitle(''); setAdding(false);
    start(() => router.refresh());
  }

  return (
    <>
      <section className="card">
        <div className="card-h"><h2>Your QR code</h2></div>
        <div className="qr-box">
          {png
            ? <img src={png} alt="QR code linking to your menu" />
            : <p className="hint" style={{ padding: 40 }}>Building your code…</p>}
          <p className="url">{url}</p>
          <a className="btn wide" href={png} download={`${slug}-qr.png`}
             style={{ display: 'block', textAlign: 'center' }}>
            Download for print
          </a>
          <a className="btn wide ghost" href={`/m/${slug}`} target="_blank" rel="noreferrer"
             style={{ display: 'block', textAlign: 'center' }}>
            Open my menu
          </a>
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <h2>Banners</h2>
          <span className="hint">{banners.length} of 5</span>
        </div>

        {banners.length === 0 && !adding && (
          <p className="empty">Run your own offers above the menu.</p>
        )}

        {banners.map((b) => (
          <div key={b.id} className="row">
            <span style={{
              width: 34, height: 34, borderRadius: 5, flex: '0 0 34px',
              background: b.style === 'a' ? 'linear-gradient(105deg,#9E2B1B,#C6503A)'
                        : b.style === 'b' ? 'linear-gradient(105deg,#12302A,#2C6152)'
                        : 'linear-gradient(105deg,#B37A08,#E4A11B)',
            }} />
            <span className="nm">
              <p>{b.title}</p>
              <small>{b.is_active ? 'Live' : 'Hidden'}</small>
            </span>
            <button className="tg" aria-pressed={b.is_active}
                    aria-label={`${b.title} visibility`}
                    onClick={() => toggleBanner(b)} />
          </div>
        ))}

        {adding ? (
          <div className="pad" style={{ borderTop: '1px dashed var(--edge)', background: '#FAF8F1' }}>
            <div className="field">
              <label>Headline</label>
              <input value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>Line below (optional)</label>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <button className="btn" onClick={addBanner}>Add banner</button>
            <button className="btn ghost" style={{ marginLeft: 8 }}
                    onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : banners.length < 5 ? (
          <button onClick={() => setAdding(true)}
                  style={{ width: '100%', padding: 12, background: 'transparent', border: 0,
                           borderTop: '1px dashed var(--edge)', fontSize: 13, fontWeight: 500,
                           color: 'var(--ink-2)', cursor: 'pointer' }}>
            + New banner
          </button>
        ) : null}
      </section>
    </>
  );
}
