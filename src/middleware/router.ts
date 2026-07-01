import { MODELS, type ModelId } from "../llm/anthropicClient.js";

/**
 * COUCHE 2 — Routage dynamique frugal (Dynamic Routing).
 *
 * On analyse la complexité du prompt entrant :
 *  - tâche SIMPLE (classification, correction, traduction, résumé court, question
 *    factuelle…) => modèle léger et frugal (Haiku) ;
 *  - tâche COMPLEXE (analyse, rédaction, code, raisonnement) => gros modèle (Sonnet).
 *
 * L'analyse est purement heuristique (aucun appel LLM => gratuit et instantané).
 */

/** Seuil de longueur : en-dessous (et sans signal de complexité), prompt jugé simple. */
const SHORT_PROMPT_MAX_WORDS = 15;

/**
 * Mots-clés d'une tâche COMPLEXE (raisonnement, rédaction, code, analyse).
 * Priorité haute : réservent le gros modèle (Sonnet) même pour un prompt court,
 * car router une telle tâche vers le modèle frugal dégraderait la qualité.
 */
const COMPLEX_KEYWORDS = [
  "explique",
  "redige",
  "analyse",
  "compare",
  "concois",
  "ecris",
  "dissertation",
  "essai",
  "strategie",
  "algorithme",
  "implemente",
  "note de synthese",
  "cahier des charges",
];

/** Mots-clés déclenchant une tâche simple (routée vers le modèle frugal). */
const SIMPLE_KEYWORDS = [
  "classe",
  "classifie",
  "corrige",
  "resume",
  "traduis",
  "reformule",
  "liste",
  "extrais",
  "synonyme",
  "antonyme",
  "convertis",
  "oui ou non",
  "vrai ou faux",
  "capitale",
];

/** Résultat du routage. */
export interface RoutingDecision {
  model: ModelId;
  isSimple: boolean;
  reason: string;
}

/** Normalise (minuscules + suppression des accents) pour comparer les mots-clés. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Décide vers quel modèle router un prompt selon sa complexité estimée.
 * Une tâche est jugée SIMPLE si elle est courte OU contient un mot-clé simple.
 */
export function routePrompt(prompt: string): RoutingDecision {
  const normalized = normalize(prompt);
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;

  // 1. Signal de complexité prioritaire => gros modèle (qualité).
  const complexKeyword = COMPLEX_KEYWORDS.find((kw) => normalized.includes(kw));
  if (complexKeyword) {
    return { model: MODELS.SONNET, isSimple: false, reason: `mot-cle complexe "${complexKeyword}"` };
  }

  // 2. Mot-clé de tâche simple => modèle frugal.
  const simpleKeyword = SIMPLE_KEYWORDS.find((kw) => normalized.includes(kw));
  if (simpleKeyword) {
    return { model: MODELS.HAIKU, isSimple: true, reason: `mot-cle simple "${simpleKeyword}"` };
  }

  // 3. À défaut de mot-clé : prompt court => frugal, sinon gros modèle par prudence.
  if (wordCount <= SHORT_PROMPT_MAX_WORDS) {
    return { model: MODELS.HAIKU, isSimple: true, reason: `prompt court (${wordCount} mots)` };
  }
  return { model: MODELS.SONNET, isSimple: false, reason: `prompt long (${wordCount} mots)` };
}
