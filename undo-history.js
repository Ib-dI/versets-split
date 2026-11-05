// Historique Cmd+Z / Cmd+Maj+Z : deux piles d'actions { label, before, after },
// sans rien savoir de ce que contiennent before/after. Ce qui constitue une
// action, et comment appliquer un état, reste à l'appelant (voir runUndoable
// dans script.js). En mémoire seulement : perdu au rechargement de la page.
export class UndoHistory {
    #limit;
    #undoStack = [];
    #redoStack = [];

    constructor({ limit = 100 } = {}) {
        this.#limit = limit;
    }

    record(entry) {
        this.#undoStack.push(entry);
        if (this.#undoStack.length > this.#limit) this.#undoStack.shift();
        this.#redoStack.length = 0;
    }

    undo() {
        const entry = this.#undoStack.pop() ?? null;
        if (entry) this.#redoStack.push(entry);
        return entry;
    }

    redo() {
        const entry = this.#redoStack.pop() ?? null;
        if (entry) this.#undoStack.push(entry);
        return entry;
    }
}
