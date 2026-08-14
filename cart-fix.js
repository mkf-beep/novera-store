/* NOVERA cart fix: decreasing quantity from 1 removes the item. */
document.addEventListener("click", function (event) {
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
