import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wkcxebubwmcsmyywokpz.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_fdqrwx3n_qRuOqHK35w5kg_W9tb3HPK';
const ADMIN_EMAIL = 'volkeno93@gmail.com';
const RESET_REDIRECT = 'https://novera-store.vercel.app/admin-reset.html';
const IMAGE_BUCKET = 'product-images';

function json(res, status, body) { return res.status(status).json(body); }
function fail(res, status, error) { return json(res, status, { ok: false, error }); }
function clean(v, max = 200) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function publicClient(accessToken = '') { return createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { autoRefreshToken: false, persistSession: false }, global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined }); }
async function requestPasswordReset() { const { error } = await publicClient().auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: RESET_REDIRECT }); if (error) throw new Error(error.message || 'Unable to send reset email'); }
async function requireAdmin(req) { const token = req.cookies?.novera_admin_access; if (!token) return { error: 'Not authenticated' }; const supabase = publicClient(token); const { data: userData, error: userError } = await supabase.auth.getUser(token); if (userError || !userData.user) return { error: 'Session expired' }; const { data: isAdmin, error: adminError } = await supabase.rpc('is_nova_admin'); if (adminError || !isAdmin) return { error: 'Admin access required' }; return { supabase, user: userData.user }; }
function parseImage(dataUrl) { if (typeof dataUrl !== 'string') throw new Error('Image is required'); const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/); if (!match) throw new Error('Unsupported image format'); const buffer = Buffer.from(match[2], 'base64'); if (!buffer.length || buffer.length > 3 * 1024 * 1024) throw new Error('Image must be smaller than 3 MB'); return { contentType: match[1], buffer }; }
function imageExt(contentType) { return contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'; }

async function decorateProducts(supabase, products) {
  const ids = (products || []).map(p => p.id).filter(Boolean);
  if (!ids.length) return products || [];
  const [{ data: images }, { data: variants }] = await Promise.all([
    supabase.from('product_images').select('id,product_id,image_url,alt_text,sort_order').in('product_id', ids).order('sort_order').order('created_at'),
    supabase.from('product_variants').select('id,product_id,size,color,stock,sort_order').in('product_id', ids).order('sort_order').order('created_at')
  ]);
  return (products || []).map(p => ({ ...p, images: (images || []).filter(i => i.product_id === p.id), variants: (variants || []).filter(v => v.product_id === p.id) }));
}

export default async function handler(req, res) {
  try {
    const action = clean(req.query?.action, 40);
    if (req.method === 'POST' && action === 'request-reset') { const email = clean(req.body?.email, 254).toLowerCase(); if (email !== ADMIN_EMAIL) return json(res, 200, { ok: true }); await requestPasswordReset(); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && action === 'login') {
      const email = clean(req.body?.email, 254).toLowerCase(), password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) return fail(res, 400, 'Email and password are required');
      const supabase = publicClient(); const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user || !data.session) return fail(res, 401, 'Invalid admin credentials');
      const authenticatedClient = publicClient(data.session.access_token); const { data: isAdmin, error: adminError } = await authenticatedClient.rpc('is_nova_admin');
      if (adminError || !isAdmin) return fail(res, 403, 'This account is not an administrator');
      res.setHeader('Set-Cookie', `novera_admin_access=${data.session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(60, data.session.expires_in || 3600)}`); return json(res, 200, { ok: true, email: data.user.email });
    }
    if (req.method === 'POST' && action === 'reset-password') {
      const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken : '', password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!accessToken || password.length < 10) return fail(res, 400, 'Use a password of at least 10 characters'); const supabase = publicClient(accessToken);
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken); if (userError || !userData.user) return fail(res, 401, 'This password reset link has expired or is invalid');
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_nova_admin'); if (adminError || !isAdmin) return fail(res, 403, 'This account is not an administrator');
      const { error: updateError } = await supabase.auth.updateUser({ password }); if (updateError) return fail(res, 400, updateError.message || 'Unable to reset password'); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'logout') { res.setHeader('Set-Cookie', 'novera_admin_access=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); return json(res, 200, { ok: true }); }

    const auth = await requireAdmin(req); if (auth.error) return fail(res, 401, auth.error); const { supabase } = auth;

    if (req.method === 'GET' && action === 'dashboard') {
      const { data, error } = await supabase.rpc('admin_dashboard'); if (error || !data) return fail(res, 500, error?.message || 'Unable to load dashboard');
      data.products = await decorateProducts(supabase, data.products || []); return json(res, 200, data);
    }

    if (req.method === 'POST' && action === 'product') {
      const body = req.body || {}, id = clean(body.id, 80) || null, name = clean(body.name, 120);
      const slug = clean(body.slug, 140).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''), description = clean(body.description, 2000);
      const price = Number(body.price), stock = Number(body.stock), active = body.active !== false;
      if (!name || !slug || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) return fail(res, 400, 'Check product name, price and stock');
      const { data, error } = await supabase.rpc('admin_upsert_product', { p_id: id, p_name: name, p_slug: slug, p_description: description, p_price: price, p_image_url: clean(body.imageUrl, 1000) || null, p_active: active, p_stock: stock });
      if (error) return fail(res, 400, error.message || 'Unable to save product');
      const productId = data.product.id;
      if (Array.isArray(body.variants)) {
        const variants = body.variants.map((v, n) => ({ product_id: productId, size: clean(v.size, 30), color: clean(v.color, 50), stock: Number(v.stock), sort_order: n })).filter(v => v.size && Number.isInteger(v.stock) && v.stock >= 0);
        const { error: clearError } = await supabase.from('product_variants').delete().eq('product_id', productId); if (clearError) return fail(res, 400, clearError.message);
        if (variants.length) { const { error: variantError } = await supabase.from('product_variants').insert(variants); if (variantError) return fail(res, 400, variantError.message); }
      }
      return json(res, 200, { ok: true, ...data });
    }

    if (req.method === 'POST' && action === 'upload-image') {
      const productId = clean(req.body?.productId, 80); if (!productId) return fail(res, 400, 'Product ID is required');
      const { buffer, contentType } = parseImage(req.body?.image); const path = `${productId}/${crypto.randomUUID()}.${imageExt(contentType)}`;
      const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, buffer, { contentType, upsert: false, cacheControl: '31536000' });
      if (uploadError) return fail(res, 400, uploadError.message || 'Unable to upload image'); const { data: publicData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
      const { data: imageRow, error: imageError } = await supabase.from('product_images').insert({ product_id: productId, image_url: publicData.publicUrl, alt_text: clean(req.body?.alt, 200), sort_order: Number(req.body?.sortOrder) || 0 }).select().single();
      if (imageError) return fail(res, 400, imageError.message || 'Unable to save image');
      if (Number(req.body?.sortOrder) === 0) await supabase.from('products').update({ image_url: publicData.publicUrl }).eq('id', productId);
      return json(res, 200, { ok: true, image: imageRow });
    }

    if (req.method === 'DELETE' && action === 'image') {
      const imageId = clean(req.query?.id, 80); if (!imageId) return fail(res, 400, 'Image ID is required');
      const { data: row, error: readError } = await supabase.from('product_images').select('id,product_id,image_url').eq('id', imageId).single(); if (readError || !row) return fail(res, 404, 'Image not found');
      const marker = '/storage/v1/object/public/product-images/'; const storagePath = row.image_url.includes(marker) ? row.image_url.split(marker)[1] : null; if (storagePath) await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
      const { error } = await supabase.from('product_images').delete().eq('id', imageId); if (error) return fail(res, 400, error.message); return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && action === 'variants') {
      const productId = clean(req.body?.productId, 80), variants = Array.isArray(req.body?.variants) ? req.body.variants : [];
      if (!productId) return fail(res, 400, 'Product ID is required');
      const rows = variants.map((v,n)=>({ product_id: productId, size: clean(v.size,30), color: clean(v.color,50), stock:Number(v.stock), sort_order:n })).filter(v=>v.size && Number.isInteger(v.stock) && v.stock>=0);
      const { error: clearError } = await supabase.from('product_variants').delete().eq('product_id', productId); if (clearError) return fail(res,400,clearError.message);
      if (rows.length) { const { error } = await supabase.from('product_variants').insert(rows); if (error) return fail(res,400,error.message); }
      return json(res,200,{ok:true,variants:rows});
    }

    if (req.method === 'DELETE' && action === 'product') { const productId = clean(req.query?.id, 80); if (!productId) return fail(res, 400, 'Product ID is required'); const { data, error } = await supabase.rpc('admin_delete_product', { p_product_id: productId }); if (error) return fail(res, 400, error.message || 'Unable to remove product'); return json(res, 200, data || { ok: true }); }
    if (req.method === 'PATCH' && action === 'inventory') { const productId = clean(req.body?.productId, 80), stock = Number(req.body?.stock); if (!productId || !Number.isInteger(stock) || stock < 0) return fail(res, 400, 'Invalid stock'); const { error } = await supabase.rpc('admin_update_inventory', { p_product_id: productId, p_stock: stock }); if (error) return fail(res, 400, error.message || 'Unable to update inventory'); return json(res, 200, { ok: true }); }
    if (req.method === 'PATCH' && action === 'order') { const orderId = clean(req.body?.orderId, 80), status = clean(req.body?.status, 30), allowed = ['pending','paid','processing','shipped','delivered','cancelled','refunded']; if (!orderId || !allowed.includes(status)) return fail(res, 400, 'Invalid order status'); const { error } = await supabase.rpc('admin_update_order_status', { p_order_id: orderId, p_status: status }); if (error) return fail(res, 400, error.message || 'Unable to update order'); return json(res, 200, { ok: true }); }
    return fail(res, 404, 'Unknown admin action');
  } catch (error) { console.error('NOVERA admin API error', error); return fail(res, 500, error?.message || 'Admin service unavailable'); }
}
