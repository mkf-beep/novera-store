/* ========================================
   NOVERA STORE
   CART / CHECKOUT FRONTEND
======================================== */

const CART_KEY = "novera_cart";
const CUSTOMER_KEY = "novera_customer";


/* ========================================
   CART STORAGE
======================================== */

function getCart() {
    try {
        const stored = localStorage.getItem(CART_KEY);

        if (!stored) {
            return [];
        }

        const cart = JSON.parse(stored);

        return Array.isArray(cart) ? cart : [];

    } catch (error) {
        console.error("Unable to load cart:", error);
        return [];
    }
}


function saveCart(cart) {
    if (!Array.isArray(cart)) {
        return;
    }

    localStorage.setItem(
        CART_KEY,
        JSON.stringify(cart)
    );
}


/* ========================================
   PRODUCT PAGE
======================================== */

function setupProductPage() {

    const cartButton =
        document.querySelector(".cart-btn");

    if (!cartButton) {
        return;
    }

    const sizeButtons =
        document.querySelectorAll(".size-option");

    const quantityDisplay =
        document.querySelector(
            ".quantity-control span"
        );

    const minusButton =
        document.querySelector(
            ".quantity-control button:first-child"
        );

    const plusButton =
        document.querySelector(
            ".quantity-control button:last-child"
        );

    let selectedSize = null;
    let quantity = 1;


    /* SIZE */

    sizeButtons.forEach(button => {

        button.addEventListener("click", () => {

            sizeButtons.forEach(item => {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedSize =
                button.textContent.trim();

        });

    });


    /* QUANTITY */

    if (plusButton) {

        plusButton.addEventListener("click", () => {

            if (quantity >= 20) {
                return;
            }

            quantity++;

            if (quantityDisplay) {
                quantityDisplay.textContent =
                    quantity;
            }

        });

    }


    if (minusButton) {

        minusButton.addEventListener("click", () => {

            if (quantity <= 1) {
                return;
            }

            quantity--;

            if (quantityDisplay) {
                quantityDisplay.textContent =
                    quantity;
            }

        });

    }


    /* ADD TO CART */

    cartButton.addEventListener("click", () => {

        if (!selectedSize) {

            alert("Please select a size.");

            return;
        }


        const product = {

            id: "novera-black-edition",

            name: "NOVERA Black Edition",

            price: 22,

            size: selectedSize,

            color: "Black",

            quantity: quantity,

            image: "images/novera-front.png"

        };


        const cart = getCart();


        const existingProduct =
            cart.find(item =>
                item.id === product.id &&
                item.size === product.size &&
                item.color === product.color
            );


        if (existingProduct) {

            existingProduct.quantity =
                Math.min(
                    existingProduct.quantity +
                    product.quantity,
                    20
                );

        } else {

            cart.push(product);

        }


        saveCart(cart);

        updateCartCount();

        window.location.href =
            "cart.html";

    });

}


/* ========================================
   CART PAGE
======================================== */

function setupCartPage() {

    const cartContainer =
        document.getElementById(
            "cart-items"
        );

    if (!cartContainer) {
        return;
    }

    renderCart();

}


/* ========================================
   RENDER CART
======================================== */

function renderCart() {

    const cartContainer =
        document.getElementById(
            "cart-items"
        );

    const emptyCart =
        document.getElementById(
            "cart-empty"
        );

    const cartSubtotal =
        document.getElementById(
            "cart-subtotal"
        );

    const cartTotal =
        document.getElementById(
            "cart-total"
        );


    if (!cartContainer) {
        return;
    }


    const cart = getCart();

    cartContainer.innerHTML = "";


    /* EMPTY CART */

    if (cart.length === 0) {

        if (emptyCart) {
            emptyCart.style.display =
                "block";
        }

        if (cartSubtotal) {
            cartSubtotal.textContent =
                "0.00 BHD";
        }

        if (cartTotal) {
            cartTotal.textContent =
                "0.00 BHD";
        }

        setupCartCheckout();

        return;
    }


    if (emptyCart) {
        emptyCart.style.display =
            "none";
    }


    let subtotal = 0;


    /* PRODUCTS */

    cart.forEach((product, index) => {

        const price =
            Number(product.price) || 0;

        const quantity =
            Math.max(
                1,
                Number(product.quantity) || 1
            );

        const productTotal =
            price * quantity;


        subtotal += productTotal;


        const item =
            document.createElement(
                "article"
            );


        item.className =
            "cart-product";


        item.innerHTML = `

            <div class="cart-product-image">

                <img
                    src="${escapeHTML(product.image)}"
                    alt="${escapeHTML(product.name)}">

            </div>

            <div class="cart-product-info">

                <span>
                    NOVERA / PRODUCT
                </span>

                <h2>
                    ${escapeHTML(product.name)}
                </h2>

                <p>
                    Size: ${escapeHTML(product.size)}
                </p>

                <p>
                    Color: ${escapeHTML(product.color)}
                </p>

                <strong>
                    ${price.toFixed(2)} BHD
                </strong>

            </div>

            <div class="cart-product-actions">

                <div class="cart-quantity">

                    <button
                        type="button"
                        data-action="decrease"
                        data-index="${index}">
                        −
                    </button>

                    <span>
                        ${quantity}
                    </span>

                    <button
                        type="button"
                        data-action="increase"
                        data-index="${index}">
                        +
                    </button>

                </div>

                <strong class="cart-product-total">
                    ${productTotal.toFixed(2)} BHD
                </strong>

                <button
                    type="button"
                    class="remove-product"
                    data-action="remove"
                    data-index="${index}">
                    REMOVE
                </button>

            </div>

        `;


        cartContainer.appendChild(item);

    });


    if (cartSubtotal) {

        cartSubtotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }


    if (cartTotal) {

        cartTotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }


    setupCartActions();

    setupCartCheckout();

}


/* ========================================
   CART ACTIONS
======================================== */

function setupCartActions() {

    const buttons =
        document.querySelectorAll(
            "#cart-items [data-action]"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const action =
                    button.dataset.action;

                const index =
                    Number(
                        button.dataset.index
                    );

                const cart =
                    getCart();


                if (
                    !Number.isInteger(index) ||
                    !cart[index]
                ) {
                    return;
                }


                if (action === "increase") {

                    cart[index].quantity =
                        Math.min(
                            Number(
                                cart[index].quantity
                            ) + 1,
                            20
                        );

                }


                if (action === "decrease") {

                    cart[index].quantity =
                        Math.max(
                            Number(
                                cart[index].quantity
                            ) - 1,
                            1
                        );

                }


                if (action === "remove") {

                    cart.splice(index, 1);

                }


                saveCart(cart);

                renderCart();

                updateCartCount();

            }
        );

    });

}


/* ========================================
   CART COUNT
======================================== */

function updateCartCount() {

    const cart =
        getCart();


    const totalQuantity =
        cart.reduce(
            (total, product) =>
                total +
                Math.max(
                    0,
                    Number(product.quantity) || 0
                ),
            0
        );


    const cartLinks =
        document.querySelectorAll(
            'a[href="cart.html"]'
        );


    cartLinks.forEach(link => {

        link.textContent =
            totalQuantity > 0
                ? `Cart (${totalQuantity})`
                : "Cart";

    });

}


/* ========================================
   CART CHECKOUT
======================================== */

function setupCartCheckout() {

    const checkoutButton =
        document.getElementById(
            "checkout-btn"
        );


    if (!checkoutButton) {
        return;
    }


    checkoutButton.onclick = () => {

        const cart =
            getCart();


        if (cart.length === 0) {

            alert(
                "Your cart is empty."
            );

            return;
        }


        window.location.href =
            "checkout.html";

    };

}


/* ========================================
   CHECKOUT PAGE
======================================== */

function setupCheckoutPage() {

    const checkoutItems =
        document.getElementById(
            "checkout-items"
        );


    if (!checkoutItems) {
        return;
    }


    renderCheckout();

}


/* ========================================
   RENDER CHECKOUT
======================================== */

function renderCheckout() {

    const checkoutItems =
        document.getElementById(
            "checkout-items"
        );

    const checkoutSubtotal =
        document.getElementById(
            "checkout-subtotal"
        );

    const checkoutTotal =
        document.getElementById(
            "checkout-total"
        );


    if (!checkoutItems) {
        return;
    }


    const cart =
        getCart();


    checkoutItems.innerHTML = "";


    if (cart.length === 0) {

        checkoutItems.innerHTML = `

            <div class="checkout-empty">

                <h3>
                    YOUR CART IS EMPTY
                </h3>

                <p>
                    Add a product before checkout.
                </p>

                <a href="collection.html">
                    EXPLORE COLLECTION
                </a>

            </div>

        `;


        if (checkoutSubtotal) {
            checkoutSubtotal.textContent =
                "0.00 BHD";
        }


        if (checkoutTotal) {
            checkoutTotal.textContent =
                "0.00 BHD";
        }


        return;
    }


    let subtotal = 0;


    cart.forEach(product => {

        const price =
            Number(product.price) || 0;

        const quantity =
            Math.max(
                1,
                Number(product.quantity) || 1
            );

        const productTotal =
            price * quantity;


        subtotal += productTotal;


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "checkout-item";


        item.innerHTML = `

            <img
                src="${escapeHTML(product.image)}"
                alt="${escapeHTML(product.name)}">

            <div class="checkout-item-info">

                <h3>
                    ${escapeHTML(product.name)}
                </h3>

                <p>
                    Size: ${escapeHTML(product.size)}
                </p>

                <p>
                    Color: ${escapeHTML(product.color)}
                </p>

                <p>
                    Quantity: ${quantity}
                </p>

                <strong>
                    ${productTotal.toFixed(2)} BHD
                </strong>

            </div>

        `;


        checkoutItems.appendChild(item);

    });


    if (checkoutSubtotal) {

        checkoutSubtotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }


    if (checkoutTotal) {

        checkoutTotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }


    setupCheckoutButton();

}


/* ========================================
   CHECKOUT BUTTON
======================================== */

function setupCheckoutButton() {

    const orderButton =
        document.getElementById(
            "place-order"
        );


    if (!orderButton) {
        return;
    }


    orderButton.onclick = () => {

        const cart =
            getCart();


        if (cart.length === 0) {

            alert(
                "Your cart is empty."
            );

            return;
        }


        const requiredFields = [

            "first-name",
            "last-name",
            "email",
            "phone",
            "address",
            "city"

        ];


        for (
            const fieldId
            of requiredFields
        ) {

            const field =
                document.getElementById(
                    fieldId
                );


            if (
                !field ||
                !field.value.trim()
            ) {

                alert(
                    "Please complete all required customer and shipping details."
                );


                field?.focus();

                return;
            }

        }


        const email =
            document.getElementById(
                "email"
            );


        if (
            email &&
            !isValidEmail(
                email.value.trim()
            )
        ) {

            alert(
                "Please enter a valid email address."
            );

            email.focus();

            return;
        }


        const customer = {

            firstName:
                getInputValue(
                    "first-name"
                ),

            lastName:
                getInputValue(
                    "last-name"
                ),

            email:
                getInputValue(
                    "email"
                ),

            phone:
                getInputValue(
                    "phone"
                ),

            address:
                getInputValue(
                    "address"
                ),

            city:
                getInputValue(
                    "city"
                ),

            postal:
                getInputValue(
                    "postal"
                ),

            notes:
                getInputValue(
                    "notes"
                )

        };


        localStorage.setItem(
            CUSTOMER_KEY,
            JSON.stringify(customer)
        );


        window.location.href =
            "payment.html";

    };

}


/* ========================================
   PAYMENT PAGE
======================================== */

function setupPaymentPage() {

    const paymentItems =
        document.getElementById(
            "payment-items"
        );


    if (!paymentItems) {
        return;
    }


    renderPayment();

    setupPaymentMethod();

    setupPayNow();

}


/* ========================================
   RENDER PAYMENT
======================================== */

function renderPayment() {

    const paymentItems =
        document.getElementById(
            "payment-items"
        );

    const paymentSubtotal =
        document.getElementById(
            "payment-subtotal"
        );

    const paymentTotal =
        document.getElementById(
            "payment-total"
        );


    if (!paymentItems) {
        return;
    }


    const cart =
        getCart();


    paymentItems.innerHTML = "";


    if (cart.length === 0) {

        paymentItems.innerHTML = `

            <div class="payment-empty">

                <h3>
                    YOUR CART IS EMPTY
                </h3>

                <p>
                    Please add a product before payment.
                </p>

                <a href="collection.html">
                    EXPLORE COLLECTION
                </a>

            </div>

        `;


        if (paymentSubtotal) {
            paymentSubtotal.textContent =
                "0.00 BHD";
        }


        if (paymentTotal) {
            paymentTotal.textContent =
                "0.00 BHD";
        }


        const payButton =
            document.getElementById(
                "pay-now-btn"
            );


        if (payButton) {
            payButton.disabled = true;
        }


        return;
    }


    let subtotal = 0;


    cart.forEach(product => {

        const price =
            Number(product.price) || 0;

        const quantity =
            Math.max(
                1,
                Number(product.quantity) || 1
            );

        const productTotal =
            price * quantity;


        subtotal += productTotal;


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "payment-item";


        item.innerHTML = `

            <img
                src="${escapeHTML(product.image)}"
                alt="${escapeHTML(product.name)}">

            <div class="payment-item-info">

                <h3>
                    ${escapeHTML(product.name)}
                </h3>

                <p>
                    Size: ${escapeHTML(product.size)}
                </p>

                <p>
                    Quantity: ${quantity}
                </p>

                <strong>
                    ${productTotal.toFixed(2)} BHD
                </strong>

            </div>

        `;


        paymentItems.appendChild(item);

    });


    if (paymentSubtotal) {

        paymentSubtotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }


    if (paymentTotal) {

        paymentTotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }

}


/* ========================================
   PAYMENT METHOD
======================================== */

function setupPaymentMethod() {

    const paymentOptions =
        document.querySelectorAll(
            'input[name="payment-method"]'
        );

    const cardArea =
        document.querySelector(
            ".card-payment-area"
        );


    if (!paymentOptions.length) {
        return;
    }


    function updatePaymentArea() {

        const selected =
            document.querySelector(
                'input[name="payment-method"]:checked'
            );


        if (!selected || !cardArea) {
            return;
        }


        cardArea.style.display =
            selected.value === "card"
                ? "block"
                : "none";

    }


    paymentOptions.forEach(option => {

        option.addEventListener(
            "change",
            updatePaymentArea
        );

    });


    updatePaymentArea();

}


/* ========================================
   PAY NOW
======================================== */

function setupPayNow() {

    const payButton =
        document.getElementById(
            "pay-now-btn"
        );


    if (!payButton) {
        return;
    }


    payButton.addEventListener(
        "click",
        () => {

            const cart =
                getCart();


            if (cart.length === 0) {

                alert(
                    "Your cart is empty."
                );

                return;
            }


            const selectedMethod =
                document.querySelector(
                    'input[name="payment-method"]:checked'
                );


            if (!selectedMethod) {

                alert(
                    "Please select a payment method."
                );

                return;
            }


            /*
             * IMPORTANT:
             *
             * This is still frontend-only.
             * No real card data is processed.
             *
             * Real payment processing will be
             * connected through a secure backend
             * and payment provider later.
             */

            alert(
                "Payment gateway is not connected yet. Your order is not charged."
            );

        }
    );

}


/* ========================================
   HELPERS
======================================== */

function getInputValue(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value.trim()
        : "";

}


function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}


function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* ========================================
   START APPLICATION
======================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupProductPage();

        setupCartPage();

        setupCheckoutPage();

        setupPaymentPage();

        updateCartCount();

    }
);