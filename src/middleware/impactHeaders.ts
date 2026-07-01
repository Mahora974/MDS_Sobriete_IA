import type { Response } from "express";
import type { Impact } from "../impact/calculator.js";

/**
 * Injection dynamique de l'impact calculé dans les en-têtes de la réponse HTTP.
 *
 * Le middleware pose l'impact environnemental de la requête directement dans les
 * headers renvoyés au client, comme demandé par le cahier des charges :
 *   X-Calculated-Impact-Wh, X-Calculated-Impact-gCO2e
 * plus deux headers utiles pour la démo : X-Cache et X-Model-Used.
 */
export interface HeaderContext {
  impact: Impact;
  cacheHit: boolean;
  model: string;
}

export function setImpactHeaders(res: Response, ctx: HeaderContext): void {
  res.setHeader("X-Calculated-Impact-Wh", String(ctx.impact.energyWh));
  res.setHeader("X-Calculated-Impact-gCO2e", String(ctx.impact.gCO2e));
  res.setHeader("X-Calculated-Impact-WaterMl", String(ctx.impact.waterMl));
  res.setHeader("X-Cache", ctx.cacheHit ? "HIT" : "MISS");
  res.setHeader("X-Model-Used", ctx.model);
}
