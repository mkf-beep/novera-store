import { createClient } from '@supabase/supabase-js';

function fail(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

function clean(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Method not allowed');
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return fail(res, 503, 'Order service is not configured');

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length < 1 || rawItems.length > 20) return fail(res, 400, 'Invalid cart');

  const email = clean(customer.email, 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'Invalid email');

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const normalizedItems = [];

  for (const item of rawItems) {
    const slug = clean(item.productId || item.id, 120);
    const quantity = Number(item.quantity);
    if (!slug || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return fail(res, 400, 'Invalid cart item');

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id,slug')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();

    if (productError) {
      console.error('NOVERA product lookup failed', productError);
      return fail(res, 500, 'Unable to validate cart');
    }
    if (!product) return fail(res, 400, 'Product unavailable');

    normalizedItems.push({
      productId: product.id,
      quantity,
      size: clean(item.size, 30),
      color: clean(item.color, 30)
    });
  }

  const payload = {
    p_customer_name: `${clean(customer.firstName, 80)} ${clean(customer.lastName, 80)}`.trim(),
    p_email: email,
    p_phone: clean(customer.phone, 40),
    p_address: clean(customer.address, 300),
    p_city: clean(customer.city, 100),
    p_items: normalizedItems
  };

  if (!payload.p_customer_name || !payload.p_phone || !payload.p_address || !payload.p_city) {
    return fail(res, 400, 'Required customer or shipping details are missing');
  }

  const { data, error } = await supabase.rpc('create_novera_order', payload);
  if (error) {
    console.error('NOVERA order creation failed', error);
    const safeMessage = /stock|unavailable|inventory|quantity|cart|product/i.test(error.message)
      ? error.message
      : 'Unable to create order';
    return fail(res, 400, safeMessage);
  }

  return res.status(201).json({ ok: true, order: data });
}
