import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { naiveProxyHandler } from "./proxy/naiveProxy.js";
import { responsibleProxyHandler } from "./proxy/responsibleProxy.js";
import { summarizeAll, reset, type Mode } from "./metrics/store.js";
import { clearCache, warmup } from "./middleware/semanticCache.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3001);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Healthcheck — vérifie simplement que le serveur boote.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "proxy-eco-conception-ia", version: "0.1.0" });
});

// Proxy — dispatch selon le mode demandé dans le corps de la requête.
//   mode = "v2" => pipeline responsable (cache + routage + troncature)
//   sinon        => pipeline naïf (V1)
app.post("/api/chat", (req, res) => {
  if (req.body?.mode === "v2") {
    void responsibleProxyHandler(req, res);
  } else {
    void naiveProxyHandler(req, res);
  }
});

// Métriques cumulées (alimentent le simulateur de charge et le dashboard).
app.get("/api/metrics", (_req, res) => {
  res.json(summarizeAll());
});

// Remise à zéro des métriques (utilisée par le simulateur avant chaque run).
app.post("/api/metrics/reset", (req, res) => {
  const mode = req.query.mode as Mode | undefined;
  reset(mode);
  res.json({ status: "reset", mode: mode ?? "all" });
});

// Vide le cache sémantique (le simulateur l'appelle avant un run V2 propre).
app.post("/api/cache/reset", (_req, res) => {
  clearCache();
  res.json({ status: "cache-reset" });
});

// Dashboard GreenOps — page statique servie par le backend.
app.get("/dashboard", (_req, res) => {
  res.sendFile(join(__dirname, "..", "public", "dashboard.html"));
});

app.listen(PORT, () => {
  console.log(`Proxy d'eco-conception IA a l'ecoute sur http://localhost:${PORT}`);
  console.log(`Healthcheck : http://localhost:${PORT}/health`);
  console.log(`Dashboard   : http://localhost:${PORT}/dashboard`);
  // Pré-charge le modèle d'embeddings en tâche de fond (évite la latence au 1er appel).
  warmup()
    .then(() => console.log("Cache sémantique : modèle d'embeddings chargé."))
    .catch((err) => console.error("Warmup embeddings échoué :", err));
});
