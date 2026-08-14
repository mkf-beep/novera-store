/* NOVERA Commerce bridge: live catalog, quantity-aware cart and secure pending-order flow. */
(function () {
  const CART_KEY = 'novera_cart';
  const PENDING_KEY = 'novera_pending_order';

  async function catalog() {
    const response = await fetch('/api/catalog', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Catalog unavailable');
    const data = await response.json();
    return Array.isArray(data.products) ? data.products : [];
  }

  function cart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function save(items) { localStorage.setItem(CART_KEY, JSON.stringify(items)); }

  function pendingOrder() {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function selectedSize() {
    const button = document.querySelector('.size-option.selected');
    return button ? button.textContent.trim() : null;
  }

  function selectedQuantity() {
    const value = Number(document.querySelector('.quantity-control span')?.textContent || 1);
    return Math.min(20, Math.max(1, Number.isFinite(value) ? value : 1));
  }

  function findProduct(products) {
    const title = (document.querySelector('.product-details h1')?.textContent || '').trim().toLowerCase();
    const slug = document.body.dataset.productSlug?.trim().toLowerCase();
    return products.find(p => (slug && String(p.id).toLowerCase() === slug) || String(p.name || '').toLowerCase() === title);
  }

  async function addProduct() {
    const button = document.querySelector('#addToCart, .cart-btn');
    if (!button) return;

    document.addEventListener('click', async (event) => {
      if (!event.target.closest('#addToCart, .cart-btn')) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const size = selectedSize();
      if (!size) return alert('Please select a size.');

      const requestedQuantity = selectedQuantity();
      button.disabled = true;
      try {
        const products = await catalog();
        const product = findProduct(products);
        const variant = product?.variants?.find(v => String(v.size).toLowerCase() === size.toLowerCase() && Number(v.available) > 0);
        if (!product || !variant) return alert('This size is currently unavailable.');

        const available = Number(variant.available);
        if (requestedQuantity > available) {
          return alert(`Only ${available} item${available === 1 ? '' : 's'} are currently available in size ${size}.`);
        }

        const items = cart();
        const existing = items.find(i => i.variantId === variant.id || (i.id === product.id && i.size === size));
        const currentQuantity = Number(existing?.quantity || 0);
        const nextQuantity = Math.min(20, currentQuantity + requestedQuantity);
        if (nextQuantity > available) {
          return alert(`Only ${available} item${available === 1 ? '' : 's'} are currently available in size ${size}.`);
        }

        if (existing) {
          existing.id = product.id;
          existing.productId = product.id;
          existing.variantId = variant.id;
          existing.quantity = nextQuantity;
          existing.price = Number(product.price);
          existing.name = product.name;
          existing.size = variant.size;
          existing.color = variant.color || existing.color || '';
          existing.image = product.image;
        } else {
          items.push({
            id: product.id,
            productId: product.id,
            variantId: variant.id,
            name: product.name,
            price: Number(product.price),
            size: variant.size,
            color: variant.color || '',
            quantity: requestedQuantity,
            image: product.image
          });
        }
        save(items);
        window.location.href = 'cart.html';
      } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to check live stock right now. Please try again.');
      } finally { button.disabled = false; }
    }, true);
  }

  async function checkout() {
    const button = document.getElementById('place-order');
    if (!button) return;

    const existingPending = pendingOrder();
    if (existingPending?.orderId) {
      button.textContent = 'CONTINUE TO PAYMENT';
      button.onclick = () => { window.location.href = 'payment.html'; };
      return;
    }

    button.onclick = async () => {
      const items = cart();
      if (!items.length) return alert('Your cart is empty.');

      const required = ['first-name','last-name','email','phone','address','city'];
      for (const id of required) {
        const field = document.getElementById(id);
        if (!field?.value.trim()) { alert('Please complete all required customer and shipping details.'); field?.focus(); return; }
      }

      const email = document.getElementById('email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address.');
        document.getElementById('email').focus();
        return;
      }

      const customer = {
        firstName: document.getElementById('first-name').value.trim(),
        lastName: document.getElementById('last-name').value.trim(),
        email,
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        city: document.getElementById('city').value.trim(),
        postal: document.getElementById('postal')?.value.trim() || '',
        notes: document.getElementById('notes')?.value.trim() || ''
      };

      button.disabled = true;
      button.textContent = 'RESERVING YOUR ORDER…';
      try {
        const payload = {
          customer,
          items: items.map(i => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            productId: i.productId || i.id,
            size: i.size,
            color: i.color
          }))
        };
        if (items.some(i => !i.variantId)) throw new Error('Cart contains an outdated item. Please remove it and add the product again.');

        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to create order');

        sessionStorage.setItem(PENDING_KEY, JSON.stringify(data.order));
        window.location.href = 'payment.html';
      } catch (error) {
        console.error(error);
        alert(error.message || 'Unable to create order. Please try again.');
        button.disabled = false;
        button.textContent = 'CONTINUE TO PAYMENT';
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    addProduct();
    checkout();
  });
})();
