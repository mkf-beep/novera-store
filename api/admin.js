import { createClient } from '@supabase/supabase-js';

function json(res, status, body) { return res.status(status).json(body); }
function fail(res, status, error) { return json(res, status, { ok: false, error }); }
function clean(v, max = 200) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Admin service is not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin(req) {
  const token = req.cookies?.novera_admin_access;
  if (!token) return { error: 'Not authenticated' };
  const supabase = adminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { error: 'Session expired' };
  const { data: admin, error: adminError } = await supabase.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (adminError || !admin) return { error: 'Admin access required' };
  return { supabase, user: userData.user };
}

export default async function handler(req, res) {
  try {
    const action = clean(req.query?.action, 40);

    if (req.method === 'POST' && action === 'login') {
      const email = clean(req.body?.email, 254).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) return fail(res, 400, 'Email and password are required');

      const supabase = adminClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user || !data.session) return fail(res, 401, 'Invalid admin credentials');

      const { data: admin, error: adminError } = await supabase.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
      if (adminError || !admin) {
        await supabase.auth.admin.signOut(data.user.id).catch(() => {});
        return fail(res, 403, 'This account is not an administrator');
      }

      res.setHeader('Set-Cookie', `novera_admin_access=${data.session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(60, data.session.expires_in || 3600)}`);
      return json(res, 200, { ok: true, email: data.user.email });
    }

    if (req.method === 'POST' && action === 'logout') {
      res.setHeader('Set-Cookie', 'novera_admin_access=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return json(res, 200, { ok: true });
    }

    const auth = await requireAdmin(req);
    if (auth.error) return fail(res, 401, auth.error);
    const { supabase } = auth;

    if (req.method === 'GET' && action === 'dashboard') {
      const [{ data: orders, error: ordersError }, { data: products, error: productsError }] = await Promise.all([
        supabase.from('orders').select('id,order_number,customer_name,email,phone,address,city,subtotal,shipping,total,status,payment_status,payment_reference,created_at,updated_at,order_items(id,product_id,product_name,size,color,quantity,unit_price,total_price)').order('created_at', { ascending: false }).limit(100),
        supabase.from('products').select('id,name,slug,price,image_url,active,created_at,inventory(stock,reserved_quantity,updated_at)').order('created_at', { ascending: false })
      ]);
      if (ordersError || productsError) return fail(res, 500, 'Unable to load dashboard');
      const paid = (orders || []).filter(o => o.payment_status === 'paid').length;
      const revenue = (orders || []).filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total || 0), 0);
      const units = (orders || []).filter(o => o.payment_status === 'paid').flatMap(o => o.order_items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      return json(res, 200, { ok: true, stats: { orders: (orders || []).length, paidOrders: paid, revenue, units }, orders: orders || [], products: products || [] });
    }

    if (req.method === 'PATCH' && action === 'inventory') {
      const productId = clean(req.body?.productId, 80);
      const stock = Number(req.body?.stock);
      if (!productId || !Number.isInteger(stock) || stock < 0) return fail(res, 400, 'Invalid stock');
      const { data: current, error: currentError } = await supabase.from('inventory').select('stock,reserved_quantity').eq('product_id', productId).maybeSingle();
      if (currentError || !current) return fail(res, 404, 'Inventory not found');
      if (stock < Number(current.reserved_quantity || 0)) return fail(res, 400, 'Stock cannot be below reserved quantity');
      const { error } = await supabase.from('inventory').update({ stock, updated_at: new Date().toISOString() }).eq('product_id', productId);
      if (error) return fail(res, 500, 'Unable to update inventory');
      return json(res, 200, { ok: true });
    }

    if (req.method === 'PATCH' && action === 'order') {
      const orderId = clean(req.body?.orderId, 80);
      const status = clean(req.body?.status, 30);
      const allowed = ['pending','paid','processing','shipped','delivered','cancelled','refunded'];
      if (!orderId || !allowed.includes(status)) return fail(res, 400, 'Invalid order status');
      const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
      if (error) return fail(res, 500, 'Unable to update order');
      return json(res, 200, { ok: true });
    }

    return fail(res, 404, 'Unknown admin action');
  } catch (error) {
    console.error('NOVERA admin API error', error);
    return fail(res, 500, 'Admin service unavailable');
  }
}
