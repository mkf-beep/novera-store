/* NOVERA TEST PRODUCT CATALOG
   Temporary test catalog using original NOVERA concept artwork.
*/

const NOVERA_TEST_PRODUCTS = {
  eclipse: {
    id: "novera-eclipse",
    name: "NOVERA Eclipse",
    price: 22,
    color: "Graphite / Black",
    image: "images/novera-eclipse.svg",
    gallery: ["images/novera-eclipse.svg", "images/novera-eclipse.svg", "images/novera-eclipse.svg"],
    number: "001"
  },
  atlas: {
    id: "novera-atlas",
    name: "NOVERA Atlas",
    price: 24,
    color: "Stone / Forest",
    image: "images/novera-atlas.svg",
    gallery: ["images/novera-atlas.svg", "images/novera-atlas.svg", "images/novera-atlas.svg"],
    number: "002"
  },
  velocity: {
    id: "novera-velocity",
    name: "NOVERA Velocity",
    price: 22,
    color: "Burgundy / Gold",
    image: "images/novera-velocity.svg",
    gallery: ["images/novera-velocity.svg", "images/novera-velocity.svg", "images/novera-velocity.svg"],
    number: "003"
  }
};

function getTestProduct() {
  const key = new URLSearchParams(window.location.search).get("product") || "eclipse";
  return NOVERA_TEST_PRODUCTS[key] || NOVERA_TEST_PRODUCTS.eclipse;
}

function applyTestProduct(product) {
  const title = document.querySelector(".product-details h1");
  const price = document.querySelector(".product-price");
  const number = document.querySelector(".product-number");
  const galleryLabel = document.querySelector(".product-gallery-label");
  const description = document.querySelector(".product-description");
  const color = document.querySelector(".color-option + span") || document.querySelector(".option-header span");
  const mainImage = document.getElementById("mainProductImage");
  const payButton = document.getElementById("addToCart");

  if (title) title.textContent = product.name;
  if (price) price.textContent = `${product.price} BHD`;
  if (number) number.textContent = `NOVERA / NO. ${product.number}`;
  if (galleryLabel) galleryLabel.textContent = `NOVERA / ${product.number}`;
  if (description) description.textContent = "Original NOVERA football-culture jersey concept with breathable performance fabric, a relaxed modern silhouette and premium everyday detailing.";
  if (color) color.textContent = product.color;
  if (mainImage) {
    mainImage.src = product.image;
    mainImage.alt = `${product.name} front`;
  }
  if (payButton) payButton.textContent = `ADD TO CART — ${product.price} BHD`;

  document.title = `${product.name} — NOVERA`;

  document.querySelectorAll(".thumb").forEach((thumb, index) => {
    const image = product.gallery[index] || product.image;
    thumb.dataset.image = image;
    const img = thumb.querySelector("img");
    if (img) {
      img.src = image;
      img.alt = `${product.name} view ${index + 1}`;
    }
  });
}

function setupNoveraTestProductPage() {
  const product = getTestProduct();
  applyTestProduct(product);

  const cartButton = document.querySelector(".cart-btn");
  if (!cartButton) return;

  const sizeButtons = document.querySelectorAll(".size-option");
  const quantityDisplay = document.querySelector(".quantity-control span");
  const minusButton = document.querySelector(".quantity-control button:first-child");
  const plusButton = document.querySelector(".quantity-control button:last-child");
  let selectedSize = null;
  let quantity = 1;

  sizeButtons.forEach(button => button.addEventListener("click", () => {
    sizeButtons.forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    selectedSize = button.textContent.trim();
  }));

  plusButton?.addEventListener("click", () => {
    quantity = Math.min(quantity + 1, 20);
    if (quantityDisplay) quantityDisplay.textContent = quantity;
  });

  minusButton?.addEventListener("click", () => {
    quantity = Math.max(quantity - 1, 1);
    if (quantityDisplay) quantityDisplay.textContent = quantity;
  });

  cartButton.onclick = () => {
    if (!selectedSize) {
      alert("Please select a size.");
      return;
    }

    const cart = JSON.parse(localStorage.getItem("novera_cart") || "[]");
    const item = {
      id: product.id,
      name: product.name,
      price: product.price,
      size: selectedSize,
      color: product.color,
      quantity,
      image: product.image
    };

    const existing = cart.find(entry => entry.id === item.id && entry.size === item.size && entry.color === item.color);
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, 20);
    else cart.push(item);

    localStorage.setItem("novera_cart", JSON.stringify(cart));
    window.location.href = "cart.html";
  };
}

/* Remove stale test-cart entries that point at the retired product artwork. */
try {
  const cart = JSON.parse(localStorage.getItem("novera_cart") || "[]");
  const cleanCart = Array.isArray(cart)
    ? cart.filter(item => !String(item.image || "").match(/novera-(front|back|detail)\.png|images\/photo\.png/i))
    : [];
  localStorage.setItem("novera_cart", JSON.stringify(cleanCart));
} catch (_) {}

/* Override the old product-page initializer before DOMContentLoaded fires. */
window.setupProductPage = setupNoveraTestProductPage;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupNoveraTestProductPage, { once: true });
} else {
  setupNoveraTestProductPage();
}
