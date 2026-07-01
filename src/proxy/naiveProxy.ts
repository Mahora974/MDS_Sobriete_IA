import type { Request, Response } from "express";
import { callLLM, MODELS } from "../llm/anthropicClient.js";
import { computeImpact } from "../impact/calculator.js";
import { record } from "../metrics/store.js";

/**
 * Limite de tokens en sortie du mode NAIF (V1).
 * Volontairement elevee : le proxy naif n'applique AUCUN controle de payload.
 */
const NAIVE_MAX_TOKENS = 4096;

/**
 * Pipeline V1 — Mode naif & instrumentation.
 *
 * Aucune optimisation : pas de cache, pas de routage, pas de troncature.
 * Toutes les requetes partent vers le gros modele (Sonnet) avec un max_tokens eleve.
 *
 * (La mesure d'impact et le store de metriques sont ajoutes aux points 3 et 4.)
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

    // Le mode naif ne fait jamais de cache : cacheHit toujours false.
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
