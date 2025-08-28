import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// /v1/files — проксируем multipart-запрос (файлы)
app.post("/v1/files", async (req, res) => {
  const resp = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: req, // передаём поток как есть
  });
  res.status(resp.status);
  resp.body.pipe(res);
});

// /v1/responses — проксируем JSON-запросы
app.use(express.json({ limit: "50mb" }));
app.post("/v1/responses", async (req, res) => {
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(req.body)
  });
  res.status(resp.status);
  resp.body.pipe(res);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Relay listening on port ${port}`));
