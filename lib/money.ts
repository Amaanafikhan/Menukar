// Money is stored as integer paise everywhere. Never use floats for currency.
export const toRupees = (paise: number) =>
  (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const toPaise = (rupees: string) => {
  const n = Number(String(rupees).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

export const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
