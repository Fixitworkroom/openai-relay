// relay.js
import express from "express";
import fetch from "node-fetch";

const app = express();

// не ставим app.use(express.json()) ДО /v1/files

app.get("/health", (_req, res) => res.json({ ok: true }));

// Проксируем multipart как есть в OpenAI Files
app.post("/v1/files", async (req, res) => {
  try {
    const upstream = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        // критично: пробросить исходный content-type с boundary
        "content-type": req.headers["content-type"],
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: req, // стрим напрямую
    });

    res.status(upstream.status);
    const text = await upstream.text();
    res.send(text);
  } catch (e) {
    console.error("Relay /v1/files error:", e);
    res.status(500).json({ error: { message: String(e) } });
  }
});

// все JSON-роуты — ниже, чтобы не сломать multipart
app.use(express.json({ limit: "5mb" }));
app.post("/echo", (req, res) => res.json(req.body));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Relay listening on ${port}`));
