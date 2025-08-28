import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const OPENAI_API = "https://api.openai.com"; // целевой API
const app = express();

app.use(cors());

// ВАЖНО: никакого body-parser ДО этого маршрута!
// Проксирование multipart/form-data как есть
app.post("/v1/files", async (req, res) => {
  try {
    // Пробрасываем исходные заголовки контента
    const contentType = req.headers["content-type"];
    const contentLength = req.headers["content-length"];

    const resp = await fetch(`${OPENAI_API}/v1/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(contentLength ? { "Content-Length": contentLength } : {}),
      },
      // Тело — исходный поток запроса (multipart)
      body: req,
    });

    res.status(resp.status);
    // Проксируем тело ответа как поток
    resp.body.pipe(res);
  } catch (err) {
    console.error("FILES proxy error:", err);
    res.status(502).json({
      error: {
        message: `Relay error on /v1/files: ${err.message || err}`,
        type: "relay_error",
      },
    });
  }
});

// Ниже можно подключать JSON-парсер для остальных эндпоинтов
app.use(express.json({ limit: "50mb" }));

// Проксирование Responses API (JSON)
app.post("/v1/responses", async (req, res) => {
  try {
    const resp = await fetch(`${OPENAI_API}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    res.status(resp.status);
    resp.body.pipe(res);
  } catch (err) {
    console.error("RESPONSES proxy error:", err);
    res.status(502).json({
      error: {
        message: `Relay error on /v1/responses: ${err.message || err}`,
        type: "relay_error",
      },
    });
  }
});

// Простой healthcheck
app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Relay listening on ${port}`));
