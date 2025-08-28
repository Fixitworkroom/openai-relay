// relay.js
import express from "express";
import cors from "cors";

const app = express();

// Настройки
const PORT = process.env.PORT || 3000;
const UPSTREAM = process.env.UPSTREAM || "https://api.openai.com/v1";
const FIXED_API_KEY = process.env.OPENAI_API_KEY || ""; // можно не задавать — тогда ждём Authorization от клиента

// Для JSON-запросов (responses и пр.)
app.use(express.json({ limit: "25mb" }));
// Для файлов — не парсим тело тут, просто проксируем как есть
app.use(cors());

// Health-check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Универсальный прокси для всего /v1/*
app.use("/v1", async (req, res) => {
  try {
    // Собираем URL апстрима
    const target = `${UPSTREAM}${req.originalUrl.replace(/^\/v1/, "")}`;

    // Заголовки: пробрасываем всё, но Authorization подставляем, если есть FIXED_API_KEY
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() === "host") continue;
      if (k.toLowerCase() === "content-length") continue;
      if (k.toLowerCase() === "authorization") continue; // перекроем ниже
      headers.set(k, Array.isArray(v) ? v.join(", ") : v ?? "");
    }
    if (FIXED_API_KEY) {
      headers.set("authorization", `Bearer ${FIXED_API_KEY}`);
    } else if (req.headers.authorization) {
      headers.set("authorization", req.headers.authorization);
    } else {
      return res.status(401).json({ error: "No Authorization and no OPENAI_API_KEY on server" });
    }

    // Важно: для multipart не трогаем body — читаем как stream
    const init = {
      method: req.method,
      headers,
      // node >=18: req — это ReadableStream совместимый с fetch
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req
    };

    const upstreamRes = await fetch(target, init);

    // Пробрасываем статус и заголовки
    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((v, k) => {
      // безопасные заголовки
      if (k.toLowerCase() === "transfer-encoding") return;
      res.setHeader(k, v);
    });

    // Отдаём поток тела, не буферизуя
    upstreamRes.body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Upstream error", details: String(err?.message || err) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Relay listening on http://0.0.0.0:${PORT} → ${UPSTREAM}`);
});
