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

Un mot marqué a une **occurrence principale** (`words[i][0]`, chaîne avec
ses voisins à [[GAP]] près — la fin de l'un précède de justesse le début
du suivant, jamais pile le même instant) et, optionnellement, des
**occurrences supplémentaires** (`words[i][1+]`) : le cheikh redit ce mot
(ou une phrase de plusieurs mots à la suite) plus tard dans le même
passage, indépendamment du séquençage de l'occurrence principale.

## hasOverlappingWords

Fonction de `script.js` (pas dans WordMarkingSession/VerseTimeline — pur
calcul de présentation, appelé à chaque rendu de la liste) : vrai si deux
occurrences d'un même mot d'un verset se chevauchent (l'une contient
l'autre), presque toujours le signe d'une occurrence mal refermée plutôt
qu'un cas légitime. Bascule la bande de gauche du verset au orange
(`--warning-color`) au lieu du vert dans `updateVerseList` — purement
indicatif, aucune correction automatique. Même calcul que le détecteur
équivalent côté tafsir-app (`tools/normalize-timing-gaps.mjs`, lecture
seule lui aussi), qui liste tous les cas connus dans son
`docs/timing-overlaps.md`.

## GAP

Constante (`0.01`, en secondes) définie dans `verse-timeline.js` et
`word-marking-session.js` : l'écart volontaire laissé entre la fin d'un
verset/mot et le début du suivant, plutôt que de les accoler exactement
(`endTime[i] === startTime[i+1]`). Sans lui, le highlighter de tafsir-app
(intervalle fermé des deux côtés : `time >= start && time <= end`) matche
les deux voisins à l'instant exact de la frontière, ce qui peut faire
scintiller le surlignage pendant la lecture.

Toujours appliqué du côté qui se referme (l'`end`) quand un `start` est
l'instant directement observé (clic, `markWord`, `correctWord`,
`setWordTime(..., 'start', ...)`, chaînage d'occurrence) ; appliqué en
sens inverse (`+ GAP` sur le `start` voisin) quand c'est un `end` qui est
directement édité (`setWordTime(..., 'end', ...)`) — le champ édité
directement garde toujours l'instant observé tel quel, c'est le voisin
déplacé en cascade qui reçoit le décalage. Même valeur et même principe
que `tools/normalize-timing-gaps.mjs` côté tafsir-app, qui corrige après
coup les timings déjà collés à zéro dans `audios.ts`.

Née du retour terrain du 2026-09-14 : le scintillement du surlignage
mot-par-mot persistait après la normalisation ponctuelle côté tafsir-app
tant que cet outil continuait à produire de nouveaux timings à écart
zéro — GAP le rend structurel plutôt que correctif.

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

## data/existing-timings.js

Snapshot des timings déjà posés dans `audios.ts` (tafsir-app), versets ET
mots (`words`, au format `startTime`/`endTime` brut de audios.ts). Régénéré
par `sync-existing-timings.mjs` (`node sync-existing-timings.mjs
[chemin-vers-tafsir-app]`, défaut : `../tafsir-app`) plutôt que copié à la
main comme avant — à relancer après chaque session de marquage collée dans
`audios.ts` pour que la liste reste à jour.

"Charger" (renderExistingTimingsList dans script.js) reprend les mots tels
quels plutôt que de repartir de zéro — traduit `startTime`/`endTime` en
`start`/`end` (format interne) au passage. Permet de revoir/corriger un mot
précis d'un verset déjà entièrement marqué (ex. ceux que
[[hasOverlappingWords]] signale par la bande orange) sans tout re-marquer :
WordMarkingSession.open() gère déjà nativement un verset dont les mots sont
partiellement ou totalement posés (`wordViewIndex` démarre après le dernier
mot marqué), aucun changement nécessaire côté session.
