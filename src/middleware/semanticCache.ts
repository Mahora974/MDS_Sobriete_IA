import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import type { LlmUsage, ModelId } from "../llm/anthropicClient.js";

/**
 * COUCHE 1 — Cache sémantique (Exact / Semantic Caching).
 *
 * Si un prompt identique OU sémantiquement très proche a déjà été traité, on
 * renvoie la réponse stockée en mémoire, court-circuitant totalement l'appel LLM
 * (impact = 0). Le cache exact est un cas particulier (similarité = 1,0).
 *
 * Fonctionnement :
 *  - chaque prompt est transformé en vecteur (embedding) via un modèle local
 *    (all-MiniLM-L6-v2, tourne dans Node, sans clé ni coût réseau) ;
 *  - on compare le vecteur entrant aux vecteurs déjà stockés par similarité
 *    cosinus ; au-dessus du seuil => HIT.
 */

/** Seuil de similarité cosinus au-dessus duquel deux prompts sont considérés équivalents. */
export const SIMILARITY_THRESHOLD = 0.92;

/** Nom du modèle d'embeddings local (téléchargé/caché au premier usage). */
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

/** Ce qu'on mémorise pour chaque prompt traité. */
export interface CacheEntry {
  prompt: string;
  response: string;
  model: ModelId;
  usage: LlmUsage;
}

/** Entrée du store, avec son vecteur associé. */
interface StoredEntry extends CacheEntry {
  embedding: number[];
}

/** Résultat d'une recherche dans le cache. */
export interface CacheLookup {
  hit: boolean;
  similarity: number;
  entry?: CacheEntry;
}

// Store en mémoire (Map/tableau natif). Une instance locale Redis serait une évolution.
const store: StoredEntry[] = [];

// Pipeline d'extraction de features, chargé une seule fois (paresseux).
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  return extractorPromise;
}

/**
 * Calcule l'embedding d'un texte (vecteur normalisé de dimension 384).
 * `normalize: true` => vecteurs unitaires, donc cosinus = simple produit scalaire.
 */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/** Produit scalaire de deux vecteurs unitaires = similarité cosinus. */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Cherche l'entrée la plus proche du vecteur donné.
 * Renvoie un HIT si la meilleure similarité atteint le seuil.
 */
export function lookup(embedding: number[]): CacheLookup {
  let best: StoredEntry | undefined;
  let bestSim = -1;

  for (const entry of store) {
    const sim = cosineSimilarity(embedding, entry.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      best = entry;
    }
  }

  if (best && bestSim >= SIMILARITY_THRESHOLD) {
    return { hit: true, similarity: bestSim, entry: best };
  }
  return { hit: false, similarity: bestSim < 0 ? 0 : bestSim };
}

/** Ajoute une entrée au cache (appelée sur un MISS, après l'appel LLM). */
export function add(embedding: number[], entry: CacheEntry): void {
  store.push({ ...entry, embedding });
}

/** Vide le cache (utile entre deux runs de benchmark). */
export function clearCache(): void {
  store.length = 0;
}

/** Nombre d'entrées actuellement en cache. */
export function cacheSize(): number {
  return store.length;
}

/** Pré-charge le modèle d'embeddings (évite la latence au premier appel). */
export async function warmup(): Promise<void> {
  await getExtractor();
}
