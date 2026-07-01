// Generateur deterministe du jeu de 100 prompts (data/prompts.json).
// Repartition : 40 repetitifs (8 bases x 5) + 35 simples + 25 complexes.
import { writeFileSync } from "node:fs";

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

const prompts = [];
let id = 1;
for (const p of repeatBase) {
  for (let k = 0; k < 5; k++) prompts.push({ id: id++, category: "repetitif", prompt: p });
}
for (const p of simple) prompts.push({ id: id++, category: "simple", prompt: p });
for (const p of complex) prompts.push({ id: id++, category: "complexe", prompt: p });

writeFileSync("data/prompts.json", JSON.stringify(prompts, null, 2) + "\n");

const counts = prompts.reduce((a, p) => ((a[p.category] = (a[p.category] || 0) + 1), a), {});
const uniq = new Set(prompts.map((p) => p.prompt)).size;
console.log(
  `Total: ${prompts.length} | ${JSON.stringify(counts)} | uniques: ${uniq} | doublons: ${prompts.length - uniq}`,
);
