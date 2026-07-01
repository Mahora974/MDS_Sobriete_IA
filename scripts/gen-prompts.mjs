// Générateur déterministe du jeu de prompts (data/prompts.json).
// Taille paramétrable via --count=N (défaut 100). Répartition conservée :
// 40 % répétitifs (rejoués pour alimenter le cache) + 35 % simples + 25 % complexes.
import { writeFileSync } from "node:fs";

// prompts RÉPÉTITIFS -> alimentent le cache (chacun répété 5x)
const repeatBase = [
  'Classe cet avis comme positif ou negatif : "Livraison rapide, produit conforme."',
  'Traduis en anglais : "Bonjour, comment allez-vous aujourd\'hui ?"',
  'Corrige l\'orthographe : "Il fait tres beaux dehors aujourdhui."',
  'Resume en une phrase : "Le teletravail se generalise dans les entreprises."',
  "Quelle est la capitale de la France ?",
  'Donne un synonyme du mot "rapide".',
  "Convertis 100 kilometres en miles.",
  "Liste trois fruits de couleur rouge.",
];

// prompts SIMPLES -> routage frugal (Haiku)
const simple = [
  'Traduis en espagnol : "Merci beaucoup".',
  'Corrige la phrase : "Je vais au magasins demain."',
  'Classe ce message comme spam ou non : "Gagnez 1000 euros maintenant !"',
  'Resume en une phrase : "Les energies renouvelables progressent."',
  "Quelle est la capitale de l'Italie ?",
  'Donne l\'antonyme de "grand".',
  "Convertis 5 kilos en livres.",
  "Liste deux animaux marins.",
  'Traduis en anglais : "Bonne journee".',
  'Corrige : "nous avons manger a midi".',
  'Classe ce texte : sujet sport ou cuisine ? "Le match a dure 90 minutes."',
  'Resume : "La reunion est reportee a lundi prochain."',
  "Quelle est la capitale de l'Allemagne ?",
  'Donne un synonyme de "content".',
  "Convertis 30 degres Celsius en Fahrenheit.",
  "Liste trois couleurs primaires.",
  'Traduis en anglais : "Je ne comprends pas."',
  'Corrige : "il ont fini leur travail".',
  "Vrai ou faux : la Terre tourne autour du Soleil ?",
  'Resume en une phrase : "Le nouveau logiciel ameliore la productivite."',
  "Quelle est la capitale de l'Espagne ?",
  'Donne l\'antonyme de "rapide".',
  "Convertis 10 miles en kilometres.",
  "Liste deux planetes du systeme solaire.",
  'Traduis en italien : "Bonjour".',
  'Corrige : "ces livres sont a moi, se sont les miens".',
  'Classe cet avis : positif ou negatif ? "Service client decevant."',
  'Resume : "Le budget annuel a ete valide par le conseil."',
  "Quelle est la capitale du Portugal ?",
  'Donne un synonyme de "important".',
  "Convertis 2 heures en minutes.",
  "Liste trois metiers du numerique.",
  "Vrai ou faux : l'eau bout a 100 degres au niveau de la mer ?",
  'Traduis en anglais : "A bientot".',
  'Corrige : "la voiture rouge sont rapide".',
];

// prompts COMPLEXES -> gros modèle (Sonnet)
const complex = [
  "Explique en detail le fonctionnement d'un reseau de neurones convolutif.",
  "Redige une dissertation argumentee sur l'impact du numerique sur l'environnement.",
  "Ecris une fonction Python qui detecte si une chaine est un palindrome, avec tests.",
  "Analyse les avantages et inconvenients du teletravail pour une PME.",
  "Compare l'architecture monolithique et microservices avec exemples concrets.",
  "Explique la theorie de la relativite restreinte a un etudiant de lycee.",
  "Redige un plan de projet detaille pour lancer une application mobile.",
  "Ecris un algorithme de tri fusion en JavaScript et explique sa complexite.",
  "Analyse les causes economiques de l'inflation et propose des leviers d'action.",
  "Explique le principe du chiffrement asymetrique RSA etape par etape.",
  "Redige un essai sur l'ethique de l'intelligence artificielle generative.",
  "Concois un schema de base de donnees relationnelle pour une bibliotheque.",
  "Explique les differences entre apprentissage supervise et non supervise avec exemples.",
  "Redige une analyse SWOT complete pour une startup de mobilite electrique.",
  "Ecris une classe TypeScript implementant une file de priorite avec commentaires.",
  "Analyse l'impact environnemental du cycle de vie d'un smartphone.",
  "Explique le theoreme central limite et son importance en statistiques.",
  "Redige une strategie de sobriete numerique pour une entreprise de 200 personnes.",
  "Compare trois strategies de mise en cache et leurs cas d'usage.",
  "Explique comment fonctionne le protocole HTTPS de bout en bout.",
  "Redige un cahier des charges fonctionnel pour un site e-commerce.",
  "Analyse les enjeux de la souverainete des donnees dans le cloud.",
  "Ecris un script qui calcule l'empreinte carbone d'un trajet, avec explications.",
  "Explique les principes SOLID de la conception orientee objet avec exemples.",
  "Redige une note de synthese sur les modeles de langage et leur cout energetique.",
];

// Nombre total de prompts visé, paramétrable :  node scripts/gen-prompts.mjs --count=30
// (défaut 100). La répartition 40 % répétitifs / 35 % simples / 25 % complexes est
// préservée quelle que soit la taille, de même qu'un taux de doublons suffisant pour
// garantir le KPI « hit cache >= 25 % ».
const countArg = process.argv.find((a) => a.startsWith("--count="))?.split("=")[1];
const count = Math.max(6, Number(countArg) || 100);

const nRep = Math.round(count * 0.4);
const nSimple = Math.round(count * 0.35);
const nComplex = count - nRep - nSimple;

// Répétitifs : on répartit nRep sur un nombre de bases distinctes tel que chaque base
// soit rejouée ~4-5 fois (=> doublons = nRep - basesUtilisées, donc du cache à revendre).
const basesToUse = Math.min(repeatBase.length, Math.max(2, Math.floor(nRep / 4)));
const perBase = Math.floor(nRep / basesToUse);
const extra = nRep - perBase * basesToUse; // répétitions résiduelles à saupoudrer

// Construit les trois groupes séparément…
const repetitif = [];
for (let b = 0; b < basesToUse; b++) {
  const times = perBase + (b < extra ? 1 : 0);
  for (let k = 0; k < times; k++) repetitif.push({ category: "repetitif", prompt: repeatBase[b] });
}
const simples = simple.slice(0, nSimple).map((p) => ({ category: "simple", prompt: p }));
const complexes = complex.slice(0, nComplex).map((p) => ({ category: "complexe", prompt: p }));

/**
 * …puis les entrelace proportionnellement (round-robin par plus faible ratio émis/total).
 * Objectif : n'IMPORTE quel préfixe des N premiers prompts reste représentatif de la
 * répartition 40/35/25 — indispensable pour que le curseur de volume du dashboard
 * (1..100) donne un run cohérent quel que soit N. Les copies d'un même prompt répétitif
 * restent dans l'ordre, donc les doublons se répartissent au fil de la séquence (=> cache).
 */
function interleave(groups) {
  const idx = groups.map(() => 0);
  const total = groups.reduce((s, g) => s + g.length, 0);
  const out = [];
  for (let n = 0; n < total; n++) {
    let best = -1;
    let bestScore = Infinity;
    for (let g = 0; g < groups.length; g++) {
      if (idx[g] >= groups[g].length) continue;
      const score = idx[g] / groups[g].length; // avancement relatif du groupe
      if (score < bestScore) {
        bestScore = score;
        best = g;
      }
    }
    out.push(groups[best][idx[best]]);
    idx[best]++;
  }
  return out;
}

const prompts = interleave([repetitif, simples, complexes]).map((p, i) => ({ id: i + 1, ...p }));

writeFileSync("data/prompts.json", JSON.stringify(prompts, null, 2) + "\n");

const counts = prompts.reduce((a, p) => ((a[p.category] = (a[p.category] || 0) + 1), a), {});
const uniq = new Set(prompts.map((p) => p.prompt)).size;
const expectedHits = prompts.length - uniq; // 1er passage d'un prompt = MISS, suivants = HIT
console.log(
  `Total: ${prompts.length} | ${JSON.stringify(counts)} | uniques: ${uniq} | doublons: ${expectedHits} ` +
    `(hit cache attendu ~${((expectedHits / prompts.length) * 100).toFixed(1)}%)`,
);
