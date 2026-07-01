import type { Request, Response } from "express";
import { callLLM } from "../llm/anthropicClient.js";
import { computeImpact, zeroImpact } from "../impact/calculator.js";
import { record } from "../metrics/store.js";
import { embed, lookup, add } from "../middleware/semanticCache.js";
import { routePrompt } from "../middleware/router.js";
import { getMaxTokens } from "../middleware/payloadControl.js";
import { setImpactHeaders } from "../middleware/impactHeaders.js";

/**
 * Pipeline V2 — Mode responsable & logique frugale.
 *
 * Enchaîne les trois couches d'éco-conception :
 *   1. Cache sémantique  : un prompt (quasi) déjà vu court-circuite l'appel LLM.
 *   2. Routage frugal    : tâche simple => Haiku, tâche complexe => Sonnet.
 *   3. Troncature        : max_tokens strict en sortie.
 * Puis calcul d'impact, injection des headers et enregistrement des métriques.
 */
export async function responsibleProxyHandler(req: Request, res: Response): Promise<void> {
  const prompt = req.body?.prompt;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({ error: "Champ 'prompt' (string non vide) requis." });
    return;
  }

  try {
    // Embedding calculé une seule fois : sert au lookup ET au stockage sur MISS.
    const embedding = await embed(prompt);

    // --- Couche 1 : cache sémantique ---
    const cached = lookup(embedding);
    if (cached.hit && cached.entry) {
      // Aucun appel LLM => impact nul.
      const impact = zeroImpact();
      record({ mode: "v2", model: "cache", cacheHit: true, usage: { inputTokens: 0, outputTokens: 0 }, impact });
      setImpactHeaders(res, { impact, cacheHit: true, model: cached.entry.model });

      res.json({
        mode: "v2",
        cacheHit: true,
        similarity: Number(cached.similarity.toFixed(4)),
        model: cached.entry.model,
        response: cached.entry.response,
        usage: { inputTokens: 0, outputTokens: 0 },
        impact,
      });
      return;
    }

    // --- Couche 2 : routage frugal ---
    const routing = routePrompt(prompt);

    // --- Couche 3 : troncature du payload ---
    const maxTokens = getMaxTokens();

    const result = await callLLM({ prompt, model: routing.model, maxTokens });
    const impact = computeImpact(result.model, result.usage);

    // Stockage dans le cache pour les prochaines requêtes identiques/proches.
    add(embedding, {
      prompt,
      response: result.text,
      model: result.model,
      usage: result.usage,
    });

    record({ mode: "v2", model: result.model, cacheHit: false, usage: result.usage, impact });
    setImpactHeaders(res, { impact, cacheHit: false, model: result.model });

    res.json({
      mode: "v2",
      cacheHit: false,
      model: result.model,
      routing: routing.reason,
      simulated: result.simulated,
      response: result.text,
      usage: result.usage,
      impact,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    res.status(502).json({ error: "Echec du pipeline responsable", detail: message });
  }
}
