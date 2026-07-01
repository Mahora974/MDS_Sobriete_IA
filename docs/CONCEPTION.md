# CONCEPTION — Proxy d'éco-conception IA (Middleware & Sobriété IA mesurée)

> Document de conception à valider **avant** développement.
> Objectif : cadrer l'architecture, le modèle de mesure, le cache, le routage et le jeu de test.

---

## 1. Architecture applicative

```
                 ┌─────────────────────────────────────────────────────────┐
Client           │                    PROXY EXPRESS                         │
(script 100 req, │                                                          │
 navigateur,     │   POST /api/chat   ─────────────────────────────────►    │
 curl)           │        │                                                 │
     │           │        ▼   PIPELINE (V2 ; en V1 seules 3-4-5-6 actives)  │
     └──────────►│   1. Cache sémantique ──HIT──► réponse stockée (impact 0)│
                 │        │ MISS                                             │
                 │        ▼                                                  │
                 │   2. Analyse complexité → routage Haiku (simple)         │
                 │        │                          / Sonnet (complexe)     │
                 │        ▼                                                  │
                 │   3. Appel Claude (SDK Anthropic)                         │
                 │        │   V1: max_tokens élevé | V2: max_tokens tronqué  │
                 │        ▼                                                  │
                 │   4. Calcul d'impact (Wh, gCO₂e, mL)                      │
                 │   5. Injection headers X-Calculated-Impact-*              │
                 │   6. Log métriques (store mémoire)                        │
                 │                                                          │
                 │   GET /dashboard ─► synthèse V1 vs V2 + % économie        │
                 └─────────────────────────────────────────────────────────┘
```

**Endpoints**
| Méthode | Route | Rôle |
|--------|-------|------|
| `POST` | `/api/chat` | Proxy. Corps `{ "prompt": "...", "mode": "v1"\|"v2" }`. Réponse = texte LLM + headers d'impact. |
| `GET`  | `/api/metrics` | Export JSON des métriques cumulées (par mode). |
| `GET`  | `/dashboard` | Page HTML GreenOps (Avant/Après). |

**Arborescence prévue**
```
src/
  server.ts               # bootstrap Express
  proxy/
    naiveProxy.ts         # pipeline V1
    responsibleProxy.ts   # pipeline V2
  middleware/
    semanticCache.ts      # Couche 1
    router.ts             # Couche 2
    payloadControl.ts     # Couche 3
    impactHeaders.ts      # injection headers
  impact/
    factors.ts            # constantes (facteurs par modèle) ← § 2
    calculator.ts         # calcul Wh / gCO₂e / mL
  metrics/
    store.ts              # accumulation en mémoire
  llm/
    anthropicClient.ts    # wrapper SDK + mode simulé
data/
  prompts.json            # jeu de 100 prompts ← § 5
scripts/
  run-benchmark.ts        # simulateur de charge
reports/                  # impact-v1.json / impact-v2.json (générés)
public/
  dashboard.html
docs/
  CONCEPTION.md           # ce fichier
```

---

## 2. Modèle de mesure d'impact  ⚠️ *point clé à valider*

EcoLogits n'existe **qu'en Python** → on réimplémente sa **méthodologie** en TypeScript avec des
constantes documentées. Le calcul est **déterministe** (même entrée ⇒ même impact).

### Formules
```
énergie_Wh   = tokens_out × Wh_par_token(modèle)   (+ petite part fixe par requête)
énergie_kWh  = énergie_Wh / 1000
gCO₂e        = énergie_kWh × INTENSITE_CARBONE      (gCO₂e / kWh)
eau_mL       = énergie_kWh × WUE × 1000             (WUE en L / kWh → mL)
```
> On indexe l'énergie sur les **tokens de sortie** (principal levier de coût de l'inférence),
> ce qui rend la troncature (Couche 3) directement mesurable. Une part fixe par requête modélise
> le coût d'amorçage.

### Constantes proposées (à valider)
| Paramètre | Valeur proposée | Justification / source |
|-----------|----------------|------------------------|
| `Wh_par_token` — **Sonnet** (gros) | `0.0009` Wh/token | modèle lourd, ordre de grandeur EcoLogits classe « large ». |
| `Wh_par_token` — **Haiku** (frugal) | `0.00018` Wh/token | ~5× plus sobre que le gros modèle. |
| Part fixe / requête | `0.05` Wh | amorçage inférence. |
| `INTENSITE_CARBONE` | `418` gCO₂e/kWh | moyenne mix électrique mondial (ordre EcoLogits). |
| `WUE` | `1.8` L/kWh | Water Usage Effectiveness datacenter (donnée publique courante). |
| Cache HIT | impact = **0** | l'appel LLM est court-circuité. |

> Ces valeurs sont des **ordres de grandeur assumés** ; ce qui compte pour le CDC, c'est la
> **cohérence relative V1/V2** et la traçabilité. Toutes centralisées dans `impact/factors.ts`.
> ➡️ **À valider** : garde-t-on ces chiffres, ou tu veux des sources précises (Compar:IA) ?

---

## 3. Stratégie de cache sémantique  *(à valider)*

- **Embeddings locaux** via `@xenova/transformers`, modèle `Xenova/all-MiniLM-L6-v2`
  (384 dim, tourne en Node, aucun coût ni clé supplémentaire).
- **Similarité cosinus** entre l'embedding du prompt entrant et ceux déjà vus.
- **Seuil** par défaut `0.92` :
  - `≥ 0.92` → **HIT** : on renvoie la réponse stockée, impact = 0, header `X-Cache: HIT`.
  - `< 0.92` → **MISS** : appel LLM, puis on stocke `{embedding, prompt, réponse}`.
- Le **cache exact** (prompt identique) est un cas particulier (cosinus = 1.0) → couvert.
- **Store** : `Map` en mémoire (suffisant pour le MVP). Redis mentionné comme évolution.

➡️ **À valider** : seuil `0.92` (plus bas = plus de hits mais risque de fausses correspondances).

---

## 4. Logique de routage frugal  *(à valider)*

Analyse de complexité **heuristique** (pas d'appel LLM, donc gratuit) :

**→ Tâche SIMPLE (routée vers Haiku)** si l'un de ces critères :
- prompt court (`≤ 15 mots`), **ou**
- présence d'un mot-clé de tâche simple : `classe`, `classifie`, `corrige`, `résume`,
  `traduis`, `reformule`, `oui ou non`, `vrai ou faux`, `liste`, `extrais`.

**→ Tâche COMPLEXE (routée vers Sonnet)** sinon :
- prompt long, raisonnement, code, analyse, rédaction ouverte.

Headers ajoutés : `X-Model-Used: claude-haiku-4-5 | claude-sonnet-4-6`.

➡️ **À valider** : la liste de mots-clés et le seuil de 15 mots.

---

## 5. Jeu de test — 100 prompts  *(à valider)*

`data/prompts.json`, réparti pour garantir les KPIs :

| Catégorie | Part | Effet attendu |
|-----------|------|----------------|
| **Répétitifs** (prompts identiques ou quasi-identiques rejoués) | ~40 % | alimente le **cache** → ≥ 25 % de hits. |
| **Simples** (classification, correction, résumé court…) | ~35 % | routés **Haiku** + tronqués → forte baisse d'impact. |
| **Complexes** (analyse, code, rédaction) | ~25 % | routés **Sonnet**, tronqués. |

> Combinaison cache + routage Haiku + troncature ⇒ objectif **≥ 60 %** de réduction Wh/gCO₂e
> largement atteignable.

➡️ **À valider** : la répartition 40/35/25.

---

## Points de décision récapitulés (ton feu vert attendu)
1. Facteurs d'impact du § 2 (valeurs assumées vs sources précises).
2. Seuil de cache sémantique `0.92` (§ 3).
3. Règles de routage : mots-clés + seuil 15 mots (§ 4).
4. Répartition du jeu de 100 prompts 40/35/25 (§ 5).

Une fois ces 4 points validés → on démarre le **Sprint 1, point 1 (init projet)**, et je m'arrête
après chaque point pour validation.
