import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UndoHistory } from './undo-history.js';

test('undo renvoie la dernière action, redo la rejoue', () => {
    const h = new UndoHistory();
    h.record({ label: 'a', before: 0, after: 1 });
    h.record({ label: 'b', before: 1, after: 2 });
    assert.equal(h.undo().label, 'b');
    assert.equal(h.undo().before, 0);
    assert.equal(h.redo().after, 1);
    assert.equal(h.redo().label, 'b');
});

test('undo et redo renvoient null quand il n\'y a rien à faire', () => {
    const h = new UndoHistory();
    assert.equal(h.undo(), null);
    assert.equal(h.redo(), null);
    h.record({ label: 'a', before: 0, after: 1 });
    assert.equal(h.redo(), null);
    h.undo();
    assert.equal(h.undo(), null);
});

test('une nouvelle action après un undo efface ce qui pouvait être rétabli', () => {
    const h = new UndoHistory();
    h.record({ label: 'a', before: 0, after: 1 });
    h.undo();
    h.record({ label: 'b', before: 0, after: 2 });
    assert.equal(h.redo(), null);
    assert.equal(h.undo().label, 'b');
});

test('au-delà de la limite, les actions les plus anciennes sont oubliées', () => {
    const h = new UndoHistory({ limit: 100 });
    for (let i = 0; i < 105; i++) h.record({ label: `a${i}`, before: i, after: i + 1 });
    let count = 0;
    let last = null;
    for (let entry = h.undo(); entry; entry = h.undo()) {
        count += 1;
        last = entry;
    }
    assert.equal(count, 100);
    assert.equal(last.label, 'a5');
});
