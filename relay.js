// Минимальный relay на Express, проксирует /v1/* в api.openai.com/v1/*
// и всегда подставляет серверный OPENAI_API_KEY из .env

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";
import morgan from "morgan";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("tiny"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing in env");
  process.exit(1);
}

const target = "https://api.openai.com";

app.use(
  "/v1",
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { "^/v1": "/v1" },
    onProxyReq: (proxyReq, req, res) => {
      // Всегда принудительно подставляем наш серверный ключ
      proxyReq.setHeader("Authorization", `Bearer ${OPENAI_API_KEY}`);
      // Иногда полезно явно проставить json
      if (!proxyReq.getHeader("Content-Type")) {
        proxyReq.setHeader("Content-Type", "application/json");
      }
    },
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(502).json({ error: "proxy_error", detail: String(err?.message || err) });
    }
  })
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Relay is running on :${PORT}`);
});
