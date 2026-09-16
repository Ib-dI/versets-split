import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WordMarkingSession, createArrayVerseCollaborator } from './word-marking-session.js';

// Verset à 3 mots pour la plupart des scénarios.
const WORDS = { 1: ['أ', 'ب', 'ج'], 2: ['د', 'ه', 'و'] };
function wordList(verseId) {
    return WORDS[verseId];
}

function makeSession(verses) {
    const collaborator = createArrayVerseCollaborator(() => verses);
    return new WordMarkingSession({ verses: collaborator, wordList });
}

function openVerse(overrides = {}) {
    const verses = [{ id: 1, start: 0, end: 30, words: [], ...overrides }];
    const session = makeSession(verses);
    session.open(0);
    return { session, verses };
}

test('open refuse un verset sans données de mots', () => {
    const verses = [{ id: 99, start: 0, end: 10, words: [] }];
    const session = makeSession(verses);
    const result = session.open(0);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not-markable');
});

test('open refuse un verset pas encore borné (end === null)', () => {
    const verses = [{ id: 1, start: 0, end: null, words: [] }];
    const session = makeSession(verses);
    const result = session.open(0);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not-markable');
});

test('open réussi renvoie le temps de seek et ouvre la session', () => {
    const verses = [{ id: 1, start: 5, end: 30, words: [] }];
    const session = makeSession(verses);
    const result = session.open(0);
    assert.equal(result.ok, true);
    assert.equal(result.seekTime, 5);
    assert.equal(result.verseId, 1);
    assert.equal(session.isOpen(), true);
    assert.equal(session.getCurrentIndex(), 0);
});

test('markWord enchaîne les mots sans blanc et cale le dernier sur verse.end', () => {
    const { session, verses } = openVerse();

    let r = session.markWord(1.0);
    assert.equal(r.ok, true);
    assert.equal(r.allWordsMarked, false);
    assert.deepEqual(verses[0].words[0][0], { start: 1.0, end: null });

    r = session.markWord(2.0);
    assert.equal(verses[0].words[0][0].end, 1.99); // mot précédent refermé (GAP avant 2.0)
    assert.equal(verses[0].words[1][0].start, 2.0);

    r = session.markWord(3.0);
    assert.equal(r.allWordsMarked, true);
    assert.deepEqual(verses[0].words[2][0], { start: 3.0, end: 30 }); // fin calée sur verse.end
});

test('markWord refuse au-delà du dernier mot', () => {
    const { session } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(3); // 3 mots, tous marqués
    const r = session.markWord(4);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'all-words-marked');
});

test('markWord est bloqué par le verrou anti-clic-réflexe (bug corrigé : markWordBtn ne le vérifiait pas)', () => {
    const { session } = openVerse();
    session.setWordMarkingLocked(true);
    const r = session.markWord(1);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'locked');
});

test('correctWord recale le début et déplace la fin du mot précédent', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.setViewIndex(1);

    const r = session.correctWord(2.5);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[1][0].start, 2.5);
    assert.equal(verses[0].words[0][0].end, 2.49);
});

test('terminateWord ferme la principale ouverte du mot affiché', () => {
    const { session, verses } = openVerse();
    session.markWord(1); // mot 0 ouvert (end: null), viewIndex avance sur l'emplacement suivant
    session.setViewIndex(0); // revient voir le mot 0 pour le terminer
    const r = session.terminateWord(1.8);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][0].end, 1.8);
});

test('setWordTime(start) déplace la fin du mot précédent (édition depuis la liste, pas forcément le mot affiché)', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.setViewIndex(0); // le mot affiché n'est PAS celui qu'on édite

    const r = session.setWordTime(1, 'start', 2.5);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[1][0].start, 2.5);
    assert.equal(verses[0].words[0][0].end, 2.49);
});

test('setWordTime(start) sur le premier mot ne touche à rien d\'autre (pas de mot précédent)', () => {
    const { session, verses } = openVerse();
    session.markWord(1);

    const r = session.setWordTime(0, 'start', 0.5);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][0].start, 0.5);
});

test('setWordTime(end) déplace le début du mot suivant', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(15); // 3 mots marqués, tous fermés (dernier calé sur verse.end)

    const r = session.setWordTime(0, 'end', 1.5);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][0].end, 1.5);
    assert.equal(verses[0].words[1][0].start, 1.51);
});

test('setWordTime(end) sur le dernier mot se découple de verse.end', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(15); // dernier mot calé sur verse.end (30) par défaut

    const r = session.setWordTime(2, 'end', 25);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[2][0].end, 25);
    assert.equal(verses[0].end, 30); // verse.end inchangé
});

test('setWordTime refuse un index hors des mots déjà marqués', () => {
    const { session } = openVerse();
    session.markWord(1);
    const r = session.setWordTime(5, 'start', 1);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-word-at-index');
});

test('setExtraOccurrenceTime édite une occurrence par (wordIndex, extraIndex) sans toucher aux voisines', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(15);

    session.setViewIndex(0);
    session.toggleExtraOccurrence(10); // ouvre une occurrence sur le mot 0
    session.toggleExtraOccurrence(10.5); // la referme

    const r = session.setExtraOccurrenceTime(0, 0, 'start', 12);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][1].start, 12);
    assert.equal(verses[0].words[0][1].end, 10.5); // fin de cette occurrence inchangée
    assert.equal(verses[0].words[0][0].end, 1.99); // principale du mot 0 inchangée (pas de chaînage)
});

test('setExtraOccurrenceTime refuse une occurrence inexistante', () => {
    const { session } = openVerse();
    session.markWord(1);
    const r = session.setExtraOccurrenceTime(0, 0, 'start', 1);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-occurrence-at-index');
});

test('describe() expose verseStart/verseEnd du verset en cours de marquage', () => {
    const { session } = openVerse();
    const snap = session.describe();
    assert.equal(snap.verseStart, 0);
    assert.equal(snap.verseEnd, 30);
});

test('undoWord retire le dernier mot et rouvre le précédent', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    assert.equal(verses[0].words.length, 2);

    const r = session.undoWord();
    assert.equal(r.ok, true);
    assert.equal(verses[0].words.length, 1);
    assert.equal(verses[0].words[0][0].end, null); // rouvert
});

test('undoWord signale quand il n\'y a rien à annuler', () => {
    const { session } = openVerse();
    const r = session.undoWord();
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'nothing-to-undo');
});

test('toggleExtraOccurrence refuse si la principale du mot est encore ouverte', () => {
    const { session } = openVerse();
    session.markWord(1); // mot 0 : principale ouverte
    session.setViewIndex(0);
    const r = session.toggleExtraOccurrence(5);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'primary-open');
});

test('toggleExtraOccurrence ouvre puis referme une occurrence supplémentaire', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2); // referme la principale du mot 0

    session.setViewIndex(0);
    let r = session.toggleExtraOccurrence(10);
    assert.equal(r.ok, true);
    assert.equal(r.action, 'opened');
    assert.equal(verses[0].words[0].length, 2);
    assert.equal(verses[0].words[0][1].end, null);

    r = session.toggleExtraOccurrence(10.5);
    assert.equal(r.action, 'closed');
    assert.equal(verses[0].words[0][1].end, 10.5);
});

test('toggleExtraOccurrence referme une occurrence sur le dernier mot marqué et avance la vue', () => {
    const { session } = openVerse();
    session.markWord(1); // mot 0, principale ouverte
    session.setViewIndex(0);
    session.terminateWord(5); // ferme la principale du mot 0 à la main (mot 1 pas encore marqué)

    session.toggleExtraOccurrence(10); // occurrence sur le mot 0 (dernier marqué)
    const r = session.toggleExtraOccurrence(10.5); // la referme

    assert.equal(r.action, 'closed');
    assert.equal(session.describe().isPendingSlot, true);
    assert.equal(session.describe().viewIndex, 1);
});

test('toggleExtraOccurrence puis markWord au même instant laisse un GAP', () => {
    const { session, verses } = openVerse();
    session.markWord(1); // mot 0, principale ouverte
    session.setViewIndex(0);
    session.terminateWord(5); // ferme la principale du mot 0 à la main

    session.toggleExtraOccurrence(10); // occurrence sur le mot 0
    session.toggleExtraOccurrence(11); // la referme à 11, avance sur l'emplacement suivant

    const r = session.markWord(11); // même instant, sans bouger la lecture
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][1].end, 10.99); // occurrence resserrée de GAP
    assert.equal(verses[0].words[1][0].start, 11); // mot 1 garde l'instant observé tel quel
});

test('toggleExtraOccurrence puis markWord à un autre instant ne touche rien', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.setViewIndex(0);
    session.terminateWord(5);

    session.toggleExtraOccurrence(10);
    session.toggleExtraOccurrence(11); // referme à 11

    session.markWord(15); // lecture déplacée entre-temps
    assert.equal(verses[0].words[0][1].end, 11); // inchangé
    assert.equal(verses[0].words[1][0].start, 15);
});

test('toggleExtraOccurrence referme une occurrence sur un mot du milieu sans avancer la vue', () => {
    const { session } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(3); // les 3 mots ont une principale fermée

    session.setViewIndex(0);
    session.toggleExtraOccurrence(10); // occurrence sur le mot 0 (pas le dernier)
    const r = session.toggleExtraOccurrence(10.5); // la referme

    assert.equal(r.action, 'closed');
    assert.equal(session.describe().viewIndex, 0);
});

test('advanceOccurrence enchaîne une occurrence sur le mot suivant', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(3); // les 3 mots ont une principale fermée

    session.setViewIndex(0);
    session.toggleExtraOccurrence(10); // ouvre une occurrence sur le mot 0

    const r = session.advanceOccurrence(11);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][1].end, 10.99); // mot 0 refermé (GAP avant 11)
    assert.equal(verses[0].words[1][1].start, 11); // mot 1 ouvert
    assert.equal(session.describe().viewIndex, 1);
});

test('addOrCloseVerseOccurrence ajoute une nouvelle entrée via le collaborateur, puis la referme', () => {
    const { session, verses } = openVerse();

    let r = session.addOrCloseVerseOccurrence(50);
    assert.equal(r.ok, true);
    assert.equal(r.action, 'opened');
    assert.equal(verses.length, 2);
    assert.deepEqual(verses[1], { id: 1, start: 50, end: null, words: [] });

    r = session.addOrCloseVerseOccurrence(60);
    assert.equal(r.action, 'closed');
    assert.equal(verses[1].end, 60);
});

test('addOrCloseVerseOccurrence refuse une fin avant le début', () => {
    const { session } = openVerse();
    session.addOrCloseVerseOccurrence(50);
    const r = session.addOrCloseVerseOccurrence(40);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'end-before-start');
});

test('open() sur un autre verset avec une occurrence de verset encore ouverte est bloqué (bug wordsBtn corrigé)', () => {
    const verses = [
        { id: 1, start: 0, end: 30, words: [] },
        { id: 2, start: 30, end: 60, words: [] },
    ];
    const session = makeSession(verses);
    session.open(0);
    session.addOrCloseVerseOccurrence(10); // laisse une occurrence de verset ouverte

    const blocked = session.open(1);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'open-verse-occurrence');
    assert.equal(session.getCurrentIndex(), 0); // toujours sur le verset 0

    const forced = session.open(1, { force: true });
    assert.equal(forced.ok, true);
    assert.equal(session.getCurrentIndex(), 1);
});

test('open() sur un autre verset avec une occurrence de mot encore ouverte est bloqué', () => {
    const verses = [
        { id: 1, start: 0, end: 30, words: [] },
        { id: 2, start: 30, end: 60, words: [] },
    ];
    const session = makeSession(verses);
    session.open(0);
    session.markWord(1);
    session.markWord(2); // referme la principale du mot 0
    session.setViewIndex(0);
    session.toggleExtraOccurrence(10); // occurrence supplémentaire ouverte sur le mot 0

    const blocked = session.open(1);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'open-extra-occurrence');
});

test('requestClose est bloqué par une occurrence ouverte, sauf force', () => {
    const { session } = openVerse();
    session.addOrCloseVerseOccurrence(10);

    const blocked = session.requestClose();
    assert.equal(blocked.ok, false);
    assert.equal(session.isOpen(), true);

    const closed = session.requestClose({ force: true });
    assert.equal(closed.ok, true);
    assert.equal(session.isOpen(), false);
});

test('la position dans la session survit à un réordonnancement externe de verses[] (référence, pas index)', () => {
    const verses = [
        { id: 1, start: 0, end: 10, words: [] },
        { id: 2, start: 10, end: 20, words: [] },
    ];
    const session = makeSession(verses);
    session.open(1); // ouvre le verset id:2, à l'index 1
    assert.equal(session.getCurrentIndex(), 1);

    // Réordonnancement externe (ex. glisser-déposer dans la liste) — la
    // session n'est jamais informée explicitement, elle n'a pas besoin de
    // resync : elle retrouve sa position par identité d'objet.
    const moved = verses.splice(1, 1)[0];
    verses.unshift(moved);

    assert.equal(session.getCurrentIndex(), 0);
    assert.equal(session.describe().verseId, 2);
});

test('advanceToNextWordableVerse saute les versets sans données de mots ou pas bornés', () => {
    const verses = [
        { id: 1, start: 0, end: 10, words: [] },
        { id: 99, start: 10, end: 20, words: [] }, // pas de wordList
        { id: 1, start: 20, end: null, words: [] }, // pas borné
        { id: 1, start: 30, end: 40, words: [] },
    ];
    const session = makeSession(verses);
    session.open(0);

    const r = session.advanceToNextWordableVerse();
    assert.equal(r.ok, true);
    assert.equal(session.getCurrentIndex(), 3);
});

test('advanceToNextWordableVerse signale l\'absence de verset suivant marquable', () => {
    const { session } = openVerse();
    const r = session.advanceToNextWordableVerse();
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-next-verse');
});

test('advanceToPrevWordableVerse saute les versets sans données de mots ou pas bornés', () => {
    const verses = [
        { id: 1, start: 0, end: 10, words: [] },
        { id: 1, start: 10, end: null, words: [] }, // pas borné
        { id: 99, start: 20, end: 30, words: [] }, // pas de wordList
        { id: 1, start: 30, end: 40, words: [] },
    ];
    const session = makeSession(verses);
    session.open(3);

    const r = session.advanceToPrevWordableVerse();
    assert.equal(r.ok, true);
    assert.equal(session.getCurrentIndex(), 0);
});

test('advanceToPrevWordableVerse signale l\'absence de verset précédent marquable', () => {
    const { session } = openVerse();
    const r = session.advanceToPrevWordableVerse();
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-prev-verse');
});

test('describe() reflète les boutons/labels attendus pendant un enchaînement d\'occurrences', () => {
    const { session } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(3);
    session.setViewIndex(0);

    let snap = session.describe();
    assert.equal(snap.isPendingSlot, false);
    assert.equal(snap.primary.open, false);
    assert.equal(snap.extra.toggleLabel, '+ Ajouter une occurrence ici');

    session.toggleExtraOccurrence(10);
    snap = session.describe();
    assert.equal(snap.extra.toggleLabel, 'Terminer cette occurrence ici');
    assert.equal(snap.extra.canAdvance, true);

    session.setViewIndex(1);
    snap = session.describe();
    assert.equal(snap.extra.activeWarning.wordIndex, 0);
});

test('reorderExtraOccurrence refuse tant qu\'une occurrence du mot est ouverte', () => {
    const { session } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.setViewIndex(0);
    session.toggleExtraOccurrence(10); // ouverte

    const r = session.reorderExtraOccurrence(0, 1);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'occurrence-open');
});

test('reorderExtraOccurrence réordonne les occurrences supplémentaires fermées', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.setViewIndex(0);
    session.toggleExtraOccurrence(10);
    session.toggleExtraOccurrence(10.5); // ferme
    session.toggleExtraOccurrence(20);
    session.toggleExtraOccurrence(20.5); // ferme — 2 occurrences supplémentaires closes

    const r = session.reorderExtraOccurrence(1, 0);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][1].start, 20);
    assert.equal(verses[0].words[0][2].start, 10);
});

test('shrinkLastWordEndIfNeeded resserre la fin du dernier mot à GAP avant la nouvelle occurrence', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(15); // dernier mot calé sur verse.end (30) par défaut

    session.setViewIndex(0);
    const r = session.toggleExtraOccurrence(20); // le cheikh reprend avant la fin par défaut du dernier mot
    assert.equal(r.ok, true);
    assert.deepEqual(r.shrunk, { wordIndex: 2, shrunkTo: 19.99 });
    assert.equal(verses[0].words[2][0].end, 19.99);
});

test('shrinkLastWordEndIfNeeded resserre aussi quand la nouvelle occurrence démarre PILE sur verse.end (égalité, pas seulement <)', () => {
    const { session, verses } = openVerse(); // verse.end = 30
    session.markWord(1);
    session.markWord(2);
    session.markWord(15); // dernier mot calé sur verse.end (30) par défaut

    session.setViewIndex(0);
    const r = session.toggleExtraOccurrence(30); // démarre exactement sur l'approximation par défaut
    assert.equal(r.ok, true);
    assert.deepEqual(r.shrunk, { wordIndex: 2, shrunkTo: 29.99 });
    assert.equal(verses[0].words[2][0].end, 29.99);
});

test('toggleExtraOccurrence sur un autre mot ferme l\'occurrence précédente à GAP près', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(15);

    session.setViewIndex(0);
    session.toggleExtraOccurrence(10); // ouvre sur le mot 0

    session.setViewIndex(1);
    const r = session.toggleExtraOccurrence(15); // ferme le mot 0 en cascade, ouvre sur le mot 1
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][1].end, 14.99); // GAP avant 15
    assert.equal(verses[0].words[1][1].start, 15); // instant observé, inchangé
});

test('terminateWord suivi de toggleExtraOccurrence au même instant laisse un GAP', () => {
    const { session, verses } = openVerse();
    session.markWord(1); // mot 0 ouvert (end: null), viewIndex avance sur l'emplacement suivant
    session.setViewIndex(0); // revient voir le mot 0 pour le terminer

    const t = session.terminateWord(5); // débloque l'ajout d'occurrence
    assert.equal(t.ok, true);
    assert.equal(verses[0].words[0][0].end, 5); // instant observé, tel quel pour l'instant

    const r = session.toggleExtraOccurrence(5); // même instant, sans bouger la lecture
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][0].end, 4.99); // resserré de GAP rétroactivement
    assert.equal(verses[0].words[0][1].start, 5); // l'occurrence garde l'instant observé
});

test('terminateWord suivi de toggleExtraOccurrence à un autre instant ne touche rien', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.setViewIndex(0);

    session.terminateWord(5);
    session.toggleExtraOccurrence(8); // lecture déplacée entre-temps

    assert.equal(verses[0].words[0][0].end, 5); // pas de collision, pas de resserrement
});

test('markWord ne recalcule PAS la fin d\'un mot déjà fermé via terminateWord (bug corrigé : écrasement silencieux)', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.setViewIndex(0);
    session.terminateWord(5); // fixe délibérément end=5, une vraie observation

    session.markWord(15); // mot suivant marqué bien plus tard
    assert.equal(verses[0].words[0][0].end, 5); // préservé, pas écrasé par 15 - GAP
    assert.equal(verses[0].words[1][0].start, 15);
});
