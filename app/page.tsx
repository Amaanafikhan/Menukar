import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 620, margin: '0 auto', padding: '80px 24px' }}>
      <p style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase',
                  color: 'var(--turmeric)', fontWeight: 700 }}>
        Menukar
      </p>
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 54, lineHeight: .95,
                   margin: '10px 0 16px', fontWeight: 400 }}>
        Your menu, updated<br />from your phone.
      </h1>
      <p style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 28 }}>
        Print the QR once. Change prices, mark dishes sold out and run your own
        offers — customers see it the moment you save.
      </p>
      <Link href="/login" className="btn" style={{ display: 'inline-block' }}>
        Set up your menu
      </Link>
    </main>
  );
}
