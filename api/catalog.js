const { createClient } = require('@supabase/supabase-js');

const FALLBACK = Object.freeze([
  { id: 'novera-black-edition', name: 'NOVERA Black Edition', price: 22, currency: 'BHD', sizes: ['S','M','L','XL'], status: 'sold-out', image: '/images/novera-front.png' }
]);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(200).json({ products: FALLBACK, source: 'fallback' });

  try {
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase
      .from('products')
      .select('id,slug,name,description,price,image_url,active,inventory(stock,reserved_quantity)')
      .eq('active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const products = (data || []).map((p) => {
      const stock = Number(p.inventory?.stock || 0);
      const reserved = Number(p.inventory?.reserved_quantity || 0);
      return {
        id: p.slug,
        dbId: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        currency: 'BHD',
        sizes: ['S','M','L','XL'],
        available: Math.max(0, stock - reserved),
        status: stock - reserved > 0 ? 'in-stock' : 'sold-out',
        image: p.image_url || `/images/novera-${p.slug}.svg`
      };
    });

    return res.status(200).json({ products, source: 'supabase' });
  } catch (error) {
    console.error('NOVERA catalog error', error);
    return res.status(200).json({ products: FALLBACK, source: 'fallback' });
  }
};
