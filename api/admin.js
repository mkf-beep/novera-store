import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wkcxebubwmcsmyywokpz.supabase.co';
const ADMIN_EMAIL = 'volkeno93@gmail.com';
const RESET_REDIRECT = 'https://novera-store.vercel.app/admin-reset.html';

function json(res, status, body) { return res.status(status).json(body); }
function fail(res, status, error) { return json(res, status, { ok: false, error }); }
function clean(v, max = 200) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

function publicClient(accessToken = '') {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('Supabase public key is not configured');
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
  });
}

async function requireAdmin(req) {
  const token = req.cookies?.novera_admin_access;
  if (!token) return { error: 'Not authenticated' };
  const supabase = publicClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return { error: 'Session expired' };
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_nova_admin');
  if (adminError || !isAdmin) return { error: 'Admin access required' };
  return { supabase, user: userData.user };
}

export default async function handler(req, res) {
  try {
    const action = clean(req.query?.action, 40);

    if (req.method === 'POST' && action === 'request-reset') {
      const email = clean(req.body?.email, 254).toLowerCase();
      if (email !== ADMIN_EMAIL) return json(res, 200, { ok: true });
      const supabase = publicClient();
      const { error } = await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: RESET_REDIRECT });
      if (error) return fail(res, 400, error.message || 'Unable to send reset email');
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && action === 'login') {
      const email = clean(req.body?.email, 254).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) return fail(res, 400, 'Email and password are required');

      const supabase = publicClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user || !data.session) return fail(res, 401, 'Invalid admin credentials');

      const authenticatedClient = publicClient(data.session.access_token);
      const { data: isAdmin, error: adminError } = await authenticatedClient.rpc('is_nova_admin');
      if (adminError || !isAdmin) return fail(res, 403, 'This account is not an administrator');

      res.setHeader('Set-Cookie', `novera_admin_access=${data.session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(60, data.session.expires_in || 3600)}`);
      return json(res, 200, { ok: true, email: data.user.email });
    }

    if (req.method === 'POST' && action === 'reset-password') {
      const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!accessToken || password.length < 10) return fail(res, 400, 'Use a password of at least 10 characters');

      const supabase = publicClient(accessToken);
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !userData.user) return fail(res, 401, 'This password reset link has expired or is invalid');

      const { data: isAdmin, error: adminError } = await supabase.rpc('is_nova_admin');
      if (adminError || !isAdmin) return fail(res, 403, 'This account is not an administrator');

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) return fail(res, 400, updateError.message || 'Unable to reset password');
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && action === 'logout') {
      res.setHeader('Set-Cookie', 'novera_admin_access=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      return json(res, 200, { ok: true });
    }

    const auth = await requireAdmin(req);
    if (auth.error) return fail(res, 401, auth.error);
    const { supabase } = auth;

    if (req.method === 'GET' && action === 'dashboard') {
      const { data, error } = await supabase.rpc('admin_dashboard');
      if (error || !data) return fail(res, 500, 'Unable to load dashboard');
      return json(res, 200, data);
    }

    if (req.method === 'PATCH' && action === 'inventory') {
      const productId = clean(req.body?.productId, 80);
      const stock = Number(req.body?.stock);
      if (!productId || !Number.isInteger(stock) || stock < 0) return fail(res, 400, 'Invalid stock');
      const { error } = await supabase.rpc('admin_update_inventory', { p_product_id: productId, p_stock: stock });
      if (error) return fail(res, 400, error.message || 'Unable to update inventory');
      return json(res, 200, { ok: true });
    }

    if (req.method === 'PATCH' && action === 'order') {
      const orderId = clean(req.body?.orderId, 80);
      const status = clean(req.body?.status, 30);
      const allowed = ['pending','paid','processing','shipped','delivered','cancelled','refunded'];
      if (!orderId || !allowed.includes(status)) return fail(res, 400, 'Invalid order status');
      const { error } = await supabase.rpc('admin_update_order_status', { p_order_id: orderId, p_status: status });
      if (error) return fail(res, 400, error.message || 'Unable to update order');
      return json(res, 200, { ok: true });
    }

    return fail(res, 404, 'Unknown admin action');
  } catch (error) {
    console.error('NOVERA admin API error', error);
    return fail(res, 500, 'Admin service unavailable');
  }
}
