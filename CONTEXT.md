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

Interface que `WordMarkingSession` attend de son injection `verses`
(`getVerse`, `getVerseCount`, `indexOf`, `appendVerseOccurrence`,
`getOccurrenceInfo`) — sans jamais toucher au tableau brut elle-même.
Satisfaite aujourd'hui par une instance de **[[VerseTimeline]]** passée
directement au constructeur ; `word-marking-session.js` n'a jamais eu à
changer une ligne quand VerseTimeline a remplacé le fin wrapper
(`createArrayVerseCollaborator`) qui jouait ce rôle avant.

## VerseTimeline

Module profond (`verse-timeline.js`) qui possède tout le tableau
`verses[]` : plus aucune mutation (push/splice) n'a lieu ailleurs dans
`script.js`. Absorbe la création (`startVerse`, `endVerse`,
`appendVerseOccurrence`), la suppression avec cascade sur le verset
précédent (`deleteVerse`), l'édition de borne avec invalidation des mots
dépendants (`setBoundary`), le réordonnancement par glisser-déposer
(`reorder`, `canReorder`) et la sérialisation (`serializeVerse`).

Le tableau reste lisible depuis l'extérieur via `getVerses()` (même
référence, mutée en interne) : le rendu de la liste des versets continue
d'itérer dessus directement (`.forEach`/`.length`) — il a besoin de voir
chaque champ de chaque verset de toute façon. La profondeur de ce module
porte sur les mutations, pas sur le fait de cacher le tableau au rendu.
Dans `script.js`, `verses` est un `const` lié à `verseTimeline.getVerses()` :
la liaison elle-même interdit toute réaffectation, donc toute mutation
passe forcément par `verseTimeline`.

Née de la revue d'architecture du 2026-08-20 (candidat "VerseTimeline").
Dernier des 4 candidats de cette revue à être traité — voir aussi
[[WordMarkingSession]] et **timeSource** ci-dessous.

## timeSource

Petit objet local dans `script.js` (`now()`, `isReady()`, `seek(time)`) —
seul point de contact avec `audioPlayer.currentTime`/`.src`. Remplace 13+
lectures/écritures DOM dispersées et identiques. Ce n'est délibérément
**pas** un port injecté façon `WordMarkingSession`/collaborateur : aucun
consommateur actuel n'a besoin d'un faux adaptateur en test
(`WordMarkingSession` reçoit déjà `time` en paramètre plutôt que
`timeSource` lui-même), donc un simple objet suffit — inutile d'ajouter
une cérémonie d'injection de dépendance pour un seul appelant.
`.duration`/`.paused`/`.play()` restent hors périmètre, en accès DOM
direct.
