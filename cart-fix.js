/* NOVERA cart: live catalog revalidation + quantity safety. */

async function refreshCartFromLiveCatalog() {
    const cart = getCart();
    if (!cart.length) return;

    try {
        const response = await fetch('/api/catalog', {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Catalog unavailable');

        const data = await response.json();
        const products = Array.isArray(data.products) ? data.products : [];
        let changed = false;

        cart.forEach(item => {
            const product = products.find(p =>
                String(p.id) === String(item.productId || item.id) ||
                String(p.name).toLowerCase() === String(item.name || '').toLowerCase()
            );
            if (!product) return;

            const variant = product.variants?.find(v =>
                (item.variantId && String(v.id) === String(item.variantId)) ||
                (!item.variantId && String(v.size).toLowerCase() === String(item.size || '').toLowerCase())
            );

            if (variant) {
                if (item.productId !== product.id) { item.productId = product.id; changed = true; }
                if (item.id !== product.id) { item.id = product.id; changed = true; }
                if (item.variantId !== variant.id) { item.variantId = variant.id; changed = true; }
                if (item.name !== product.name) { item.name = product.name; changed = true; }
                if (Number(item.price) !== Number(product.price)) { item.price = Number(product.price); changed = true; }
                if (item.image !== product.image) { item.image = product.image; changed = true; }
                if (item.size !== variant.size) { item.size = variant.size; changed = true; }
                if (item.color !== (variant.color || '')) { item.color = variant.color || ''; changed = true; }
                const available = Math.max(0, Number(variant.available) || 0);
                if (Number(item.quantity) > available && available > 0) {
                    item.quantity = available;
                    changed = true;
                }
            }
        });

        if (changed) {
            saveCart(cart);
            renderCart();
            updateCartCount();
        }
    } catch (error) {
        console.warn('NOVERA live cart refresh skipped:', error);
    }
}

/* Decreasing quantity from 1 removes the item. */
document.addEventListener('click', function (event) {
    const button = event.target.closest("#cart-items [data-action='decrease']");
    if (!button) return;

    const index = Number(button.dataset.index);
    const cart = getCart();
    const item = cart[index];
    if (!Number.isInteger(index) || !item) return;

    const quantity = Math.max(1, Number(item.quantity) || 1);
    if (quantity === 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cart.splice(index, 1);
        saveCart(cart);
        renderCart();
        updateCartCount();
    }
}, true);

document.addEventListener('DOMContentLoaded', () => {
    refreshCartFromLiveCatalog();
});
