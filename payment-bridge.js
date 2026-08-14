/* NOVERA payment page: display the server-created pending order without collecting card data. */
(function () {
  const PENDING_KEY = 'novera_pending_order';
  const CART_KEY = 'novera_cart';

  function getOrder() {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function money(value) {
    return `${Number(value || 0).toFixed(3).replace(/\.000$/, '')} BHD`;
  }

  function render() {
    const order = getOrder();
    const items = document.getElementById('payment-items');
    const subtotal = document.getElementById('payment-subtotal');
    const total = document.getElementById('payment-total');
    const button = document.getElementById('pay-now-btn');
    const notice = document.querySelector('.payment-gateway-notice');

    if (!order?.orderId) {
      if (items) items.innerHTML = '<p>No pending order was found. Return to checkout to create an order.</p>';
      if (subtotal) subtotal.textContent = '0 BHD';
      if (total) total.textContent = '0 BHD';
      if (button) { button.disabled = true; button.textContent = 'NO PENDING ORDER'; }
      return;
    }

    if (items) items.innerHTML = `<div class="payment-order-number">ORDER ${String(order.orderNumber || '').replace(/[<>]/g, '')}</div><p>Payment status: ${String(order.paymentStatus || 'pending').toUpperCase()}</p>`;
    if (subtotal) subtotal.textContent = money(order.subtotalBhd);
    if (total) total.textContent = money(order.totalBhd);
    if (notice) notice.querySelector('h3')?.replaceChildren(document.createTextNode('SECURE PAYMENT PROVIDER PENDING'));
    if (button) { button.disabled = true; button.textContent = 'PAYMENT GATEWAY NOT CONNECTED'; }
  }

  document.addEventListener('DOMContentLoaded', render);
})();
