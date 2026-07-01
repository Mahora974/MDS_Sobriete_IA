import { MODELS, type ModelId } from "../llm/anthropicClient.js";

/**
 * FACTEURS D'IMPACT ENVIRONNEMENTAL
 * =================================
 * EcoLogits n'existe qu'en Python : on reimplemente sa METHODOLOGIE avec des
 * constantes documentees. Le calcul est deterministe (meme entree => meme impact).
 *
 * Ces valeurs sont des ORDRES DE GRANDEUR assumes (classes de modeles EcoLogits,
 * moyennes publiques). Ce qui compte pour le CDC, c'est la coherence relative
 * V1/V2 et la tracabilite, pas une precision absolue.
 *
 * Toute la calibration se fait ICI : un seul fichier a ajuster.
 */

/** Energie consommee par token de SORTIE, selon le modele (Wh/token). */
export const WH_PER_OUTPUT_TOKEN: Record<ModelId, number> = {
  // Gros modele "lourd" : forte consommation par token.
  [MODELS.SONNET]: 0.0009,
  // Modele "frugal" : ~5x plus sobre que le gros modele.
  [MODELS.HAIKU]: 0.00018,
};

/** Cout fixe d'amorçage de l'inference, par requete (Wh). */
export const FIXED_WH_PER_REQUEST = 0.05;

/**
 * Intensite carbone de l'electricite du datacenter (gCO2e / kWh).
 * ~418 = ordre de grandeur du mix electrique mondial (donnee EcoLogits).
 */
export const CARBON_INTENSITY_G_PER_KWH = 418;

/**
 * WUE — Water Usage Effectiveness du datacenter (litres d'eau / kWh).
 * ~1.8 L/kWh = valeur publique courante pour un datacenter.
 */
export const WATER_WUE_L_PER_KWH = 1.8;
