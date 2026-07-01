# Middleware & Sobriété IA mesurée — Proxy d'éco-conception IA

Proxy backend qui intercepte les requêtes vers les LLM pour **mesurer et réduire** leur empreinte
environnementale (énergie, CO₂, eau), via trois leviers d'éco-conception logicielle : cache
sémantique, routage frugal et contrôle du payload.

> Projet M1 RSE (CDC2). Pilier RSE : environnemental — analyse du cycle de vie, performance
> énergétique et usage raisonné de l'IA.

---

## Sommaire

1. [Présentation du projet](#1-présentation-du-projet)
2. [Contexte et problématique](#2-contexte-et-problématique)
3. [Objectifs du projet](#3-objectifs-du-projet)
4. [Fonctionnement général](#4-fonctionnement-général)
5. [Modes de fonctionnement](#5-modes-de-fonctionnement)
6. [Mesure d'impact](#6-mesure-dimpact)
7. [Simulation de trafic](#7-simulation-de-trafic)
8. [Indicateurs de performance](#8-indicateurs-de-performance)
9. [Démonstration attendue](#9-démonstration-attendue)
10. [Installation et lancement](#10-installation-et-lancement)
11. [Organisation du projet](#11-organisation-du-projet)
12. [État d'avancement](#12-état-davancement)
13. [Améliorations possibles](#13-améliorations-possibles)

---

## 1. Présentation du projet

Une API backend (Node.js / Express / TypeScript) faisant office de **proxy d'éco-conception IA**.
Toute requête LLM passe par ce middleware, qui applique une stratégie de calcul raisonnée et
mesure, en temps réel, l'impact environnemental de chaque appel. Un jeu de test de 100 requêtes
permet de **prouver scientifiquement** le gain entre une gestion brute (V1) et le middleware
responsable (V2).

Modèles utilisés (API Anthropic Claude) :

- **Gros modèle** (lourd) : `claude-sonnet-4-6`
- **Modèle frugal** (léger) : `claude-haiku-4-5`

---

## 2. Contexte et problématique

À l'échelle individuelle, un prompt isolé semble immatériel. En usage industriel ou répété,
l'absence de cache, la longueur non contrôlée des réponses et le choix systématique de modèles
géants font exploser :

- la **consommation énergétique** (Wh) ;
- les **émissions carbone** (gCO₂e) ;
- la **consommation d'eau** des datacenters (mL) ;
- les **coûts financiers**.

La sobriété architecturale consiste à **instrumenter, mesurer et intercepter** les flux pour
appliquer une stratégie de calcul raisonnée.

---

## 3. Objectifs du projet

- Intercepter les requêtes destinées aux LLM via un proxy.
- Réduire l'impact environnemental (cache, routage frugal, troncature).
- Comparer un **mode naïf (V1)** et un **mode responsable (V2)** sur le même jeu de test.
- Mesurer et prouver les gains obtenus (Wh, gCO₂e, eau).

---

## 4. Fonctionnement général

```
Client ──► POST /api/chat ──► [ Cache sémantique ] ─HIT─► réponse stockée (impact = 0)
                                     │ MISS
                                     ▼
                              [ Routage frugal ] ── simple → Haiku / complexe → Sonnet
                                     ▼
                              [ Appel Claude ] (V2 : max_tokens tronqué)
                                     ▼
                              [ Calcul d'impact ] Wh · gCO₂e · mL
                                     ▼
                              [ Headers X-Calculated-Impact-* ] + store métriques
                                     ▼
                              Réponse HTTP au client

GET /dashboard ──► synthèse cumulée Avant (V1) vs Après (V2) + % d'économie
```

Schéma détaillé et choix de conception : [`docs/CONCEPTION.md`](docs/CONCEPTION.md).

---

## 5. Modes de fonctionnement

### Mode naïf (V1) — *Sprint 1, implémenté*

Aucune optimisation : tous les prompts partent tels quels vers le gros modèle (Sonnet), sans
cache, sans routage, avec un `max_tokens` élevé. Sert de **baseline** de référence.

### Mode responsable (V2) — *Sprint 2, à venir*

Trois couches d'éco-conception :

1. **Cache sémantique** — un prompt identique ou sémantiquement proche renvoie la réponse
   stockée, court-circuitant l'appel LLM (impact = 0).
2. **Routage frugal** — analyse de la complexité du prompt ; les tâches simples sont routées vers
   le modèle léger (Haiku), le gros modèle étant réservé aux requêtes complexes.
3. **Troncature du payload** — limite stricte sur le nombre de tokens générés (`max_tokens`).

Plus l'**injection de headers** d'impact dans la réponse HTTP.

---

## 6. Mesure d'impact

EcoLogits n'existant qu'en Python, l'impact est calculé via un **modèle mathématique** reprenant
sa méthodologie (constantes documentées et calibrables dans
[`src/impact/factors.ts`](src/impact/factors.ts)). Calcul **déterministe** :

```
énergie_Wh  = tokens_sortie × Wh_par_token(modèle) + part_fixe
énergie_kWh = énergie_Wh / 1000
gCO₂e       = énergie_kWh × intensité_carbone   (418 gCO₂e/kWh)
eau_mL      = énergie_kWh × WUE × 1000           (1,8 L/kWh)
```

Métriques suivies : **énergie (Wh)**, **émissions (gCO₂e)**, **eau (mL)**.

---

## 7. Simulation de trafic

Le jeu de test [`data/prompts.json`](data/prompts.json) contient **100 prompts** :

| Catégorie | Part | Rôle |
|-----------|------|------|
| Répétitifs | 40 % | alimentent le cache (32 doublons) |
| Simples | 35 % | routés vers le modèle frugal |
| Complexes | 25 % | routés vers le gros modèle |

Le simulateur [`scripts/run-benchmark.ts`](scripts/run-benchmark.ts) rejoue ces 100 requêtes à
travers le proxy et écrit un rapport dans `reports/impact-<mode>.json`.

---

## 8. Indicateurs de performance (KPIs)

Sur le même jeu de 100 requêtes, la V2 doit prouver :

- **Taux de hit du cache ≥ 25 %**
- **Réduction énergie (Wh) et GES (gCO₂e) ≥ 60 %** par rapport à la V1

---

## 9. Démonstration attendue

- **Dashboard GreenOps** : synthèse cumulée Avant (V1) vs Après (V2) — Wh, gCO₂e, eau, % d'économie.
- **Headers HTTP** : requête en direct montrant `X-Calculated-Impact-Wh` / `X-Calculated-Impact-gCO2e`.
- **Efficacité du cache** : un prompt répété renvoie une réponse instantanée à coût carbone nul.
- **Revue de code** : justification des algorithmes de routage et de filtrage.

---

## 10. Installation et lancement

### Prérequis

- Node.js 18+
- (Optionnel) une clé API Anthropic pour les appels réels

### Installation

```bash
npm install
cp .env.example .env      # puis renseigner ANTHROPIC_API_KEY si appels réels
```

### Variables d'environnement (`.env`)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Claude (requise si appels réels) |
| `PORT` | Port du serveur (défaut : 3000) |
| `SIMULATE_LLM` | `true` = réponses simulées déterministes, sans coût ni clé |

### Lancer le serveur

```bash
npm run dev        # démarrage avec rechargement (tsx watch)
```

Healthcheck : `GET http://localhost:3000/health`

### Rejouer le benchmark

```bash
# Serveur en cours d'exécution dans un autre terminal
npx tsx scripts/run-benchmark.ts --mode=v1
# (mode v2 disponible au Sprint 2)
```

Exemple d'appel manuel :

```bash
curl -i -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Résume ce texte en une phrase."}'
```

> Astuce : `SIMULATE_LLM=true` permet de tester toute la chaîne (endpoints, impact, benchmark,
> dashboard) sans consommer de crédits API.

---

## 11. Organisation du projet

```
src/
  server.ts              # bootstrap Express + routes
  proxy/
    naiveProxy.ts        # pipeline V1 (naïf)
    responsibleProxy.ts  # pipeline V2 (Sprint 2)
  middleware/            # cache, routage, troncature, headers (Sprint 2)
  impact/
    factors.ts           # constantes d'impact calibrables
    calculator.ts        # calcul Wh / gCO₂e / mL
  metrics/
    store.ts             # accumulation + synthèse des métriques
  llm/
    anthropicClient.ts   # wrapper SDK Anthropic (+ mode simulé)
data/
  prompts.json           # jeu de 100 prompts
scripts/
  gen-prompts.mjs        # générateur du jeu de prompts
  run-benchmark.ts       # simulateur de charge
reports/                 # rapports d'impact générés
public/                  # dashboard (Sprint 2)
docs/
  CONCEPTION.md          # architecture et choix de conception
```

### Endpoints

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/health` | Vérifie que le serveur répond |
| `POST` | `/api/chat` | Proxy LLM (`{ "prompt": "...", "mode": "v1"\|"v2" }`) |
| `GET` | `/api/metrics` | Synthèse cumulée V1/V2 + comparaison |
| `POST` | `/api/metrics/reset?mode=v1` | Remise à zéro des métriques |
| `GET` | `/dashboard` | Dashboard GreenOps *(Sprint 2)* |

---

## 12. État d'avancement

- ✅ **Phase 0 — Conception** : architecture, modèle d'impact, stratégie cache/routage validés
  ([`docs/CONCEPTION.md`](docs/CONCEPTION.md)).
- ✅ **Sprint 1 — Mode naïf & instrumentation** : proxy V1, module d'impact, store de métriques,
  jeu de 100 prompts, simulateur.
- ✅ **Sprint 2 — Mode responsable & logique frugale** : cache sémantique, routage frugal,
  troncature, injection de headers, dashboard GreenOps.

### Résultats (100 requêtes, mode simulé)

| | V1 (naïf) | V2 (responsable) | Réduction |
|---|---|---|---|
| Énergie | 104,67 Wh | 11,14 Wh | **−89,4 %** |
| GES | 43,75 gCO₂e | 4,66 gCO₂e | **−89,4 %** |
| Eau | 188,4 mL | 20,05 mL | **−89,4 %** |
| Répartition | 100 × Sonnet | 43 Haiku · 25 Sonnet · **32 cache** | |

- **Taux de hit cache : 32 %** (objectif ≥ 25 % ✅)
- **Réduction énergie & GES : 89 %** (objectif ≥ 60 % ✅)

> En mode simulé, le naïf émet des réponses volontairement verbeuses (longueur non contrôlée) ;
> les valeurs absolues changeront en mode réel, mais la mécanique de réduction est identique.

---

## 13. Améliorations possibles

- Cache distribué (Redis) au lieu du `Map` en mémoire.
- Classifieur de complexité plus fin pour le routage (au-delà des heuristiques).
- Calibration des facteurs d'impact sur des sources chiffrées (EcoLogits / Compar:IA).
- Persistance des métriques et historisation des runs.
- Estimation du gain financier (coût $ par modèle) en complément de l'impact environnemental.
