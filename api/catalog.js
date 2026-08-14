const PRODUCTS = Object.freeze([
  {
    id: "eclipse",
    sku: "NVR-ECL-001",
    name: "NOVERA Eclipse",
    price: 22,
    currency: "BHD",
    category: "Originals",
    sizes: ["S", "M", "L", "XL", "2XL"],
    status: "in-stock",
    image: "/images/novera-eclipse.svg"
  },
  {
    id: "atlas",
    sku: "NVR-ATL-002",
    name: "NOVERA Atlas",
    price: 24,
    currency: "BHD",
    category: "Performance",
    sizes: ["S", "M", "L", "XL", "2XL"],
    status: "in-stock",
    image: "/images/novera-atlas.svg"
  },
  {
    id: "velocity",
    sku: "NVR-VEL-003",
    name: "NOVERA Velocity",
    price: 22,
    currency: "BHD",
    category: "Heritage",
    sizes: ["S", "M", "L", "XL", "2XL"],
    status: "limited",
    image: "/images/novera-velocity.svg"
  }
]);

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  res.status(200).json({ products: PRODUCTS });
};
