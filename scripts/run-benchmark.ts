/**
 * Simulateur de charge.
 *
 * Rejoue le jeu de 100 prompts à travers le proxy (mode v1 ou v2), puis compile
 * l'impact cumulé et écrit un rapport dans reports/impact-<mode>.json.
 *
 * Prérequis : le serveur doit tourner (npm run dev).
 *
 * Usage :
 *   npx tsx scripts/run-benchmark.ts --mode=v1
 *   npx tsx scripts/run-benchmark.ts --mode=v2   (Sprint 2)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import dotenv from "dotenv";

// Charge le .env pour lire le MÊME port que le serveur.
dotenv.config();

type Mode = "v1" | "v2";

interface PromptEntry {
  id: number;
  category: string;
  prompt: string;
}

const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1];
const mode: Mode = modeArg === "v2" ? "v2" : "v1";
const PORT = process.env.PORT ?? "3000";
const BASE = `http://localhost:${PORT}`;

/**
 * Vérifie que le serveur répond avant de lancer le benchmark, et affiche un
 * message clair sinon (plutôt qu'une stack ECONNREFUSED).
 */
async function ensureServerUp(): Promise<void> {
  try {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    console.error(
      `\nImpossible de joindre le serveur sur ${BASE}.\n` +
        `Demarre-le dans un autre terminal avec :  npm run dev\n` +
        `(et verifie que le PORT du .env correspond)\n`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const prompts: PromptEntry[] = JSON.parse(readFileSync("data/prompts.json", "utf-8"));
  console.log(`Benchmark mode=${mode} — ${prompts.length} requetes vers ${BASE}`);

  // 0. Le serveur doit tourner (le benchmark l'appelle via HTTP).
  await ensureServerUp();

  // 1. Remise à zéro des métriques du mode (et du cache pour un run V2 propre).
  await fetch(`${BASE}/api/metrics/reset?mode=${mode}`, { method: "POST" });
  if (mode === "v2") {
    await fetch(`${BASE}/api/cache/reset`, { method: "POST" });
  }

  // 2. Rejoue les prompts séquentiellement (ordre stable => cache reproductible).
  const start = Date.now();
  let ok = 0;
  for (const entry of prompts) {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: entry.prompt, mode }),
    });
    if (res.ok) ok += 1;
    else console.error(`  ! requete ${entry.id} echouee (HTTP ${res.status})`);
  }
  const elapsedMs = Date.now() - start;

  // 3. Récupère la synthèse cumulée côté serveur.
  const metrics = await fetch(`${BASE}/api/metrics`).then((r) => r.json());
  const summary = metrics[mode];

  // 4. Écrit le rapport.
  mkdirSync("reports", { recursive: true });
  const report = {
    mode,
    generatedAt: new Date().toISOString(),
    requestsSent: prompts.length,
    requestsOk: ok,
    elapsedMs,
    summary,
    comparison: mode === "v2" ? metrics.comparison : undefined,
  };
  const path = `reports/impact-${mode}.json`;
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n");

  // 5. Résumé console.
  console.log(`\n=== RAPPORT ${mode.toUpperCase()} ===`);
  console.log(`Requetes OK        : ${ok}/${prompts.length}  (${elapsedMs} ms)`);
  console.log(`Hits cache         : ${summary.cacheHits} (${(summary.cacheHitRate * 100).toFixed(1)}%)`);
  console.log(`Repartition modele : ${JSON.stringify(summary.byModel)}`);
  console.log(`Energie cumulee    : ${summary.totals.energyWh} Wh`);
  console.log(`GES cumules        : ${summary.totals.gCO2e} gCO2e`);
  console.log(`Eau cumulee        : ${summary.totals.waterMl} mL`);
  console.log(`Tokens sortie      : ${summary.totals.outputTokens}`);
  if (mode === "v2" && metrics.comparison) {
    console.log(`\n--- V1 -> V2 ---`);
    console.log(`Reduction energie  : ${metrics.comparison.energyReductionPct}%`);
    console.log(`Reduction GES      : ${metrics.comparison.co2ReductionPct}%`);
  }
  console.log(`\nRapport ecrit dans ${path}`);
}

main().catch((err) => {
  console.error("Echec du benchmark :", err);
  process.exit(1);
});
