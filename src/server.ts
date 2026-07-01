import express from "express";
import dotenv from "dotenv";
import { naiveProxyHandler } from "./proxy/naiveProxy.js";
import { summarizeAll, reset, type Mode } from "./metrics/store.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3000);

// Healthcheck — verifie simplement que le serveur boote.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "proxy-eco-conception-ia", version: "0.1.0" });
});

// Proxy — pour l'instant seul le mode naif (V1) est branche.
// Le pipeline responsable (V2) sera ajoute au Sprint 2.
app.post("/api/chat", naiveProxyHandler);

// Metriques cumulees (alimentent le simulateur de charge et le futur dashboard).
app.get("/api/metrics", (_req, res) => {
  res.json(summarizeAll());
});

// Remise a zero des metriques (utilisee par le simulateur avant chaque run).
app.post("/api/metrics/reset", (req, res) => {
  const mode = req.query.mode as Mode | undefined;
  reset(mode);
  res.json({ status: "reset", mode: mode ?? "all" });
});

app.listen(PORT, () => {
  console.log(`Proxy d'eco-conception IA a l'ecoute sur http://localhost:${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
});
