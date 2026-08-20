// Module profond pour le mode mots : possède l'état du marquage en cours
// (quel verset, quel mot, occurrences supplémentaires, occurrence de verset
// en attente, verrou anti-clic-réflexe) et applique les invariants une
// seule fois, ici, plutôt que dans chaque handler DOM qui en a besoin.
//
// Ne touche jamais le DOM ni <audio> : le temps est reçu en paramètre par
// l'appelant (qui lit audioPlayer.currentTime au moment du clic), et l'état
// se lit via describe() — un instantané prêt à peindre, sans logique
// d'affichage à recalculer côté appelant.
//
// Dépend d'un collaborateur injecté (verses) plutôt que de manipuler un
// tableau global directement : aujourd'hui c'est un fin wrapper autour du
// tableau `verses` de script.js, plus tard ce sera le module VerseTimeline.
// Voir createArrayVerseCollaborator dans script.js pour l'implémentation
// actuelle.
//
// verses (collaborateur) doit exposer :
//   getVerse(index)                  -> Verse | undefined
//   getVerseCount()                  -> number
//   indexOf(verseRef)                -> number (-1 si absent)
//   appendVerseOccurrence({id,start})-> Verse (nouvelle entrée en fin de liste)
//   getOccurrenceInfo(verseRef)      -> { position, total } | null
//
// wordList(verseId) -> string[] | undefined — liste des mots (arabe) du
// verset, ou undefined si pas de données pour ce verset.
//
// Toute méthode qui peut échouer retourne { ok: true, ... } ou
// { ok: false, reason, ... } plutôt que d'appeler window.confirm ou de
// lancer une exception — c'est à l'appelant de décider comment réagir
// (afficher une confirmation, une notification, etc.), et de rappeler
// avec { force: true } si l'utilisateur confirme.

export class WordMarkingSession {
    #collaborator;
    #wordListProvider;

    #verseRef = null;
    #wordViewIndex = 0;
    #activeExtraWordIndex = null;
    #pendingVerseOccurrenceRef = null;
    #wordMarkingLocked = false;

    constructor({ verses, wordList }) {
        this.#collaborator = verses;
        this.#wordListProvider = wordList;
    }

    isOpen() {
        return this.#verseRef !== null;
    }

    getCurrentIndex() {
        if (!this.#verseRef) return -1;
        return this.#collaborator.indexOf(this.#verseRef);
    }

    isWordMarkingLocked() {
        return this.#wordMarkingLocked;
    }

    setWordMarkingLocked(locked) {
        this.#wordMarkingLocked = Boolean(locked);
    }

    toggleWordMarkingLocked() {
        this.#wordMarkingLocked = !this.#wordMarkingLocked;
        return this.#wordMarkingLocked;
    }

    // Vrai si une occurrence supplémentaire est en cours (démarrée, pas
    // encore refermée) — sert de garde avant de fermer/changer de verset.
    #hasOpenExtraOccurrence() {
        if (!this.#verseRef || this.#activeExtraWordIndex === null) return false;
        const occurrences = this.#verseRef.words[this.#activeExtraWordIndex];
        return occurrences.length > 1 && occurrences[occurrences.length - 1].end === null;
    }

    #hasOpenVerseOccurrence() {
        return this.#pendingVerseOccurrenceRef !== null;
    }

    // Garde commune à open()/requestClose()/advanceToNextWordableVerse() :
    // si une occurrence (mot ou verset) est encore ouverte, on refuse de
    // quitter l'état actuel sauf confirmation explicite de l'appelant.
    #checkCanLeave(force) {
        if (force) return { ok: true };
        if (this.#hasOpenExtraOccurrence()) {
            return { ok: false, reason: 'open-extra-occurrence', wordIndex: this.#activeExtraWordIndex };
        }
        if (this.#hasOpenVerseOccurrence()) {
            return { ok: false, reason: 'open-verse-occurrence', pendingStart: this.#pendingVerseOccurrenceRef.start };
        }
        return { ok: true };
    }

    #clampViewIndex() {
        const verse = this.#verseRef;
        if (!verse) return;
        const total = this.#wordListProvider(verse.id)?.length ?? 0;
        const doneCount = verse.words.length;
        const maxIndex = doneCount < total ? doneCount : Math.max(total - 1, 0);
        this.#wordViewIndex = Math.min(Math.max(this.#wordViewIndex, 0), maxIndex);
    }

    // Ouvre le mode mots pour le verset à `index` (déjà borné start+end).
    // Résout un index en référence d'objet une fois ici — l'état interne
    // ne garde ensuite plus que la référence, jamais l'index : un
    // réordonnancement ultérieur de verses[] ne peut plus rien invalider.
    open(index, { force = false } = {}) {
        const verseRef = this.#collaborator.getVerse(index);
        if (!verseRef) return { ok: false, reason: 'not-found' };

        const wordList = this.#wordListProvider(verseRef.id);
        if (!wordList || verseRef.end === null) return { ok: false, reason: 'not-markable' };

        if (this.isOpen()) {
            const leave = this.#checkCanLeave(force);
            if (!leave.ok) return leave;
        }

        this.#verseRef = verseRef;
        this.#wordViewIndex = verseRef.words.length;
        this.#activeExtraWordIndex = null;
        this.#pendingVerseOccurrenceRef = null;

        return {
            ok: true,
            seekTime: verseRef.start,
            verseId: verseRef.id,
            occurrenceInfo: this.#collaborator.getOccurrenceInfo(verseRef),
        };
    }

    requestClose({ force = false } = {}) {
        if (!this.isOpen()) return { ok: true };
        const leave = this.#checkCanLeave(force);
        if (!leave.ok) return leave;

        this.#verseRef = null;
        this.#wordViewIndex = 0;
        this.#activeExtraWordIndex = null;
        this.#pendingVerseOccurrenceRef = null;
        return { ok: true };
    }

    // Passe directement au mode mots du prochain verset marquable (données
    // de mots dispo + déjà borné) après celui en cours, sans repasser par
    // la liste principale.
    advanceToNextWordableVerse({ force = false } = {}) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };

        const fromIndex = this.getCurrentIndex();
        let nextIndex = -1;
        for (let i = fromIndex + 1; i < this.#collaborator.getVerseCount(); i++) {
            const v = this.#collaborator.getVerse(i);
            if (this.#wordListProvider(v.id) && v.end !== null) {
                nextIndex = i;
                break;
            }
        }
        if (nextIndex === -1) return { ok: false, reason: 'no-next-verse' };

        return this.open(nextIndex, { force });
    }

    setViewIndex(index) {
        if (!this.isOpen()) return;
        this.#wordViewIndex = index;
        this.#clampViewIndex();
    }

    prev() {
        if (!this.isOpen()) return;
        this.#wordViewIndex -= 1;
        this.#clampViewIndex();
    }

    next() {
        if (!this.isOpen()) return;
        this.#wordViewIndex += 1;
        this.#clampViewIndex();
    }

    // Le dernier mot d'un verset a sa fin calée sur `verse.end` par défaut
    // (voir markWord) — une approximation, pas une vraie frontière observée
    // comme pour les autres mots. Si une occurrence supplémentaire d'un
    // AUTRE mot démarre avant cette fin, c'est la preuve que le cheikh a
    // repris la parole plus tôt que prévu : on resserre la fin du dernier
    // mot sur ce début plutôt que de laisser l'approximation.
    #shrinkLastWordEndIfNeeded(verse, newOccurrenceWordIndex, startTime) {
        const total = this.#wordListProvider(verse.id)?.length;
        if (!total) return null;
        const lastIndex = total - 1;
        if (newOccurrenceWordIndex === lastIndex) return null;
        if (verse.words.length <= lastIndex) return null;

        const lastWordPrimary = verse.words[lastIndex][0];
        if (lastWordPrimary.end !== null && startTime < lastWordPrimary.end) {
            lastWordPrimary.end = startTime;
            return { wordIndex: lastIndex, shrunkTo: startTime };
        }
        return null;
    }

    markWord(time) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        if (this.#wordMarkingLocked) return { ok: false, reason: 'locked' };

        const verse = this.#verseRef;
        const wordList = this.#wordListProvider(verse.id);
        const doneCount = verse.words.length;
        if (doneCount >= wordList.length) return { ok: false, reason: 'all-words-marked' };

        // Le clic marque le début du mot en cours. Si un mot précédent est
        // encore ouvert (pas de end), ce même instant en marque la fin —
        // les mots d'un verset se suivent sans blanc entre eux.
        if (doneCount > 0) {
            verse.words[doneCount - 1][0].end = time;
        }

        const isLastWord = doneCount === wordList.length - 1;
        if (isLastWord) {
            // Dernier mot : sa fin est déjà connue, c'est la fin du verset.
            verse.words.push([{ start: time, end: verse.end }]);
        } else {
            verse.words.push([{ start: time, end: null }]);
        }

        this.#wordViewIndex = verse.words.length;
        return { ok: true, allWordsMarked: isLastWord };
    }

    // Recale le début d'un mot déjà marqué sans devoir tout annuler après
    // lui. Comme les mots d'un verset se suivent sans blanc, redéfinir le
    // début du mot N déplace aussi la fin du mot N-1 au même instant.
    correctWord(time) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        const verse = this.#verseRef;
        if (this.#wordViewIndex >= verse.words.length) return { ok: false, reason: 'no-word-at-view' };

        verse.words[this.#wordViewIndex][0].start = time;
        if (this.#wordViewIndex > 0) {
            verse.words[this.#wordViewIndex - 1][0].end = time;
        }
        return { ok: true, wordIndex: this.#wordViewIndex };
    }

    // Ferme directement la principale encore ouverte du mot affiché (seul
    // le mot le plus récemment marqué peut être dans ce cas).
    terminateWord(time) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        const verse = this.#verseRef;
        const primary = verse.words[this.#wordViewIndex]?.[0];
        if (!primary || primary.end !== null) return { ok: false, reason: 'no-open-primary' };

        primary.end = time;
        return { ok: true, wordIndex: this.#wordViewIndex };
    }

    undoWord() {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        const verse = this.#verseRef;
        if (verse.words.length === 0) return { ok: false, reason: 'nothing-to-undo' };

        verse.words.pop();
        if (verse.words.length > 0) {
            verse.words[verse.words.length - 1][0].end = null;
        }
        this.#wordViewIndex = verse.words.length;
        return { ok: true };
    }

    // Occurrences supplémentaires : le cheikh peut redire un mot, ou une
    // suite de mots, plus tard dans le même passage. Un clic démarre une
    // occurrence sur le mot affiché ; recliquer dessus la termine. Naviguer
    // vers un autre mot puis rappeler ferme l'occurrence en cours à cet
    // instant et en ouvre une nouvelle là — ce qui enchaîne une phrase
    // répétée sur plusieurs mots.
    toggleExtraOccurrence(time) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        if (this.#wordMarkingLocked) return { ok: false, reason: 'locked' };
        const verse = this.#verseRef;
        const viewIndex = this.#wordViewIndex;

        if (this.#activeExtraWordIndex === viewIndex) {
            const occurrences = verse.words[viewIndex];
            occurrences[occurrences.length - 1].end = time;
            this.#activeExtraWordIndex = null;
            return { ok: true, action: 'closed' };
        }

        if (!verse.words[viewIndex]) return { ok: false, reason: 'no-word-at-view' };

        // Garde-fou : un mot dont la principale est encore ouverte ne peut
        // pas recevoir d'occurrence supplémentaire.
        const primary = verse.words[viewIndex][0];
        if (primary.end === null) return { ok: false, reason: 'primary-open' };

        if (this.#activeExtraWordIndex !== null) {
            const other = verse.words[this.#activeExtraWordIndex];
            other[other.length - 1].end = time;
        }

        verse.words[viewIndex].push({ start: time, end: null });
        this.#activeExtraWordIndex = viewIndex;
        const shrunk = this.#shrinkLastWordEndIfNeeded(verse, viewIndex, time);
        return { ok: true, action: 'opened', shrunk };
    }

    // Ferme l'occurrence ouverte sur le mot courant ET en ouvre une sur le
    // mot suivant, au même instant — un seul appel pour enchaîner une
    // phrase répétée, sans naviguer mot par mot entre chaque occurrence.
    advanceOccurrence(time) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        if (this.#wordMarkingLocked) return { ok: false, reason: 'locked' };
        const verse = this.#verseRef;
        const viewIndex = this.#wordViewIndex;
        if (this.#activeExtraWordIndex === null || this.#activeExtraWordIndex !== viewIndex) {
            return { ok: false, reason: 'no-active-occurrence-here' };
        }

        const total = this.#wordListProvider(verse.id)?.length ?? 0;
        const targetIndex = viewIndex + 1;
        if (targetIndex >= total) return { ok: false, reason: 'no-next-word' };

        // Garde-fou : le mot suivant ne peut recevoir une occurrence
        // enchaînée que si sa propre principale est déjà fermée.
        const target = verse.words[targetIndex];
        if (!target) return { ok: false, reason: 'target-not-marked' };
        if (target[0].end === null) return { ok: false, reason: 'target-primary-open' };

        const current = verse.words[viewIndex];
        current[current.length - 1].end = time;

        this.#wordViewIndex = targetIndex;
        verse.words[targetIndex].push({ start: time, end: null });
        this.#activeExtraWordIndex = targetIndex;
        const shrunk = this.#shrinkLastWordEndIfNeeded(verse, targetIndex, time);
        return { ok: true, shrunk };
    }

    removeExtraOccurrence(extraIndex) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        const verse = this.#verseRef;
        const viewIndex = this.#wordViewIndex;
        const occurrences = verse.words[viewIndex];
        occurrences.splice(extraIndex + 1, 1); // +1 : l'index 0 est la principale

        const stillOpen = occurrences.length > 1 && occurrences[occurrences.length - 1].end === null;
        if (this.#activeExtraWordIndex === viewIndex && !stillOpen) {
            this.#activeExtraWordIndex = null;
        }
        return { ok: true };
    }

    // Réordonne les occurrences supplémentaires du mot affiché (glisser-
    // déposer côté appelant) — utile quand une occurrence antérieure
    // (chronologiquement) est ajoutée après coup. Refusé tant qu'une
    // occurrence de ce mot est encore ouverte : le code de fermeture/
    // enchaînement suppose que la dernière entrée est celle qui est ouverte.
    reorderExtraOccurrence(fromIndex, toIndex) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };
        const viewIndex = this.#wordViewIndex;
        if (this.#activeExtraWordIndex === viewIndex) return { ok: false, reason: 'occurrence-open' };

        const occurrences = this.#verseRef.words[viewIndex];
        const extras = occurrences.slice(1);
        if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= extras.length) {
            return { ok: false, reason: 'invalid-index' };
        }

        const [moved] = extras.splice(fromIndex, 1);
        extras.splice(toIndex, 0, moved);
        occurrences.splice(1, occurrences.length - 1, ...extras);
        return { ok: true };
    }

    // Marque une nouvelle occurrence du VERSET en cours (pas d'un mot) — le
    // cheikh répète le verset entier plus loin dans le même passage.
    // N'ajoute qu'une entrée en fin de liste des versets via le
    // collaborateur, ne touche jamais le verset dont on marque les mots.
    addOrCloseVerseOccurrence(time) {
        if (!this.isOpen()) return { ok: false, reason: 'not-open' };

        if (this.#pendingVerseOccurrenceRef !== null) {
            const pending = this.#pendingVerseOccurrenceRef;
            if (time <= pending.start) return { ok: false, reason: 'end-before-start' };
            pending.end = time;
            this.#pendingVerseOccurrenceRef = null;
            return { ok: true, action: 'closed', verseId: pending.id };
        }

        const verse = this.#verseRef;
        const created = this.#collaborator.appendVerseOccurrence({ id: verse.id, start: time });
        this.#pendingVerseOccurrenceRef = created;
        return { ok: true, action: 'opened', verseId: verse.id };
    }

    // Instantané complet, prêt à peindre : toutes les règles "quoi
    // afficher/activer quand" vivent ici plutôt que dans le code de rendu.
    describe() {
        if (!this.isOpen()) return { isOpen: false };

        this.#clampViewIndex();
        const verse = this.#verseRef;
        const wordList = this.#wordListProvider(verse.id) ?? [];
        const total = wordList.length;
        const doneCount = verse.words.length;
        const maxIndex = doneCount < total ? doneCount : Math.max(total - 1, 0);
        const viewIndex = this.#wordViewIndex;
        const isPendingSlot = viewIndex === doneCount && doneCount < total;
        const occ = this.#collaborator.getOccurrenceInfo(verse);

        const markedWords = verse.words.map((occurrences, i) => {
            const primary = occurrences[0];
            return {
                index: i,
                isActive: i === viewIndex,
                arabic: wordList[i],
                start: primary.start,
                end: primary.end,
                extraCount: occurrences.length - 1,
            };
        });

        let primary = null;
        let extra = null;
        if (!isPendingSlot) {
            const occurrences = verse.words[viewIndex];
            const p = occurrences[0];
            primary = { start: p.start, end: p.end, open: p.end === null };
            if (!primary.open) {
                const extras = occurrences.slice(1);
                const activeHere = this.#activeExtraWordIndex === viewIndex;
                const activeElsewhere =
                    this.#activeExtraWordIndex !== null && this.#activeExtraWordIndex !== viewIndex;
                extra = {
                    toggleLabel:
                        this.#activeExtraWordIndex === null
                            ? '+ Ajouter une occurrence ici'
                            : activeHere
                              ? 'Terminer cette occurrence ici'
                              : 'Continuer ici (ferme le mot précédent)',
                    canAdvance: activeHere && viewIndex + 1 < total,
                    activeWarning: activeElsewhere
                        ? {
                              wordIndex: this.#activeExtraWordIndex,
                              openStart: verse.words[this.#activeExtraWordIndex][
                                  verse.words[this.#activeExtraWordIndex].length - 1
                              ].start,
                          }
                        : null,
                    canReorder: this.#activeExtraWordIndex !== viewIndex,
                    items: extras.map((e) => ({ start: e.start, end: e.end })),
                };
            }
        }

        const currentIndex = this.getCurrentIndex();
        const hasNextVerse = currentIndex !== -1 && currentIndex + 1 < this.#collaborator.getVerseCount();

        return {
            isOpen: true,
            verseId: verse.id,
            occurrenceLabel: occ ? `(occurrence ${occ.position}/${occ.total})` : null,
            words: wordList,
            total,
            doneCount,
            viewIndex,
            isPendingSlot,
            canGoPrev: viewIndex > 0,
            canGoNext: viewIndex < maxIndex,
            hasNextVerse,
            wordProgressText: isPendingSlot
                ? `Mot ${viewIndex + 1} / ${total} — à marquer`
                : `Mot ${viewIndex + 1} / ${total}` + (doneCount >= total ? ' — tous les mots sont marqués' : ' (déjà marqué)'),
            addOccurrenceLabel: this.#pendingVerseOccurrenceRef
                ? 'Terminer cette occurrence de verset ici'
                : '+ Occurrence de ce verset ici',
            primary,
            extra,
            markedWords,
            wordMarkingLocked: this.#wordMarkingLocked,
        };
    }
}

// Adaptateur temporaire autour d'un tableau `verses` en mémoire — satisfait
// l'interface collaborateur attendue par WordMarkingSession. Le jour où
// VerseTimeline (candidat 1 de la revue d'architecture) existe, on le
// remplace par une instance de ce module sans toucher WordMarkingSession.
export function createArrayVerseCollaborator(getVerses) {
    return {
        getVerse(index) {
            return getVerses()[index];
        },
        getVerseCount() {
            return getVerses().length;
        },
        indexOf(verseRef) {
            return getVerses().indexOf(verseRef);
        },
        appendVerseOccurrence({ id, start }) {
            const verses = getVerses();
            const created = { id, start, end: null, words: [] };
            verses.push(created);
            return created;
        },
        getOccurrenceInfo(verseRef) {
            const verses = getVerses();
            const sameId = verses.filter((v) => v.id === verseRef.id);
            if (sameId.length <= 1) return null;
            const index = verses.indexOf(verseRef);
            const position = verses.slice(0, index + 1).filter((v) => v.id === verseRef.id).length;
            return { position, total: sameId.length };
        },
    };
}
