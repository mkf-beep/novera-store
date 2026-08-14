/* NOVERA Commerce 2.0 bridge: connects the existing UI to server-side catalog/orders. */
(function () {
  const CART_KEY = 'novera_cart';

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

  function selectedSize() {
    const button = document.querySelector('.size-option.selected');
    return button ? button.textContent.trim() : null;
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

      button.disabled = true;
      try {
        const products = await catalog();
        const title = (document.querySelector('.product-details h1')?.textContent || 'NOVERA Eclipse').trim();
        const product = products.find(p => p.name.toLowerCase() === title.toLowerCase()) || products[0];
        const variant = product?.variants?.find(v => v.size === size && v.available > 0);
        if (!product || !variant) return alert('This size is currently unavailable.');

        const items = cart();
        const existing = items.find(i => i.variantId === variant.id);
        if (existing) existing.quantity = Math.min(20, Number(existing.quantity || 0) + 1);
        else items.push({ id: product.id, variantId: variant.id, name: product.name, price: product.price, size: variant.size, color: variant.color, quantity: 1, image: product.image });
        save(items);
        window.location.href = 'cart.html';
      } catch (error) {
        console.error(error);
        alert('Unable to check stock right now. Please try again.');
      } finally { button.disabled = false; }
    }, true);
  }

  async function checkout() {
    const button = document.getElementById('place-order');
    if (!button) return;
    button.onclick = async () => {
      const items = cart();
      if (!items.length) return alert('Your cart is empty.');

      const required = ['first-name','last-name','email','phone','address','city'];
      for (const id of required) {
        const field = document.getElementById(id);
        if (!field?.value.trim()) { alert('Please complete all required customer and shipping details.'); field?.focus(); return; }
      }

      const customer = {
        firstName: document.getElementById('first-name').value.trim(),
        lastName: document.getElementById('last-name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        city: document.getElementById('city').value.trim(),
        postal: document.getElementById('postal')?.value.trim() || '',
        notes: document.getElementById('notes')?.value.trim() || ''
      };

      button.disabled = true;
      button.textContent = 'CREATING ORDER…';
      try {
        const payload = { customer, items: items.map(i => ({ variantId: i.variantId, quantity: Number(i.quantity) })) };
        if (items.some(i => !i.variantId)) throw new Error('Cart contains an outdated item. Please remove it and add the product again.');

        const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to create order');

        sessionStorage.setItem('novera_pending_order', JSON.stringify(data.order));
        localStorage.removeItem(CART_KEY);
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
