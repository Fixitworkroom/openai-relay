import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";
import multer from "multer";

const app = express();

// НЕ парсим общий body — чтобы не ловить лимиты по JSON/RAW.
// Для JSON-эндпоинтов ниже подключим адресно.
app.disable('x-powered-by');

// Секреты релея
const SERVER_OPENAI_KEY = process.env.OPENAI_API_KEY; // ХРАНИТСЯ ТОЛЬКО НА RENDER!
const RELAY_TOKEN = process.env.RELAY_TOKEN;          // Клиентский маркер для проверки

if (!SERVER_OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY on relay");
  process.exit(1);
}
if (!RELAY_TOKEN) {
  console.error("Missing RELAY_TOKEN on relay");
  process.exit(1);
}

// Простая авторизация по токену
app.use((req, res, next) => {
  const auth = req.header("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== RELAY_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ====== /v1/files (UPLOAD) ======
// Принимаем файл либо как «сырые байты с метаданными», либо как multipart.
// Проще всего: Яндекс-функция передаёт нам имя и содержимое файла в multipart.
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // до 50 МБ

app.post("/v1/files", upload.single("file"), async (req, res) => {
  try {
    // Если файл пришёл мультипартом от функции:
    if (!req.file) {
      return res.status(400).json({ error: "file field is required (multipart/form-data)" });
    }
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "upload.bin",
      contentType: req.file.mimetype || "application/octet-stream"
    });
    // purpose обязателен для OpenAI Files API
    form.append("purpose", "assistants");

    const r = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVER_OPENAI_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });

    const text = await r.text();
    res.status(r.status).type(r.headers.get("content-type") || "application/json").send(text);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

// ====== /v1/responses (passthrough JSON) ======
app.use("/v1/responses", express.json({ limit: "2mb" }));
app.post("/v1/responses", async (req, res) => {
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVER_OPENAI_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body || {})
    });
    const text = await r.text();
    res.status(r.status).type(r.headers.get("content-type") || "application/json").send(text);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

// health
app.get("/", (_, res) => res.send("OK"));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Relay listening on ${port}`));
