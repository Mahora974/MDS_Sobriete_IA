import type { LlmUsage, ModelId } from "../llm/anthropicClient.js";
import type { Impact } from "../impact/calculator.js";

export type Mode = "v1" | "v2";

/** Une entrée de métrique = une requête traitée par le proxy. */
export interface MetricRecord {
  mode: Mode;
  model: ModelId | "cache";
  cacheHit: boolean;
  usage: LlmUsage;
  impact: Impact;
}

/** Synthèse cumulée pour un mode donné. */
export interface MetricsSummary {
  mode: Mode;
  requests: number;
  cacheHits: number;
  cacheHitRate: number; // 0..1
  totals: {
    energyWh: number;
    gCO2e: number;
    waterMl: number;
    inputTokens: number;
    outputTokens: number;
  };
  /** Répartition du nombre de requêtes par modèle (ou « cache »). */
  byModel: Record<string, number>;
}

// Store en mémoire : un tableau d'enregistrements par mode.
const records: Record<Mode, MetricRecord[]> = { v1: [], v2: [] };

function round(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Enregistre une requête traitée. */
export function record(entry: MetricRecord): void {
  records[entry.mode].push(entry);
}

/** Vide les métriques d'un mode (ou de tous si non précisé). */
export function reset(mode?: Mode): void {
  if (mode) {
    records[mode] = [];
  } else {
    records.v1 = [];
    records.v2 = [];
  }
}

/** Calcule la synthèse cumulée d'un mode. */
export function summarize(mode: Mode): MetricsSummary {
  const list = records[mode];
  const totals = { energyWh: 0, gCO2e: 0, waterMl: 0, inputTokens: 0, outputTokens: 0 };
  const byModel: Record<string, number> = {};
  let cacheHits = 0;

  for (const r of list) {
    totals.energyWh += r.impact.energyWh;
    totals.gCO2e += r.impact.gCO2e;
    totals.waterMl += r.impact.waterMl;
    totals.inputTokens += r.usage.inputTokens;
    totals.outputTokens += r.usage.outputTokens;
    if (r.cacheHit) cacheHits += 1;
    byModel[r.model] = (byModel[r.model] ?? 0) + 1;
  }

  return {
    mode,
    requests: list.length,
    cacheHits,
    cacheHitRate: list.length > 0 ? round(cacheHits / list.length, 4) : 0,
    totals: {
      energyWh: round(totals.energyWh),
      gCO2e: round(totals.gCO2e),
      waterMl: round(totals.waterMl),
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
    },
    byModel,
  };
}

/** Synthèse des deux modes + comparaison V1 -> V2 (% de réduction). */
export function summarizeAll() {
  const v1 = summarize("v1");
  const v2 = summarize("v2");

  // La comparaison n'a de sens que si les DEUX modes ont tourné : sinon un mode
  // vide (totaux à 0) serait interprété comme « 100 % de réduction » (faux positif).
  const comparable = v1.requests > 0 && v2.requests > 0;

  const reduction = (before: number, after: number): number =>
    comparable && before > 0 ? round((1 - after / before) * 100, 2) : 0;

  return {
    v1,
    v2,
    comparison: {
      energyReductionPct: reduction(v1.totals.energyWh, v2.totals.energyWh),
      co2ReductionPct: reduction(v1.totals.gCO2e, v2.totals.gCO2e),
      waterReductionPct: reduction(v1.totals.waterMl, v2.totals.waterMl),
      cacheHitRatePct: round(v2.cacheHitRate * 100, 2),
    },
  };
}
