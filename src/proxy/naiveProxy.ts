import type { Request, Response } from "express";
import { callLLM, MODELS } from "../llm/anthropicClient.js";
import { computeImpact } from "../impact/calculator.js";
import { record } from "../metrics/store.js";

/**
 * Limite de tokens en sortie du mode NAÏF (V1).
 * Volontairement élevée : le proxy naïf n'applique AUCUN contrôle de payload.
 */
const NAIVE_MAX_TOKENS = 4096;

/**
 * Pipeline V1 — Mode naïf & instrumentation.
 *
 * Aucune optimisation : pas de cache, pas de routage, pas de troncature.
 * Toutes les requêtes partent vers le gros modèle (Sonnet) avec un max_tokens élevé.
 */
export async function naiveProxyHandler(req: Request, res: Response): Promise<void> {
  const prompt = req.body?.prompt;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({ error: "Champ 'prompt' (string non vide) requis." });
    return;
  }

  try {
    const result = await callLLM({
      prompt,
      model: MODELS.SONNET,
      maxTokens: NAIVE_MAX_TOKENS,
    });

    const impact = computeImpact(result.model, result.usage);

    // Le mode naïf ne fait jamais de cache : cacheHit toujours false.
    record({
      mode: "v1",
      model: result.model,
      cacheHit: false,
      usage: result.usage,
      impact,
    });

    res.json({
      mode: "v1",
      model: result.model,
      simulated: result.simulated,
      cacheHit: false,
      response: result.text,
      usage: result.usage,
      impact,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    res.status(502).json({ error: "Echec de l'appel LLM", detail: message });
  }
}
