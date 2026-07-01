import Anthropic from "@anthropic-ai/sdk";

/**
 * Identifiants des modèles Claude utilisés par le proxy.
 * - SONNET : gros modèle « lourd » (utilisé par défaut en mode naïf V1).
 * - HAIKU  : modèle « frugal » (utilisé par le routage V2 pour les tâches simples).
 */
export const MODELS = {
  SONNET: "claude-sonnet-4-6",
  HAIKU: "claude-haiku-4-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResult {
  text: string;
  model: ModelId;
  usage: LlmUsage;
  simulated: boolean;
}

export interface LlmCallParams {
  prompt: string;
  model: ModelId;
  maxTokens: number;
}

const SIMULATE = process.env.SIMULATE_LLM === "true";

// Client SDK instancié une seule fois (uniquement si on n'est pas en mode simulé).
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY manquante. Renseignez .env ou activez SIMULATE_LLM=true.",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Estimation déterministe du nombre de tokens (~1,3 token par mot).
 * Sert au mode simulé et de repli si l'API ne renvoyait pas d'usage.
 */
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 1.3));
}

/**
 * Réponse factice déterministe (mode simulé) : même prompt => même sortie.
 * La longueur de sortie est bornée par maxTokens, ce qui rend l'effet de la
 * troncature (Couche 3, V2) directement mesurable.
 */
function simulateCall(params: LlmCallParams): LlmResult {
  const { prompt, model, maxTokens } = params;
  // « Longueur naturelle » que le modèle produirait sans limite, dérivée du prompt.
  const naturalOutput = 200 + (estimateTokens(prompt) % 200); // 200-400 tokens
  const outputTokens = Math.min(maxTokens, naturalOutput);
  return {
    text: `[SIMULE] Reponse de ${model} au prompt : "${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`,
    model,
    usage: { inputTokens: estimateTokens(prompt), outputTokens },
    simulated: true,
  };
}

/**
 * Appelle un modèle Claude (ou renvoie une réponse simulée si SIMULATE_LLM=true).
 */
export async function callLLM(params: LlmCallParams): Promise<LlmResult> {
  if (SIMULATE) {
    return simulateCall(params);
  }

  const { prompt, model, maxTokens } = params;
  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return {
    text,
    model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
    simulated: false,
  };
}

export const isSimulated = (): boolean => SIMULATE;
