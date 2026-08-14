module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: "novera-store",
    environment: "production"
  });
};
