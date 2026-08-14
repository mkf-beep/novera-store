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

  if (!url || !serviceKey) {
    return fail(res, 503, 'Order service is not configured');
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (rawItems.length < 1 || rawItems.length > 20) {
    return fail(res, 400, 'Invalid cart');
  }

  const email = clean(customer.email, 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'Invalid email');

  const payload = {
    p_customer_email: email,
    p_customer_first_name: clean(customer.firstName, 80),
    p_customer_last_name: clean(customer.lastName, 80),
    p_customer_phone: clean(customer.phone, 40),
    p_shipping_address: clean(customer.address, 300),
    p_shipping_city: clean(customer.city, 100),
    p_shipping_postal: clean(customer.postal, 30),
    p_notes: clean(customer.notes, 500),
    p_items: rawItems.map((item) => ({
      variantId: clean(item.variantId, 80),
      quantity: Number.isInteger(item.quantity) ? item.quantity : Number(item.quantity)
    }))
  };

  if (!payload.p_customer_first_name || !payload.p_customer_last_name ||
      !payload.p_customer_phone || !payload.p_shipping_address ||
      !payload.p_shipping_city) {
    return fail(res, 400, 'Required customer or shipping details are missing');
  }

  if (payload.p_items.some((item) => !item.variantId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    return fail(res, 400, 'Invalid cart item');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await supabase.rpc('create_order', payload);

  if (error) {
    console.error('NOVERA order creation failed', error);
    const safeMessage = /stock|unavailable|variant|quantity|cart/i.test(error.message)
      ? error.message
      : 'Unable to create order';
    return fail(res, 400, safeMessage);
  }

  return res.status(201).json({ ok: true, order: data });
}
