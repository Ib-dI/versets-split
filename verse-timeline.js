// Module profond qui possède `verses[]` : plus aucune mutation du tableau
// (push/splice) n'a lieu ailleurs. Applique une seule fois les invariants
// de cascade aujourd'hui dispersés (supprimer/éditer un verset invalide les
// mots qui dépendaient de son ancienne forme) plutôt que dans chaque
// handler DOM qui en a besoin.
//
// Expose exactement l'interface que WordMarkingSession attend déjà de son
// collaborateur (getVerse, getVerseCount, indexOf, appendVerseOccurrence,
// getOccurrenceInfo) — une instance de VerseTimeline peut donc remplacer
// createArrayVerseCollaborator sans qu'une seule ligne de
// word-marking-session.js ne change.
//
// Le tableau reste lisible depuis l'extérieur via getVerses() (même
// référence, mutée en interne) : le rendu de la liste a besoin de voir
// chaque champ de chaque verset de toute façon, la profondeur de ce module
// porte sur les MUTATIONS, pas sur le fait de cacher le tableau au rendu.

export class VerseTimeline {
    #verses = [];

    getVerses() {
        return this.#verses;
    }

    getVerse(index) {
        return this.#verses[index];
    }

    getVerseCount() {
        return this.#verses.length;
    }

    indexOf(verseRef) {
        return this.#verses.indexOf(verseRef);
    }

    // Occurrences : plusieurs entrées peuvent partager le même id (un
    // verset repris plus loin dans l'audio) — identifie/affiche la position
    // d'une occurrence parmi ses sœurs pour ne pas les confondre en
    // marquant les mots.
    getOccurrenceInfo(verseRef) {
        const sameId = this.#verses.filter((v) => v.id === verseRef.id);
        if (sameId.length <= 1) return null;
        const index = this.#verses.indexOf(verseRef);
        const position = this.#verses.slice(0, index + 1).filter((v) => v.id === verseRef.id).length;
        return { position, total: sameId.length };
    }

    // "Fin verset" cible toujours le dernier élément du tableau — déplacer
    // un verset encore en cours (sans fin) casserait cette hypothèse.
    canReorder(verse) {
        return verse.end !== null;
    }

    // Remplace tout le contenu (nouvel audio chargé, audio supprimé,
    // timings existants chargés depuis EXISTING_TIMINGS) — garde la même
    // référence de tableau plutôt que d'en créer un nouveau, au cas où
    // quelque chose d'autre l'aurait retenue via getVerses().
    replaceAll(newVerses = []) {
        this.#verses.length = 0;
        this.#verses.push(...newVerses);
    }

    startVerse(id, time) {
        const verse = { id, start: time, end: null, words: [] };
        this.#verses.push(verse);
        return verse;
    }

    endVerse(time) {
        if (this.#verses.length === 0) return { ok: false, reason: 'no-verse' };
        const lastVerse = this.#verses[this.#verses.length - 1];
        if (lastVerse.end !== null) return { ok: false, reason: 'already-ended' };
        lastVerse.end = time;
        return { ok: true, verse: lastVerse };
    }

    // Supprimer un verset rouvre la fin du verset PRÉCÉDENT dans le
    // tableau (il redevient "en cours") et invalide ses mots : le dernier
    // mot était calé sur l'ancienne fin par valeur, pas par référence.
    deleteVerse(index) {
        this.#verses.splice(index, 1);
        if (index > 0) {
            const previous = this.#verses[index - 1];
            previous.end = null;
            previous.words = [];
        }
    }

    // Éditer une borne déjà enregistrée invalide les mots déjà marqués
    // (ils dépendaient de l'ancienne limite) — même logique que
    // deleteVerse, appliquée ici que ce soit start ou end qui change.
    setBoundary(index, field, time) {
        const verse = this.#verses[index];
        verse[field] = time;
        const hadWords = verse.words.length > 0;
        if (hadWords) verse.words = [];
        return { hadWords };
    }

    // Réordonnancement par glisser-déposer : identité d'objet plutôt
    // qu'index figé au rendu — après avoir retiré la source, l'index de la
    // cible peut avoir changé (glisser un élément plus tôt vers un plus
    // tard), le recalculer garantit une insertion juste avant la cible
    // dans les deux sens.
    reorder(fromVerse, toVerse) {
        if (fromVerse === toVerse) return;
        const srcIndex = this.#verses.indexOf(fromVerse);
        if (srcIndex === -1) return;
        this.#verses.splice(srcIndex, 1);
        const targetIndex = this.#verses.indexOf(toVerse);
        if (targetIndex === -1) {
            // La cible a disparu (ne devrait pas arriver) — remet la
            // source à sa place plutôt que de la perdre.
            this.#verses.splice(srcIndex, 0, fromVerse);
            return;
        }
        this.#verses.splice(targetIndex, 0, fromVerse);
    }

    // Marque une nouvelle occurrence du verset `id` (le cheikh le répète
    // plus loin dans le même passage) — ajoutée en fin de tableau, sans
    // jamais toucher aux autres occurrences.
    appendVerseOccurrence({ id, start }) {
        const verse = { id, start, end: null, words: [] };
        this.#verses.push(verse);
        return verse;
    }

    // Champ `words` au format TafsirAudioTiming.words de tafsir-app, prêt à
    // coller dans audios.ts. Absent tant qu'aucun mot n'a été marqué.
    // Chaque mot est un tableau d'occurrences ({startTime,endTime}[]) —
    // normalement une seule (la principale), plus si le mot est redit plus
    // tard dans le même passage.
    #formatWordsField(verse) {
        if (!verse.words || verse.words.length === 0) return '';
        const items = verse.words
            .map((occurrences) => {
                const ranges = occurrences
                    .map((w) => `{ startTime: ${w.start.toFixed(2)}, endTime: ${w.end !== null ? w.end.toFixed(2) : '?'} }`)
                    .join(', ');
                return `[${ranges}]`;
            })
            .join(', ');
        return `, words: [${items}]`;
    }

    // Fragment `{ id, startTime, endTime, words? }` d'un verset, sans
    // virgule finale ni emballage — les appelants (copie d'une ligne, copie
    // groupée, export) ajoutent chacun leur propre ponctuation autour.
    // `!== null` (pas une simple vérité) : un endTime de 0.00s est une
    // valeur légitime, pas une absence.
    serializeVerse(verse) {
        const endTime = verse.end !== null ? verse.end.toFixed(2) : '?';
        return `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${endTime}${this.#formatWordsField(verse)} }`;
    }
}
