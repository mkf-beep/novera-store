const { createClient } = require('@supabase/supabase-js');

const FALLBACK = Object.freeze([
  { id: 'eclipse', sku: 'NVR-ECL-001', name: 'NOVERA Eclipse', price: 22, currency: 'BHD', category: 'Originals', sizes: ['S','M','L','XL','2XL'], status: 'active', image: '/images/novera-eclipse.svg' },
  { id: 'atlas', sku: 'NVR-ATL-002', name: 'NOVERA Atlas', price: 24, currency: 'BHD', category: 'Performance', sizes: ['S','M','L','XL','2XL'], status: 'active', image: '/images/novera-atlas.svg' },
  { id: 'velocity', sku: 'NVR-VEL-003', name: 'NOVERA Velocity', price: 22, currency: 'BHD', category: 'Heritage', sizes: ['S','M','L','XL','2XL'], status: 'active', image: '/images/novera-velocity.svg' }
]);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ products: FALLBACK, source: 'fallback' });
  try {
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase.from('products').select('id,slug,name,description,price_bhd,status,product_variants(id,sku,size,color,stock,reserved)').eq('status', 'active').order('created_at', { ascending: true });
    if (error) throw error;
    const products = (data || []).map((p) => ({
      id: p.slug, dbId: p.id, sku: `NVR-${p.slug.toUpperCase()}`, name: p.name, description: p.description,
      price: Number(p.price_bhd), currency: 'BHD', sizes: (p.product_variants || []).map(v => v.size),
      variants: (p.product_variants || []).map(v => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, available: Math.max(0, Number(v.stock) - Number(v.reserved || 0)) })),
      status: (p.product_variants || []).some(v => Number(v.stock) - Number(v.reserved || 0) > 0) ? 'in-stock' : 'sold-out',
      image: `/images/novera-${p.slug}.svg`
    }));
    return res.status(200).json({ products, source: 'supabase' });
  } catch (error) {
    console.error('NOVERA catalog error', error);
    return res.status(200).json({ products: FALLBACK, source: 'fallback' });
  }
};
