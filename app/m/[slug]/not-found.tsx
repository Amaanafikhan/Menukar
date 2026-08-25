export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center',
                   background: '#0C1F1B', color: '#F3F0E6', padding: 24, textAlign: 'center' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: 34, fontWeight: 400 }}>
          No menu here
        </h1>
        <p style={{ fontSize: 14, color: '#9BB8AF', marginTop: 8 }}>
          Check the QR code or ask the staff for a fresh one.
        </p>
      </div>
    </main>
  );
}
