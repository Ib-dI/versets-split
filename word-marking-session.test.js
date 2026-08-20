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
    assert.equal(verses[0].words[0][0].end, 2.0); // mot précédent refermé
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
    assert.equal(verses[0].words[0][0].end, 2.5);
});

test('terminateWord ferme la principale ouverte du mot affiché', () => {
    const { session, verses } = openVerse();
    session.markWord(1); // mot 0 ouvert (end: null), viewIndex avance sur l'emplacement suivant
    session.setViewIndex(0); // revient voir le mot 0 pour le terminer
    const r = session.terminateWord(1.8);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][0].end, 1.8);
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

test('advanceOccurrence enchaîne une occurrence sur le mot suivant', () => {
    const { session, verses } = openVerse();
    session.markWord(1);
    session.markWord(2);
    session.markWord(3); // les 3 mots ont une principale fermée

    session.setViewIndex(0);
    session.toggleExtraOccurrence(10); // ouvre une occurrence sur le mot 0

    const r = session.advanceOccurrence(11);
    assert.equal(r.ok, true);
    assert.equal(verses[0].words[0][1].end, 11); // mot 0 refermé
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
