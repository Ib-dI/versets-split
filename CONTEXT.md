# Vocabulaire du domaine — versets-split

Application vanilla JS/HTML/CSS (sans build, sans framework) pour découper
l'audio d'un tafsir en timings de versets puis, verset par verset, en
timings de mots (utilisés par tafsir-app pour surligner mot à mot pendant
la lecture).

## Verset (verse)

Un segment audio `{ id, start, end, words }` où `id` est le numéro du
verset dans la sourate. Plusieurs entrées de `verses[]` peuvent partager le
même `id` — voir **occurrence de verset**.

## Occurrence de verset (verse occurrence)

Le cheikh répète parfois un verset entier plus loin dans le même passage
audio. Chaque répétition est une entrée distincte de `verses[]` avec le
même `id` mais son propre `start`/`end`/`words`. `getOccurrenceInfo`
identifie la position d'une occurrence parmi ses sœurs (ex. "occurrence
2/3") pour ne pas les confondre en marquant les mots.

## Mot (word) / occurrence de mot

Un mot marqué a une **occurrence principale** (`words[i][0]`, chaîne
contiguë avec ses voisins — la fin de l'un est le début du suivant) et,
optionnellement, des **occurrences supplémentaires** (`words[i][1+]`) : le
cheikh redit ce mot (ou une phrase de plusieurs mots à la suite) plus tard
dans le même passage, indépendamment du séquençage de l'occurrence
principale.

## [[WordMarkingSession]]

Module profond (`word-marking-session.js`) qui possède tout l'état d'une
session de marquage de mots : quel verset est ouvert, quel mot est affiché,
quelle occurrence supplémentaire est en cours, quelle nouvelle occurrence
de verset est en attente, et le verrou anti-clic-réflexe du marquage de
mots. Interface en résultats structurés (`{ ok, reason? }`) plutôt qu'en
`window.confirm` direct ou exceptions — voir `word-marking-session.js` pour
le détail des méthodes et invariants.

Née de la revue d'architecture du 2026-08-20 (candidat "Approfondir le
mode mots en module WordMarkingSession") : avant, cinq variables
`let`-scopées et onze handlers DOM dispersés dans `script.js`
recopiaient chacun leurs propres gardes, avec au moins une fuite réelle
(le bouton "Mots" de la liste des versets ouvrait un nouveau verset sans
jamais vérifier qu'une occurrence n'était pas encore ouverte sur le
précédent).

## Collaborateur verses (verse collaborator)

Dépendance injectée dans `WordMarkingSession` (voir
`createArrayVerseCollaborator` dans `word-marking-session.js`) : le petit
ensemble d'opérations sur `verses[]` dont la session a besoin
(`getVerse`, `indexOf`, `appendVerseOccurrence`, `getOccurrenceInfo`),
sans jamais toucher au tableau brut elle-même. Aujourd'hui c'est un fin
wrapper autour du tableau `verses` de `script.js` ; le jour où
**[[VerseTimeline]]** existe, il remplace ce wrapper sans que
`WordMarkingSession` change.

## VerseTimeline *(pas encore construit)*

Candidat identifié par la revue d'architecture du 2026-08-20 mais non
implémenté : un module profond qui possèderait `verses[]` et absorberait
les opérations aujourd'hui dispersées dans `script.js` (suppression avec
cascade sur le verset précédent, édition de borne avec invalidation des
mots dépendants, réordonnancement par glisser-déposer, sérialisation).
Voir le rapport de revue pour le détail.
