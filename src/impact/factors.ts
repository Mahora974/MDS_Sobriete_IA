import { MODELS, type ModelId } from "../llm/anthropicClient.js";

/**
 * FACTEURS D'IMPACT ENVIRONNEMENTAL
 * =================================
 * EcoLogits n'existe qu'en Python : on réimplémente sa MÉTHODOLOGIE avec des
 * constantes documentées. Le calcul est déterministe (même entrée => même impact).
 *
 * Ces valeurs sont des ORDRES DE GRANDEUR assumés (classes de modèles EcoLogits,
 * moyennes publiques). Ce qui compte pour le CDC, c'est la cohérence relative
 * V1/V2 et la traçabilité, pas une précision absolue.
 *
 * Toute la calibration se fait ICI : un seul fichier à ajuster.
 */

/** Énergie consommée par token de SORTIE, selon le modèle (Wh/token). */
export const WH_PER_OUTPUT_TOKEN: Record<ModelId, number> = {
  // Gros modèle « lourd » : forte consommation par token.
  [MODELS.SONNET]: 0.0009,
  // Modèle « frugal » : ~5x plus sobre que le gros modèle.
  [MODELS.HAIKU]: 0.00018,
};

/** Coût fixe d'amorçage de l'inférence, par requête (Wh). */
export const FIXED_WH_PER_REQUEST = 0.05;

/**
 * Intensité carbone de l'électricité du datacenter (gCO2e / kWh).
 * ~418 = ordre de grandeur du mix électrique mondial (donnée EcoLogits).
 */
export const CARBON_INTENSITY_G_PER_KWH = 418;

/**
 * WUE — Water Usage Effectiveness du datacenter (litres d'eau / kWh).
 * ~1,8 L/kWh = valeur publique courante pour un datacenter.
 */
export const WATER_WUE_L_PER_KWH = 1.8;
