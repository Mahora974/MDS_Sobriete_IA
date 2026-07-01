/**
 * Test manuel du cache sémantique (Sprint 2, point 1).
 * Vérifie : HIT sur prompt identique, HIT sur paraphrase proche, MISS sur sujet différent.
 *
 * Usage : npx tsx scripts/test-cache.ts
 */
import { embed, lookup, add, SIMILARITY_THRESHOLD, cacheSize } from "../src/middleware/semanticCache.js";
import { MODELS } from "../src/llm/anthropicClient.js";

async function check(label: string, prompt: string): Promise<void> {
  const e = await embed(prompt);
  const res = lookup(e);
  const verdict = res.hit ? "HIT " : "MISS";
  console.log(`  [${verdict}] sim=${res.similarity.toFixed(4)}  ${label}`);
}

async function main(): Promise<void> {
  console.log(`Seuil de similarité = ${SIMILARITY_THRESHOLD}\n`);

  // 1. On stocke un premier prompt (simule un MISS suivi d'un appel LLM).
  const original = "Quelle est la capitale de la France ?";
  const eOrig = await embed(original);
  add(eOrig, {
    prompt: original,
    response: "Paris.",
    model: MODELS.SONNET,
    usage: { inputTokens: 8, outputTokens: 3 },
  });
  console.log(`Stocké : "${original}"  (cache: ${cacheSize()} entrée)\n`);

  console.log("Recherches :");
  await check("identique", "Quelle est la capitale de la France ?");
  await check("paraphrase proche", "Quelle est la capitale francaise ?");
  await check("casse/ponctuation", "quelle est la capitale de la france");
  await check("sujet different", "Explique le fonctionnement d'un moteur diesel.");
}

main().catch((err) => {
  console.error("Echec du test cache :", err);
  process.exit(1);
});
