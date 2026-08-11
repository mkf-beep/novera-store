/* ========================================
   NOVERA STORE
   CART SYSTEM
======================================== */

const CART_KEY = "novera_cart";


/* ========================================
   CART STORAGE
======================================== */

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (error) {
        console.error("Unable to load cart:", error);
        return [];
    }
}


function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}


/* ========================================
   PRODUCT PAGE
======================================== */

function setupProductPage() {

    const cartButton = document.querySelector(".cart-btn");

    if (!cartButton) {
        return;
    }

    const sizeButtons = document.querySelectorAll(".size-option");
    const quantityDisplay = document.querySelector(".quantity-control span");

    const minusButton = document.querySelector(
        ".quantity-control button:first-child"
    );

    const plusButton = document.querySelector(
        ".quantity-control button:last-child"
    );


    let selectedSize = null;
    let quantity = 1;


    /* -------------------------
       SIZE SELECTION
    ------------------------- */

    sizeButtons.forEach(button => {

        button.addEventListener("click", () => {

            sizeButtons.forEach(item => {
                item.classList.remove("selected");
            });

            button.classList.add("selected");

            selectedSize = button.textContent.trim();

        });

    });


    /* -------------------------
       QUANTITY
    ------------------------- */

    if (plusButton) {

        plusButton.addEventListener("click", () => {

            quantity++;

            quantityDisplay.textContent = quantity;

        });

    }


    if (minusButton) {

        minusButton.addEventListener("click", () => {

            if (quantity > 1) {

                quantity--;

                quantityDisplay.textContent = quantity;

            }

        });

    }


    /* -------------------------
       ADD TO CART
    ------------------------- */

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


        const existingProduct = cart.find(item =>
            item.id === product.id &&
            item.size === product.size &&
            item.color === product.color
        );


        if (existingProduct) {

            existingProduct.quantity += product.quantity;

        } else {

            cart.push(product);

        }


        saveCart(cart);


        window.location.href = "cart.html";

    });

}


/* ========================================
   CART PAGE
======================================== */

function setupCartPage() {

    const cartContainer = document.getElementById("cart-items");

    if (!cartContainer) {
        return;
    }


    renderCart();

}


/* ========================================
   RENDER CART
======================================== */

function renderCart() {

    const cartContainer = document.getElementById("cart-items");

    const emptyCart = document.getElementById("cart-empty");

    const cartSubtotal = document.getElementById("cart-subtotal");

    const cartTotal = document.getElementById("cart-total");


    if (!cartContainer) {
        return;
    }


    const cart = getCart();


    cartContainer.innerHTML = "";


    /* -------------------------
       EMPTY CART
    ------------------------- */

    if (cart.length === 0) {

        if (emptyCart) {
            emptyCart.style.display = "block";
        }

        if (cartSubtotal) {
            cartSubtotal.textContent = "0 BHD";
        }

        if (cartTotal) {
            cartTotal.textContent = "0 BHD";
        }

        return;

    }


    if (emptyCart) {
        emptyCart.style.display = "none";
    }


    let subtotal = 0;


    /* -------------------------
       PRODUCTS
    ------------------------- */

    cart.forEach((product, index) => {

        const productTotal =
            product.price * product.quantity;

        subtotal += productTotal;


        const item = document.createElement("article");

        item.className = "cart-product";


        item.innerHTML = `

            <div class="cart-product-image">

                <img
                    src="${product.image}"
                    alt="${product.name}">

            </div>


            <div class="cart-product-info">

                <span>NOVERA / PRODUCT</span>

                <h2>
                    ${product.name}
                </h2>

                <p>
                    Size: ${product.size}
                </p>

                <p>
                    Color: ${product.color}
                </p>

                <strong>
                    ${product.price.toFixed(2)} BHD
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
                        ${product.quantity}
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


    /* -------------------------
       TOTALS
    ------------------------- */

    if (cartSubtotal) {

        cartSubtotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }


    if (cartTotal) {

        cartTotal.textContent =
            `${subtotal.toFixed(2)} BHD`;

    }


    setupCartActions();

}


/* ========================================
   CART ACTIONS
======================================== */

function setupCartActions() {

    const buttons = document.querySelectorAll(
        "[data-action]"
    );


    buttons.forEach(button => {

        button.addEventListener("click", () => {

            const action =
                button.dataset.action;

            const index =
                Number(button.dataset.index);


            const cart = getCart();


            if (!cart[index]) {
                return;
            }


            /* -------------------------
               INCREASE
            ------------------------- */

            if (action === "increase") {

                cart[index].quantity++;

            }


            /* -------------------------
               DECREASE
            ------------------------- */

            if (action === "decrease") {

                if (cart[index].quantity > 1) {

                    cart[index].quantity--;

                }

            }


            /* -------------------------
               REMOVE
            ------------------------- */

            if (action === "remove") {

                cart.splice(index, 1);

            }


            saveCart(cart);

            renderCart();

        });

    });

}


/* ========================================
   CART COUNT
======================================== */

function updateCartCount() {

    const cart = getCart();

    const totalQuantity = cart.reduce(
        (total, product) =>
            total + product.quantity,
        0
    );


    const cartLinks =
        document.querySelectorAll(
            'a[href="cart.html"]'
        );


    cartLinks.forEach(link => {

        if (totalQuantity > 0) {

            link.textContent =
                `Cart (${totalQuantity})`;

        } else {

            link.textContent = "Cart";

        }

    });

}


/* ========================================
   START APPLICATION
======================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupProductPage();

        setupCartPage();

        updateCartCount();

    }
);