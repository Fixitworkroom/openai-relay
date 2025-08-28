const express = require("express");

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;           // ключ OpenAI
const OPENAI_BASE = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";

// CORS (на всякий случай)
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

// health
app.get("/", (_, res) => res.json({ ok: true }));

// простое проксирование /v1/* -> OpenAI /v1/*
app.all("/v1/*", async (req, res) => {
  try {
    const path = req.originalUrl.replace(/^\/v1/, "");
    const url = `${OPENAI_BASE}${path}`;
    const r = await fetch(url, {
      method: req.method,
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": req.get("content-type") || "application/json"
      },
      body: ["GET","HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body)
    });

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e) {
    res.status(500).json({ error: { message: e.message }});
  }
});

app.listen(PORT, () => {
  console.log(`Relay listening on :${PORT}`);
});
