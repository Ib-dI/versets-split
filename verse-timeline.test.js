import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VerseTimeline } from './verse-timeline.js';

test('startVerse ajoute un verset en cours (end: null)', () => {
    const vt = new VerseTimeline();
    const verse = vt.startVerse(1, 10.5);
    assert.deepEqual(verse, { id: 1, start: 10.5, end: null, words: [] });
    assert.equal(vt.getVerseCount(), 1);
});

test('endVerse ferme le dernier verset en cours', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 10.5);
    const r = vt.endVerse(20.2);
    assert.equal(r.ok, true);
    assert.equal(vt.getVerse(0).end, 20.2);
});

test('endVerse refuse quand il n\'y a aucun verset', () => {
    const vt = new VerseTimeline();
    const r = vt.endVerse(5);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no-verse');
});

test('endVerse refuse quand le dernier verset a déjà une fin', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    vt.endVerse(10);
    const r = vt.endVerse(15);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'already-ended');
    assert.equal(vt.getVerse(0).end, 10); // inchangé
});

test('deleteVerse rouvre la fin du verset précédent et vide ses mots', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    vt.endVerse(10);
    vt.getVerse(0).words = [[{ start: 0, end: 10 }]];
    vt.startVerse(2, 10);
    vt.endVerse(20);

    vt.deleteVerse(1); // supprime le verset 2

    assert.equal(vt.getVerseCount(), 1);
    assert.equal(vt.getVerse(0).end, null); // rouvert
    assert.deepEqual(vt.getVerse(0).words, []); // vidés
});

test('deleteVerse du tout premier verset ne touche à rien d\'autre', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    vt.endVerse(10);
    vt.startVerse(2, 10);
    vt.endVerse(20);

    vt.deleteVerse(0);

    assert.equal(vt.getVerseCount(), 1);
    assert.equal(vt.getVerse(0).id, 2);
    assert.equal(vt.getVerse(0).end, 20); // pas de "précédent" à rouvrir
});

test('setBoundary édite la borne et vide les mots dépendants', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    vt.endVerse(10);
    vt.getVerse(0).words = [[{ start: 0, end: 10 }]];

    const r = vt.setBoundary(0, 'end', 12);
    assert.equal(r.hadWords, true);
    assert.equal(vt.getVerse(0).end, 12);
    assert.deepEqual(vt.getVerse(0).words, []);
});

test('setBoundary sans mots marqués ne signale pas hadWords', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    vt.endVerse(10);

    const r = vt.setBoundary(0, 'start', 1);
    assert.equal(r.hadWords, false);
    assert.equal(vt.getVerse(0).start, 1);
});

test('canReorder refuse le verset encore en cours (end null)', () => {
    const vt = new VerseTimeline();
    const verse = vt.startVerse(1, 0);
    assert.equal(vt.canReorder(verse), false);
    vt.endVerse(10);
    assert.equal(vt.canReorder(verse), true);
});

test('reorder déplace par identité, pas par index figé', () => {
    const vt = new VerseTimeline();
    const a = vt.startVerse(1, 0); vt.endVerse(10);
    const b = vt.startVerse(2, 10); vt.endVerse(20);
    const c = vt.startVerse(3, 20); vt.endVerse(30);

    vt.reorder(c, a); // déplace c juste avant a

    assert.deepEqual(vt.getVerses().map((v) => v.id), [3, 1, 2]);
});

test('replaceAll remplace tout le contenu en gardant la même référence de tableau', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    const liveArray = vt.getVerses();

    vt.replaceAll([{ id: 5, start: 1, end: 2, words: [] }]);

    assert.equal(vt.getVerses(), liveArray); // même référence
    assert.equal(vt.getVerseCount(), 1);
    assert.equal(vt.getVerse(0).id, 5);

    vt.replaceAll();
    assert.equal(vt.getVerseCount(), 0);
});

test('appendVerseOccurrence ajoute une nouvelle entrée sans toucher aux autres', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    vt.endVerse(10);

    const occ = vt.appendVerseOccurrence({ id: 1, start: 50 });
    assert.deepEqual(occ, { id: 1, start: 50, end: null, words: [] });
    assert.equal(vt.getVerseCount(), 2);
});

test('getOccurrenceInfo identifie la position parmi les occurrences partageant le même id', () => {
    const vt = new VerseTimeline();
    const a = vt.startVerse(1, 0); vt.endVerse(10);
    vt.startVerse(2, 10); vt.endVerse(20);
    const c = vt.appendVerseOccurrence({ id: 1, start: 30 });

    assert.equal(vt.getOccurrenceInfo(a).position, 1);
    assert.equal(vt.getOccurrenceInfo(a).total, 2);
    assert.equal(vt.getOccurrenceInfo(c).position, 2);
});

test('getOccurrenceInfo renvoie null pour un verset sans occurrence sœur', () => {
    const vt = new VerseTimeline();
    const a = vt.startVerse(1, 0);
    assert.equal(vt.getOccurrenceInfo(a), null);
});

test('serializeVerse : fin absente affichée "?", 0.00s légitime affiché tel quel', () => {
    const vt = new VerseTimeline();
    vt.startVerse(5, 1.5);
    assert.equal(vt.serializeVerse(vt.getVerse(0)), '{ id: 5, startTime: 1.50, endTime: ? }');

    vt.endVerse(0); // fin légitime à 0.00s
    assert.equal(vt.serializeVerse(vt.getVerse(0)), '{ id: 5, startTime: 1.50, endTime: 0.00 }');
});

test('serializeVerse inclut le champ words quand des mots sont marqués', () => {
    const vt = new VerseTimeline();
    vt.startVerse(1, 0);
    vt.endVerse(10);
    vt.getVerse(0).words = [[{ start: 0, end: 5 }], [{ start: 5, end: 10 }, { start: 8, end: 9 }]];

    assert.equal(
        vt.serializeVerse(vt.getVerse(0)),
        '{ id: 1, startTime: 0.00, endTime: 10.00, words: [[{ startTime: 0.00, endTime: 5.00 }], [{ startTime: 5.00, endTime: 10.00 }, { startTime: 8.00, endTime: 9.00 }]] }',
    );
});
