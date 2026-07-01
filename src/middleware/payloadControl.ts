/**
 * COUCHE 3 — Troncature et contrôle du payload.
 *
 * On force une limite STRICTE sur le nombre de tokens générés en sortie
 * (max_tokens) pour éviter les réponses inutilement verbeuses et énergivores.
 *
 * Contraste avec le mode naïf (V1) qui laisse un budget élevé (4096) : ici on
 * plafonne agressivement, ce qui réduit directement l'énergie (indexée sur les
 * tokens de sortie).
 */

/** Limite stricte de tokens en sortie pour le mode responsable (V2). */
export const RESPONSIBLE_MAX_TOKENS = 256;

/**
 * Renvoie le plafond de tokens à appliquer en V2.
 * (Fonction plutôt qu'une constante nue pour pouvoir affiner par la suite,
 * ex. un plafond différent selon la complexité de la tâche.)
 */
export function getMaxTokens(): number {
  return RESPONSIBLE_MAX_TOKENS;
}
