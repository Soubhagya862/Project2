require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "NAVIGATE-X API",
    status: "running",
    gps: "denied",
    positioning: "VPS",
    message: "Backend foundation is ready."
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "navigate-x-backend" });
});

app.listen(PORT, () => {
  console.log(`NAVIGATE-X backend running on http://localhost:${PORT}`);
});
