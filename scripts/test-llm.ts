/**
 * Diagnostic LLM — appels réels MINIMAUX (1 par modèle, max_tokens minuscule).
 * Objectif : isoler pourquoi les appels échouent (clé, id de modèle, réseau…)
 * sans rejouer les 100 prompts.
 *
 * Usage : npx tsx scripts/test-llm.ts
 */
import dotenv from "dotenv";
import { callLLM, MODELS, isSimulated } from "../src/llm/anthropicClient.js";

dotenv.config();

async function ping(label: string, model: string): Promise<void> {
  process.stdout.write(`\n[${label}] modèle="${model}" … `);
  try {
    const r = await callLLM({ prompt: "Réponds juste: OK", model: model as never, maxTokens: 16 });
    console.log("OK");
    console.log(`  réponse : ${JSON.stringify(r.text).slice(0, 120)}`);
    console.log(`  tokens  : in=${r.usage.inputTokens} out=${r.usage.outputTokens}`);
  } catch (err: unknown) {
    console.log("ÉCHEC");
    // Le SDK Anthropic expose status/error ; on affiche tout ce qui aide au diagnostic.
    const e = err as { status?: number; name?: string; message?: string; error?: unknown };
    console.log(`  status  : ${e.status ?? "(n/a)"}`);
    console.log(`  name    : ${e.name ?? "(n/a)"}`);
    console.log(`  message : ${e.message ?? String(err)}`);
    if (e.error) console.log(`  détail  : ${JSON.stringify(e.error)}`);
  }
}

async function main(): Promise<void> {
  console.log(`SIMULATE_LLM = ${isSimulated()}`);
  console.log(`Clé présente = ${Boolean(process.env.ANTHROPIC_API_KEY)} (longueur ${process.env.ANTHROPIC_API_KEY?.length ?? 0})`);

  if (isSimulated()) {
    console.log("\n⚠ Mode simulé actif : mets SIMULATE_LLM=false dans .env pour tester l'API réelle.");
  }

  await ping("HAIKU", MODELS.HAIKU);
  await ping("SONNET", MODELS.SONNET);
}

main().catch((err) => {
  console.error("Erreur inattendue :", err);
  process.exit(1);
});
