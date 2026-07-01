# Plan — Middleware & Sobriété IA mesurée (Proxy d'éco-conception IA)

## Contexte

Projet M1 RSE (CDC2). Objectif : développer une **API Backend faisant office de proxy
d'éco-conception IA** qui intercepte les requêtes vers les LLM pour réduire leur empreinte
(énergie Wh, gCO₂e, eau mL). Deux sprints :

- **Sprint 1 — Mode naïf & instrumentation** : proxy qui transfère brut vers un LLM lourd,
  aucune optimisation, + mesure d'impact sur un jeu de 100 requêtes → *rapport d'impact brut (V1)*.
- **Sprint 2 — Mode responsable & logique frugale** : refactor avec 3 couches d'éco-conception
  (cache sémantique, routage frugal, troncature) + injection de headers d'impact + dashboard GreenOps.

**KPIs à prouver sur le même jeu de 100 requêtes (V2 vs V1)** :
- Taux de hit cache ≥ **25 %**
- Réduction énergie (Wh) et GES (gCO₂e) ≥ **60 %**

**Décisions de direction validées avec le client :**
- Backend : **Node.js + Express + TypeScript**
- LLM réel : **API Anthropic Claude** — gros modèle = `claude-sonnet-4-6`, modèle frugal = `claude-haiku-4-5`
- Cache : **sémantique** (embeddings + similarité cosinus)
- Restitution : **dashboard web léger servi par le backend**

---

## Phase 0 — CONCEPTION (à valider AVANT de coder)

Livrable : un doc d'architecture court (`docs/CONCEPTION.md`) + un schéma. Points à trancher/valider :

### 1. Architecture applicative
```
Client (script 100 req / navigateur / curl)
        │
        ▼
Express Proxy  ──►  Middleware pipeline
   POST /api/chat        1. (V2) Cache sémantique   ──hit──► réponse stockée (coût = 0)
                         2. (V2) Analyse complexité → routage Haiku / Sonnet
                         3. Appel Claude (SDK Anthropic)  [V1: max_tokens élevé | V2: tronqué]
                         4. Calcul d'impact (Wh, gCO₂e, mL)
                         5. Injection headers X-Calculated-Impact-*
                         6. Log métriques (store en mémoire)
        │
        ▼
GET /dashboard  ──►  synthèse cumulée Avant(V1) vs Après(V2) + % économie
```

### 2. Modèle de mesure d'impact (point clé — à valider)
EcoLogits est un **SDK Python uniquement** ; en Node on implémente un **modèle mathématique
basé sur sa méthodologie** (documenté et assumé) :
- `énergie_Wh = f(tokens_in, tokens_out, facteur_modèle)` — un facteur Wh/token plus élevé
  pour le gros modèle (Sonnet) que pour le frugal (Haiku).
- `gCO₂e = énergie_kWh × intensité_carbone_datacenter` (gCO₂e/kWh, ex. mix région configurable).
- `eau_mL = énergie_kWh × WUE` (Water Usage Effectiveness, L/kWh).
- Toutes les constantes centralisées dans `src/impact/factors.ts`, avec commentaires + sources
  (données EcoLogits / Compar:IA). **Reproductible** : même entrée → même impact.
- Décision à valider : valeurs exactes des facteurs par modèle (Sonnet vs Haiku vs cache=0).

### 3. Stratégie de cache sémantique (à valider)
- Embeddings **locaux** via `@xenova/transformers` (`all-MiniLM-L6-v2`) → aucun coût/clé
  supplémentaire, tourne en Node.
- Similarité **cosinus** ; seuil par défaut **0.92** (le cache exact est un cas particulier à 1.0).
- Store : `Map` en mémoire (option Redis documentée mais non requise pour le MVP).
- Un hit court-circuite totalement l'appel Claude → impact enregistré = **0**.

### 4. Logique de routage frugal (à valider)
- Analyse de complexité par **heuristiques** : longueur du prompt + mots-clés
  (`classe`, `corrige`, `résume`, `traduis`, `oui/non`…) → tâche simple → **Haiku**.
  Sinon → **Sonnet**. (Option bonus : classifieur léger.)
- Décision à valider : liste de règles/mots-clés et seuils.

### 5. Jeu de test des 100 prompts (à valider)
- `data/prompts.json` : ~40 % répétitifs (garantit ≥25 % hit), ~35 % simples, ~25 % complexes.
- La répétition + le routage + la troncature doivent suffire à dépasser 60 % de réduction.

> **Sortie de Phase 0** : je génère `docs/CONCEPTION.md` + un diagramme, tu valides, puis on code.

---

## Sprint 1 — Mode naïf & instrumentation

**But : proxy brut + mesure + rapport d'impact V1.**

1. **Init projet** : `npm init`, TypeScript, Express, `@anthropic-ai/sdk`, `dotenv`.
   Structure : `src/server.ts`, `src/proxy/`, `src/impact/`, `data/`, `scripts/`.
   `.env` avec `ANTHROPIC_API_KEY` (jamais commité).
2. **Endpoint proxy naïf** `POST /api/chat` : reçoit `{prompt}`, appelle **Sonnet 4.6** en dur
   via le SDK, `max_tokens` **élevé** (ex. 4096), **aucun** cache/filtre/troncature.
   Réponse = texte brut + usage tokens.
3. **Module d'impact** `src/impact/` : calcule Wh / gCO₂e / mL à partir des tokens réels
   (`response.usage`) et des facteurs de `factors.ts`.
4. **Store de métriques** `src/metrics/` : accumule par requête (mode, modèle, tokens, impact,
   cache hit) en mémoire, exportable JSON.
5. **Jeu de 100 prompts** `data/prompts.json` (répétitifs + simples + complexes).
6. **Simulateur de charge** `scripts/run-benchmark.ts` : rejoue les 100 prompts à travers le
   proxy, tague le run `V1`, compile et écrit `reports/impact-v1.json` (+ résumé console :
   Wh, gCO₂e, eau cumulés).

**Livrable intermédiaire** : rapport d'impact brut V1 (Wh, gCO₂e, mL cumulés).

**Fichiers clés** : `src/server.ts`, `src/proxy/naiveProxy.ts`, `src/impact/factors.ts`,
`src/impact/calculator.ts`, `src/metrics/store.ts`, `data/prompts.json`, `scripts/run-benchmark.ts`.

---

## Sprint 2 — Mode responsable & logique frugale

**But : refactor V2 avec 3 couches + headers + dashboard, prouver les KPIs.**

1. **Couche 1 — Cache sémantique** `src/middleware/semanticCache.ts` :
   embeddings locaux (`@xenova/transformers`), cosinus, seuil 0.92, store `Map`.
   Hit → réponse stockée immédiate, impact = 0, header cache=HIT.
2. **Couche 2 — Routage frugal** `src/middleware/router.ts` :
   analyse de complexité (heuristiques) → simple = **Haiku 4.5**, complexe = **Sonnet 4.6**.
3. **Couche 3 — Troncature** `src/middleware/payloadControl.ts` :
   `max_tokens` **strict** en sortie (ex. 256–512).
4. **Injection de headers** : middleware qui pose `X-Calculated-Impact-Wh` et
   `X-Calculated-Impact-gCO2e` (+ `X-Cache`, `X-Model-Used`) sur la réponse HTTP.
5. **Pipeline V2** : brancher les 3 couches sur `POST /api/chat` (mode `V2`), en réutilisant
   le module d'impact et le store du Sprint 1.
6. **Dashboard GreenOps** `GET /dashboard` : page HTML/JS légère servie par Express, affichant
   V1 vs V2 (Wh, gCO₂e, eau), **% d'économie**, taux de hit cache, répartition Haiku/Sonnet.
   (Bonus : économie € via tarifs Sonnet 1$/…/Haiku, pour illustrer le gain financier.)
7. **Re-run benchmark en V2** : `scripts/run-benchmark.ts --mode=v2` sur le **même** jeu →
   `reports/impact-v2.json`, comparaison automatique V1/V2.

**Fichiers clés** : `src/middleware/semanticCache.ts`, `src/middleware/router.ts`,
`src/middleware/payloadControl.ts`, `src/middleware/impactHeaders.ts`,
`src/proxy/responsibleProxy.ts`, `public/dashboard.html`, `src/routes/dashboard.ts`.

---

## Vérification (end-to-end)

1. `npm run dev` → serveur Express local up.
2. **Headers** : `curl -i -X POST localhost:3000/api/chat -d '{"prompt":"..."}'` →
   vérifier `X-Calculated-Impact-Wh` / `X-Calculated-Impact-gCO2e` présents.
3. **Cache** : rejouer un prompt identique → réponse quasi-instantanée, `X-Cache: HIT`, impact 0.
4. **Benchmark V1** puis **V2** sur les 100 prompts → générer les 2 rapports.
5. **KPIs** (script de comparaison) :
   - hit cache ≥ 25 % ✅
   - réduction Wh ≥ 60 % et gCO₂e ≥ 60 % ✅
6. **Dashboard** : ouvrir `localhost:3000/dashboard` → V1 vs V2 + % économie visibles.
7. **Revue de code** : commenter les algos de routage et de filtrage (attendu à la démo).

## Notes techniques
- Modèles Anthropic : `claude-sonnet-4-6` (lourd), `claude-haiku-4-5` (frugal). SDK `@anthropic-ai/sdk`.
- `max_tokens` : V1 élevé (naïf), V2 tronqué strict.
- Clé API via `.env` (non commitée) ; prévoir un mode « LLM simulé » de secours si quota/coût,
  activable par variable d'env, pour rejouer le benchmark sans consommer de crédits.
