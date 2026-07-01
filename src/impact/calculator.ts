import type { LlmUsage, ModelId } from "../llm/anthropicClient.js";
import {
  WH_PER_OUTPUT_TOKEN,
  FIXED_WH_PER_REQUEST,
  CARBON_INTENSITY_G_PER_KWH,
  WATER_WUE_L_PER_KWH,
} from "./factors.js";

/** Impact environnemental d'une requête. */
export interface Impact {
  /** Énergie consommée (Wh). */
  energyWh: number;
  /** Émissions de gaz à effet de serre (grammes équivalent CO2). */
  gCO2e: number;
  /** Eau consommée (millilitres). */
  waterMl: number;
}

/** Arrondi à n décimales pour des sorties lisibles. */
function round(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Calcule l'impact d'une requête à partir du modèle utilisé et de l'usage tokens.
 *
 *   energie_Wh  = tokens_sortie * Wh_par_token(modele) + part_fixe
 *   energie_kWh = energie_Wh / 1000
 *   gCO2e       = energie_kWh * intensite_carbone
 *   eau_mL      = energie_kWh * WUE * 1000
 *
 * L'énergie est indexée sur les tokens de SORTIE (principal levier de coût de
 * l'inférence), ce qui rend la troncature (Couche 3, V2) directement mesurable.
 */
export function computeImpact(model: ModelId, usage: LlmUsage): Impact {
  const energyWh = usage.outputTokens * WH_PER_OUTPUT_TOKEN[model] + FIXED_WH_PER_REQUEST;
  const energyKwh = energyWh / 1000;

  return {
    energyWh: round(energyWh),
    gCO2e: round(energyKwh * CARBON_INTENSITY_G_PER_KWH),
    waterMl: round(energyKwh * WATER_WUE_L_PER_KWH * 1000),
  };
}

/**
 * Impact nul — utilisé lorsqu'une requête est résolue par le cache (Couche 1, V2) :
 * aucun appel LLM => aucune consommation.
 */
export function zeroImpact(): Impact {
  return { energyWh: 0, gCO2e: 0, waterMl: 0 };
}
