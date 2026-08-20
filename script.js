// WORDS_BY_SURAH (data/words-by-surah.js) et EXISTING_TIMINGS
// (data/existing-timings.js) sont générées depuis tafsir-app — voir ces
// fichiers pour leur origine. Chargées comme <script> avant celui-ci.

import { WordMarkingSession } from './word-marking-session.js';
import { VerseTimeline } from './verse-timeline.js';

document.addEventListener('DOMContentLoaded', function() {
    const audioPlayer = document.getElementById('audioPlayer');
    // Seul point de contact avec la position de lecture de <audio> — élimine
    // les lectures/écritures directes de audioPlayer.currentTime/.src
    // dispersées dans les handlers (13 vérifications "audio chargé ?"
    // identiques avant ce regroupement). .duration/.paused/.play() restent
    // des accès DOM directs, hors périmètre.
    const timeSource = {
        now: () => audioPlayer.currentTime,
        isReady: () => Boolean(audioPlayer.src),
        seek: (time) => { audioPlayer.currentTime = time; },
    };
    const audioWrapper = document.getElementById('audioWrapper');
    const currentTimeDisplay = document.getElementById('currentTime');
    const startVerseBtn = document.getElementById('startVerse');
    const endVerseBtn = document.getElementById('endVerse');
    const copyAllBtn = document.getElementById('copyAll');
    const verseList = document.getElementById('verseList');
    const audioFileInput = document.getElementById('audioFile');
    const clearAudioBtn = document.getElementById('clearAudio');
    const fileName = document.getElementById('fileName');
    const fileMeta = document.getElementById('fileMeta');
    const audioDropZone = document.getElementById('audioDropZone');
    const exportBtn = document.getElementById('exportBtn');
    const exportText = document.getElementById('exportText');
    const notification = document.getElementById('notification');
    const verseIdInput = document.getElementById('verseId');
    const timeControlBtns = document.querySelectorAll('.time-control-btn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    const wordModeSection = document.getElementById('wordModeSection');
    const wordModeVerseId = document.getElementById('wordModeVerseId');
    const wordProgress = document.getElementById('wordProgress');
    const wordCarousel = document.getElementById('wordCarousel');
    const wordCarouselTrack = document.getElementById('wordCarouselTrack');
    const markWordBtn = document.getElementById('markWordBtn');
    const correctWordBtn = document.getElementById('correctWordBtn');
    const terminateWordBtn = document.getElementById('terminateWordBtn');
    const undoWordBtn = document.getElementById('undoWordBtn');
    const closeWordModeBtn = document.getElementById('closeWordModeBtn');
    const nextVerseWordsBtn = document.getElementById('nextVerseWordsBtn');
    const seekNextVerseWordsBtn = document.getElementById('seekNextVerseWordsBtn');
    const addVerseOccurrenceBtn = document.getElementById('addVerseOccurrenceBtn');
    const extraOccurrencesSection = document.getElementById('extraOccurrencesSection');
    const extraOccurrencesList = document.getElementById('extraOccurrencesList');
    const toggleExtraOccurrenceBtn = document.getElementById('toggleExtraOccurrenceBtn');
    const advanceOccurrenceBtn = document.getElementById('advanceOccurrenceBtn');
    const activeExtraWarning = document.getElementById('activeExtraWarning');
    const wordMarkedList = document.getElementById('wordMarkedList');
    const prevWordBtn = document.getElementById('prevWordBtn');
    const nextWordBtn = document.getElementById('nextWordBtn');
    const surahIdInput = document.getElementById('surahId');
    const surahWordsStatus = document.getElementById('surahWordsStatus');
    const existingTimingsList = document.getElementById('existingTimingsList');
    const toggleVerseLockBtn = document.getElementById('toggleVerseLock');
    const toggleWordLockBtn = document.getElementById('toggleWordLock');

    let updateTimer;

    // Possède tout le tableau verses[] : plus aucune mutation (push/splice)
    // n'a lieu ailleurs dans ce fichier — voir verse-timeline.js pour les
    // invariants de cascade qu'elle applique elle-même désormais (supprimer
    // ou éditer un verset invalide les mots qui dépendaient de son ancienne
    // forme). `verses` reste une référence en lecture vers le même tableau
    // (getVerses()) — le rendu de la liste en a besoin pour tout afficher,
    // seules les mutations passent par verseTimeline.
    const verseTimeline = new VerseTimeline();
    const verses = verseTimeline.getVerses();
    // Possède tout l'état du mode mots (verset en cours, mot affiché,
    // occurrences supplémentaires, occurrence de verset en attente, verrou
    // anti-clic-réflexe) — voir word-marking-session.js pour les invariants
    // qu'elle applique elle-même désormais (ex. impossible d'ouvrir un
    // verset en écrasant silencieusement une occurrence encore ouverte,
    // quel que soit le point d'entrée). verseTimeline satisfait exactement
    // l'interface que WordMarkingSession attend de son collaborateur.
    const wordSession = new WordMarkingSession({ verses: verseTimeline, wordList: getWordList });

    // Verrou anti-clic-réflexe pour Début/Fin verset — une habitude de clic
    // utile quand on marque activement, gênante (et destructrice) le reste
    // du temps. Déverrouillé par défaut ; ouvrir le mode mots le verrouille
    // automatiquement, le fermer le redéverrouille (voir tryOpenWordMode/
    // requestCloseWordMode). Le verrou équivalent côté mots
    // (wordMarkingLocked) vit maintenant dans wordSession elle-même.
    let verseMarkingLocked = false;

    function renderVerseLock() {
        toggleVerseLockBtn.classList.toggle('locked', verseMarkingLocked);
        toggleVerseLockBtn.classList.toggle('unlocked', !verseMarkingLocked);
        startVerseBtn.disabled = verseMarkingLocked;
        endVerseBtn.disabled = verseMarkingLocked;
    }

    function renderWordLock() {
        const locked = wordSession.isWordMarkingLocked();
        toggleWordLockBtn.classList.toggle('locked', locked);
        toggleWordLockBtn.classList.toggle('unlocked', !locked);
        if (wordSession.isOpen()) {
            renderWordMode();
        } else {
            markWordBtn.disabled = locked;
        }
    }

    toggleVerseLockBtn.addEventListener('click', function() {
        verseMarkingLocked = !verseMarkingLocked;
        renderVerseLock();
        showNotification(verseMarkingLocked ? 'Marquage de versets verrouillé' : 'Marquage de versets déverrouillé');
    });

    toggleWordLockBtn.addEventListener('click', function() {
        const locked = wordSession.toggleWordMarkingLocked();
        renderWordLock();
        showNotification(locked ? 'Marquage de mots verrouillé' : 'Marquage de mots déverrouillé');
    });

    renderVerseLock();
    renderWordLock();

    // Liste des mots (arabe) du verset `verseId` pour la sourate en cours,
    // ou undefined si les données ne sont pas disponibles pour ce verset.
    function getWordList(verseId) {
        const surahId = parseInt(surahIdInput.value) || 1;
        return WORDS_BY_SURAH[surahId]?.[verseId];
    }

    function renderSurahStatus() {
        const surahId = parseInt(surahIdInput.value) || 1;
        const hasWords = Boolean(WORDS_BY_SURAH[surahId]);
        surahWordsStatus.textContent = hasWords
            ? '✓ données de mots disponibles'
            : '✗ pas de données de mots pour cette sourate';
        surahWordsStatus.classList.toggle('has-words', hasWords);
    }

    function renderExistingTimingsList() {
        const surahId = parseInt(surahIdInput.value) || 1;
        const parts = EXISTING_TIMINGS[surahId];
        existingTimingsList.innerHTML = '';

        if (!parts || parts.length === 0) {
            existingTimingsList.innerHTML =
                '<p style="color: var(--text-secondary); font-size: 13px;">Aucun timing existant pour cette sourate — marquage depuis zéro.</p>';
            return;
        }

        parts.forEach((part) => {
            const row = document.createElement('div');
            row.className = 'existing-timing-row';

            const label = document.createElement('span');
            label.textContent = `${part.title || part.id} (${part.timings.length} versets)`;

            const loadBtn = document.createElement('button');
            loadBtn.className = 'copy-btn load-timings-btn';
            loadBtn.textContent = 'Charger';
            loadBtn.title = 'Remplace les versets actuellement marqués par ces timings existants';
            loadBtn.addEventListener('click', () => {
                verseTimeline.replaceAll(part.timings.map((t) => ({
                    id: t.id,
                    start: t.startTime,
                    end: t.endTime,
                    words: [],
                })));
                const lastId = verses.length > 0 ? verses[verses.length - 1].id : 0;
                verseIdInput.value = lastId + 1;
                forceCloseWordMode();
                updateVerseList();
                showNotification(`Timings de "${part.title || part.id}" chargés (${verses.length} versets)`);
            });

            row.appendChild(label);
            row.appendChild(loadBtn);
            existingTimingsList.appendChild(row);
        });
    }

    surahIdInput.addEventListener('input', function() {
        renderSurahStatus();
        renderExistingTimingsList();
        updateVerseList();
    });

    renderSurahStatus();
    renderExistingTimingsList();
    
    // Charger un fichier audio (clic ou changement input)
    let lastFile = null;
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // Drag & drop support
    if (audioDropZone) {
        ['dragenter','dragover'].forEach(evt => {
            audioDropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                audioDropZone.classList.add('dragover');
            });
        });

        ['dragleave','dragend','drop'].forEach(evt => {
            audioDropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (evt === 'drop') {
                    const file = e.dataTransfer.files[0];
                    if (file) {
                        audioFileInput.files = e.dataTransfer.files;
                        handleFile(file);
                    }
                }
                audioDropZone.classList.remove('dragover');
            });
        });
    }

    function handleFile(file) {
        lastFile = file;
        const url = URL.createObjectURL(file);
        audioPlayer.src = url;
        audioWrapper.style.display = 'block';
        clearAudioBtn.classList.add('visible');
        fileName.textContent = file.name;
        fileMeta.textContent = `Taille: ${formatBytes(file.size)}`;
        verseTimeline.replaceAll();
        updateVerseList();
        showNotification('Audio chargé avec succès');
    }
    
    // Supprimer l'audio
    clearAudioBtn.addEventListener('click', function() {
        audioPlayer.src = '';
        audioFileInput.value = '';
        audioWrapper.style.display = 'none';
        clearAudioBtn.classList.remove('visible');
        fileName.textContent = 'Charger un fichier audio';
        if (fileMeta) fileMeta.textContent = '';
        verseTimeline.replaceAll();
        updateVerseList();
        currentTimeDisplay.textContent = '0.00';
        showNotification('Audio supprimé');
    });
    
    // Contrôles de temps personnalisés
    function seekBy(timeChange) {
        timeSource.seek(Math.max(0, Math.min(audioPlayer.duration, timeSource.now() + timeChange)));
        updateTimeDisplay();
    }

    timeControlBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            seekBy(parseFloat(this.getAttribute('data-time')));
        });
    });

    // Bouton play/pause personnalisé
    function togglePlayPause() {
        if (!timeSource.isReady()) {
            showNotification('Veuillez charger un fichier audio d\'abord');
            return;
        }

        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    }

    playPauseBtn.addEventListener('click', togglePlayPause);

    // Raccourcis clavier : espace = lecture/pause, c/v/b = reculer de
    // 5/2/1s, n/,/; = avancer de 1/2/5s. Ignorés si le focus est dans un
    // champ de saisie (numéro de sourate/verset, zone d'export) pour ne
    // pas interférer avec la frappe.
    const KEY_SEEK_SECONDS = { c: -5, v: -2, b: -1, n: 1, ',': 2, ';': 5 };

    document.addEventListener('keydown', function(e) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (!timeSource.isReady()) return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
            return;
        }

        const seconds = KEY_SEEK_SECONDS[e.key.toLowerCase()];
        if (seconds !== undefined) {
            e.preventDefault();
            seekBy(seconds);
        }
    });

    // Synchroniser l'icône avec l'état de l'audio
    audioPlayer.addEventListener('play', function() {
        playPauseBtn.classList.add('playing');
    });
    
    audioPlayer.addEventListener('pause', function() {
        playPauseBtn.classList.remove('playing');
    });
    
    audioPlayer.addEventListener('ended', function() {
        playPauseBtn.classList.remove('playing');
    });
    
    // Mettre à jour le timer
    audioPlayer.addEventListener('play', function() {
        updateTimer = setInterval(updateTimeDisplay, 100);
    });
    
    audioPlayer.addEventListener('pause', function() {
        clearInterval(updateTimer);
    });
    
    audioPlayer.addEventListener('ended', function() {
        clearInterval(updateTimer);
    });
    
    function updateTimeDisplay() {
        currentTimeDisplay.textContent = timeSource.now().toFixed(2);
    }

    // Afficher la durée une fois les métadonnées chargées
    audioPlayer.addEventListener('loadedmetadata', function() {
        if (fileMeta && audioPlayer.duration) {
            const dur = audioPlayer.duration.toFixed(2);
            fileMeta.textContent = `Durée: ${dur}s` + (lastFile ? ` • ${formatBytes(lastFile.size)}` : '');
        }
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B','KB','MB','GB','TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Marquer le début d'un verset
    startVerseBtn.addEventListener('click', function() {
        if (!timeSource.isReady()) {
            showNotification('Veuillez charger un fichier audio d\'abord');
            return;
        }
        const time = timeSource.now();
        const verseId = parseInt(verseIdInput.value) || 1;
        verseTimeline.startVerse(verseId, time);
        updateVerseList();
        showNotification(`Début de verset ${verseId} marqué`);
        verseIdInput.value = verseId + 1;
    });

    // Marquer la fin d'un verset
    endVerseBtn.addEventListener('click', function() {
        const result = verseTimeline.endVerse(timeSource.now());
        if (!result.ok) {
            showNotification(result.reason === 'no-verse' ? 'Aucun verset à terminer' : 'Ce verset a déjà une fin');
            return;
        }
        updateVerseList();
        showNotification('Fin de verset marquée');
    });
    
    // Copier tous les versets
    copyAllBtn.addEventListener('click', function() {
        if (verses.length === 0) {
            showNotification('Aucun verset à copier');
            return;
        }
        
        const text = formatVersesForCopy();
        navigator.clipboard.writeText(text)
            .then(() => showNotification('Versets copiés'))
            .catch(err => console.error('Erreur de copie:', err));
    });
    
    // Exporter les versets
    exportBtn.addEventListener('click', function() {
        if (verses.length === 0) {
            showNotification('Aucun verset à exporter');
            return;
        }
        exportText.value = formatVersesForExport();
        showNotification('Versets exportés');
    });
    
    // Occurrences : plusieurs entrées de `verses` peuvent partager le même
    // id (un verset repris plus loin dans la même partie audio, ou chargé
    // depuis EXISTING_TIMINGS où c'est aussi possible). Chaque entrée garde
    // ses propres start/end/words (déjà correct par construction, un
    // objet distinct par occurrence) — ceci ne fait qu'identifier/afficher
    // la position pour ne pas les confondre en marquant les mots.
    function getOccurrenceInfo(index) {
        return verseTimeline.getOccurrenceInfo(verses[index]);
    }

    let dragSrcVerse = null;

    function updateVerseList() {
        verseList.innerHTML = '';

        if (verses.length === 0) {
            verseList.innerHTML = '<p style="text-align: center; color: #86868b; padding: 20px;">Aucun verset marqué</p>';
            return;
        }

        verses.forEach((verse, index) => {
            const verseEntry = document.createElement('div');
            verseEntry.className = 'verse-entry';

            const verseText = document.createElement('span');
            const wordList = getWordList(verse.id);
            const wordsProgress = wordList ? ` — mots ${verse.words.length}/${wordList.length}` : '';
            const occ = getOccurrenceInfo(index);
            const occSuffix = occ ? ` (occurrence ${occ.position}/${occ.total})` : '';

            // startTime/endTime déjà enregistrés sont modifiables directement :
            // cliquer dessus ouvre un champ — saisir une valeur au clavier ET
            // Entrée, ou le bouton ⏱ pour reprendre la position audio
            // actuelle — sans passer par supprimer-et-refaire (qui en plus
            // efface la fin du verset précédent). Si des mots sont déjà
            // marqués, ils dépendent de l'ancienne limite (le dernier mot est
            // calé sur l'ancien verse.end par valeur, pas par référence) — on
            // les réinitialise pour ne pas laisser une incohérence
            // silencieuse, même logique que resetBtn plus bas.
            function commitTimeEdit(field, label, time) {
                const { hadWords } = verseTimeline.setBoundary(index, field, time);
                if (wordSession.getCurrentIndex() === index) forceCloseWordMode();
                showNotification(
                    `${label} du verset ${verse.id} réglée à ${time.toFixed(2)}s` +
                    (hadWords ? ' — mots réinitialisés (dépendaient de l\'ancienne limite)' : ''),
                );
                updateVerseList();
            }

            function makeEditableTime(field, label) {
                const span = document.createElement('span');
                span.className = 'editable-time';
                span.textContent = verse[field] !== null && verse[field] !== undefined
                    ? verse[field].toFixed(2)
                    : '?';
                span.title = 'Cliquer pour saisir une valeur ou reprendre la position audio actuelle';
                span.addEventListener('click', (e) => {
                    e.stopPropagation();

                    const wrapper = document.createElement('span');
                    wrapper.className = 'editable-time-editing';

                    const input = document.createElement('input');
                    input.type = 'number';
                    input.step = '0.01';
                    input.min = '0';
                    input.className = 'editable-time-input';
                    input.value = verse[field] !== null && verse[field] !== undefined
                        ? verse[field].toFixed(2)
                        : '';

                    const nowBtn = document.createElement('button');
                    nowBtn.type = 'button';
                    nowBtn.className = 'editable-time-now-btn';
                    nowBtn.textContent = '⏱';
                    nowBtn.title = 'Remplir avec la position audio actuelle';
                    // Empêche le mousedown de voler le focus du champ (donc
                    // d'en déclencher le blur) avant que le clic ne s'exécute.
                    nowBtn.addEventListener('mousedown', (ev) => ev.preventDefault());
                    nowBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if (!timeSource.isReady()) {
                            showNotification('Charge d\'abord un fichier audio');
                            return;
                        }
                        input.value = timeSource.now().toFixed(2);
                        input.focus();
                    });

                    let settled = false;
                    function commit() {
                        if (settled) return;
                        settled = true;
                        const value = parseFloat(input.value);
                        if (Number.isNaN(value) || value < 0) {
                            showNotification('Valeur invalide — modification annulée');
                            updateVerseList();
                            return;
                        }
                        commitTimeEdit(field, label, value);
                    }
                    function cancel() {
                        if (settled) return;
                        settled = true;
                        updateVerseList();
                    }

                    input.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
                        else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
                    });
                    input.addEventListener('blur', () => {
                        setTimeout(() => {
                            if (document.activeElement !== input) commit();
                        }, 0);
                    });
                    input.addEventListener('click', (ev) => ev.stopPropagation());

                    wrapper.appendChild(input);
                    wrapper.appendChild(nowBtn);
                    span.replaceWith(wrapper);
                    input.focus();
                    input.select();
                });
                return span;
            }

            verseText.appendChild(document.createTextNode(`{ id: ${verse.id}, startTime: `));
            verseText.appendChild(makeEditableTime('start', 'Début'));
            verseText.appendChild(document.createTextNode(', endTime: '));
            verseText.appendChild(makeEditableTime('end', 'Fin'));
            verseText.appendChild(document.createTextNode(` },${wordsProgress}${occSuffix}`));

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'verse-actions';

            const seekBtn = document.createElement('button');
            seekBtn.className = 'seek-btn verse-action-btn';
            seekBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            seekBtn.title = 'Avancer l\'audio au début de ce verset';
            seekBtn.disabled = !timeSource.isReady();
            seekBtn.addEventListener('click', () => {
                timeSource.seek(verse.start);
                updateTimeDisplay();
                showNotification(`Audio avancé à ${verse.start.toFixed(2)}s (verset ${verse.id})`);
            });

            const wordsBtn = document.createElement('button');
            wordsBtn.className = 'words-btn verse-action-btn';
            wordsBtn.textContent = 'Mots';
            wordsBtn.disabled = !wordList || verse.end === null;
            wordsBtn.title = !wordList
                ? 'Pas de données de mots pour ce verset'
                : verse.end === null
                    ? 'Marque d\'abord la fin du verset'
                    : 'Marquer les mots de ce verset';
            wordsBtn.addEventListener('click', () => tryOpenWordMode(index));

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn verse-action-btn';
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
            copyBtn.addEventListener('click', () => {
                const text = `${verseTimeline.serializeVerse(verse)},`;
                navigator.clipboard.writeText(text)
                    .then(() => showNotification('Verset copié'))
                    .catch(err => console.error('Erreur de copie:', err));
            });
            
            const resetBtn = document.createElement('button');
            resetBtn.className = 'end-btn verse-action-btn';
            resetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
            resetBtn.addEventListener('click', () => {
                const wasOpenInWordMode = wordSession.getCurrentIndex() === index;
                verseTimeline.deleteVerse(index);
                if (wasOpenInWordMode) {
                    forceCloseWordMode();
                }
                const currentId = parseInt(verseIdInput.value) || 1;
                verseIdInput.value = Math.max(1, currentId - 1);
                updateVerseList();
                showNotification('Verset supprimé');
            });
            
            actionsDiv.appendChild(seekBtn);
            actionsDiv.appendChild(wordsBtn);
            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(resetBtn);

            verseEntry.appendChild(verseText);
            verseEntry.appendChild(actionsDiv);

            // Glisser-déposer pour réordonner : utile quand un verset oublié
            // est marqué après coup et arrive en dernier dans le tableau
            // alors qu'il devrait être plus tôt (l'ordre compte pour
            // resetBtn — qui referme le verset PRÉCÉDENT dans le tableau —
            // et pour "Verset suivant" en mode mots). Autorisé même pendant
            // que le mode mots est ouvert : wordSession retient le verset en
            // cours par référence d'objet, pas par index — un réordonnancement
            // ne peut donc rien invalider, aucune resynchronisation requise.
            // Désactivé uniquement sur le verset encore en cours (end ===
            // null) : "Fin verset" cible toujours le dernier élément du
            // tableau, le déplacer casserait cette hypothèse.
            const canReorderVerse = verseTimeline.canReorder(verse);
            if (canReorderVerse) {
                verseEntry.draggable = true;
                verseEntry.title = 'Glisser pour réordonner';
                verseEntry.addEventListener('dragstart', () => {
                    dragSrcVerse = verse;
                    verseEntry.classList.add('dragging');
                });
                verseEntry.addEventListener('dragend', () => {
                    verseEntry.classList.remove('dragging');
                    verseList.querySelectorAll('.verse-entry').forEach((r) => r.classList.remove('drag-over'));
                });
                verseEntry.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    verseEntry.classList.add('drag-over');
                });
                verseEntry.addEventListener('dragleave', () => {
                    verseEntry.classList.remove('drag-over');
                });
                verseEntry.addEventListener('drop', (e) => {
                    e.preventDefault();
                    verseEntry.classList.remove('drag-over');
                    if (dragSrcVerse === null || dragSrcVerse === verse) return;

                    verseTimeline.reorder(dragSrcVerse, verse);
                    dragSrcVerse = null;

                    updateVerseList();
                    showNotification('Versets réordonnés');
                });
            }

            verseList.appendChild(verseEntry);
        });
    }
    
    // Fenêtre de confirmation commune : open()/requestClose()/
    // advanceToNextWordableVerse() ont détecté une occurrence (mot ou
    // verset) encore ouverte — demande confirmation puis rejoue l'action
    // avec { force: true }. La garde vit dans wordSession elle-même, donc
    // aucun appelant ne peut plus l'oublier (contrairement à l'ancien code,
    // où le bouton "Mots" de la liste ouvrait directement sans passer par
    // cette vérification).
    function withLeaveConfirm(attempt) {
        const result = attempt();
        if (result.ok) return result;
        if (result.reason === 'open-extra-occurrence') {
            const confirmed = window.confirm(
                `Une occurrence supplémentaire est encore ouverte sur le mot ${result.wordIndex + 1} ` +
                '(jamais refermée). Continuer quand même la laissera incomplète (fin "?"). Continuer ?'
            );
            return confirmed ? attempt({ force: true }) : result;
        }
        if (result.reason === 'open-verse-occurrence') {
            const confirmed = window.confirm(
                `Une nouvelle occurrence de ce verset est encore ouverte depuis ${result.pendingStart.toFixed(2)}s ` +
                '(jamais refermée). Continuer quand même la laissera incomplète (fin "?"). Continuer ?'
            );
            return confirmed ? attempt({ force: true }) : result;
        }
        return result;
    }

    // Effets de bord d'une ouverture réussie (open() ou
    // advanceToNextWordableVerse()) : positionner l'audio, afficher le
    // panneau, verrouiller Début/Fin verset. Retourne false sans rien faire
    // si le résultat est un échec.
    function applyOpenResult(result) {
        if (!result.ok) return false;
        // Avance directement l'audio au début du verset — pas besoin de
        // rechercher la position à la main avant de marquer les mots.
        timeSource.seek(result.seekTime);
        updateTimeDisplay();
        wordModeSection.style.display = 'block';
        wordModeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Verrouille Début/Fin verset pendant qu'on marque des mots — c'est
        // précisément le moment où un clic par réflexe dessus abîmerait le
        // verset en cours.
        verseMarkingLocked = true;
        renderVerseLock();
        renderWordMode();
        // Réordonner la liste des versets est désactivé tant que le mode
        // mots est ouvert (voir canReorderVerse dans updateVerseList) — sans
        // ce ré-affichage, les lignes gardaient leur ancien état draggable
        // jusqu'au prochain rendu fortuit (ex. marquer un mot).
        updateVerseList();
        return true;
    }

    // Ouvre le mode mots pour le verset à `index` — point d'entrée unique,
    // utilisé par le bouton "Mots" de la liste comme par la navigation
    // interne au panneau mots.
    function tryOpenWordMode(index) {
        const result = withLeaveConfirm((opts) => wordSession.open(index, opts));
        if (applyOpenResult(result)) return;
        if (result.reason === 'not-markable') {
            showNotification('Marque d\'abord la fin du verset, ou pas de données de mots pour ce verset');
        }
    }

    function applyCloseEffects() {
        wordModeSection.style.display = 'none';
        verseMarkingLocked = false;
        renderVerseLock();
        updateVerseList();
    }

    // Ferme le mode mots sans confirmation — utilisé quand le verset en
    // cours de marquage vient d'être supprimé ou dont une borne vient
    // d'être modifiée : il n'y a alors plus rien à préserver.
    function forceCloseWordMode() {
        wordSession.requestClose({ force: true });
        applyCloseEffects();
    }

    function notifyShrunk(shrunk) {
        if (shrunk) {
            showNotification(`Fin du dernier mot resserrée à ${shrunk.shrunkTo.toFixed(2)}s (occurrence détectée avant)`);
        }
    }

    // Affiche tous les mots du verset (pas seulement le mot courant) dans
    // une bande défilante, avec le mot actif toujours recentré — pour voir
    // les mots voisins pendant le marquage, sans changer le comportement
    // des boutons existants.
    function renderWordCarousel(wordList, activeIndex) {
        wordCarouselTrack.innerHTML = wordList
            .map(
                (w, i) =>
                    `<span class="carousel-word${i === activeIndex ? ' active' : ''}" data-index="${i}">${w}</span>`,
            )
            .join('');

        const activeEl = wordCarouselTrack.querySelector('.carousel-word.active');
        if (!activeEl) return;

        // Mesure l'écart entre le centre du mot actif et le centre du
        // viewport, puis ajuste translateX de cet écart — fonctionne en
        // coordonnées écran, donc indépendamment du sens RTL/LTR.
        const viewportRect = wordCarousel.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const match = /translateX\(([-\d.]+)px\)/.exec(
            wordCarouselTrack.style.transform,
        );
        const currentX = match ? parseFloat(match[1]) : 0;
        const delta =
            viewportRect.left + viewportRect.width / 2 - (activeRect.left + activeRect.width / 2);
        wordCarouselTrack.style.transform = `translateX(${currentX + delta}px)`;
    }

    // Peint le panneau mots à partir de wordSession.describe() — toutes les
    // règles "quoi afficher/activer quand" vivent dans la session ; cette
    // fonction ne fait que poser des chaînes et des attributs dans le DOM.
    function renderWordMode() {
        if (!wordSession.isOpen()) return;
        const snap = wordSession.describe();

        wordModeVerseId.textContent = snap.verseId + (snap.occurrenceLabel ? ` ${snap.occurrenceLabel}` : '');
        prevWordBtn.disabled = !snap.canGoPrev;
        nextWordBtn.disabled = !snap.canGoNext;
        seekNextVerseWordsBtn.disabled = !timeSource.isReady() || !snap.hasNextVerse;

        wordProgress.textContent = snap.wordProgressText;
        renderWordCarousel(snap.words, snap.viewIndex);

        // Marquer une nouvelle occurrence de CE verset (pas d'un mot) sans
        // quitter le mode mots — contourne délibérément verseMarkingLocked
        // (voir addOrCloseVerseOccurrence dans word-marking-session.js).
        addVerseOccurrenceBtn.textContent = snap.addOccurrenceLabel;
        addVerseOccurrenceBtn.title = snap.addOccurrenceLabel.startsWith('Terminer')
            ? 'Marque la fin de cette nouvelle occurrence à la position audio actuelle'
            : 'Le verset répète plus loin dans l\'audio : marque cette nouvelle occurrence sans quitter le mode mots';

        if (snap.isPendingSlot) {
            markWordBtn.style.display = '';
            correctWordBtn.style.display = 'none';
            terminateWordBtn.style.display = 'none';
            markWordBtn.disabled = snap.wordMarkingLocked;
            extraOccurrencesSection.style.display = 'none';
        } else {
            markWordBtn.style.display = 'none';
            correctWordBtn.style.display = '';
            correctWordBtn.textContent = `Recaler le début ici (actuel : ${snap.primary.start.toFixed(2)}s)`;
            correctWordBtn.disabled = snap.wordMarkingLocked;

            // Seul le mot le plus récemment marqué peut avoir sa principale
            // encore ouverte — tant que ce n'est pas fermé, ajouter une
            // occurrence supplémentaire ici n'a pas de sens. On propose donc
            // de la fermer directement au lieu d'afficher la section
            // occurrences.
            terminateWordBtn.style.display = snap.primary.open ? '' : 'none';
            terminateWordBtn.disabled = snap.wordMarkingLocked;
            extraOccurrencesSection.style.display = snap.primary.open ? 'none' : '';
            if (!snap.primary.open) renderExtraOccurrences(snap.extra);
        }

        // Chaque ligne est cliquable (pas seulement le numéro visuellement,
        // toute la ligne pour une cible plus facile) : place directement
        // wordViewIndex dessus, équivalent à cliquer ◀/▶ plusieurs fois mais
        // en un clic — pour corriger un mot déjà marqué sans naviguer pas à
        // pas depuis la position courante.
        wordMarkedList.innerHTML = snap.markedWords
            .map((w) => {
                const extraSuffix = w.extraCount > 0 ? ` (+${w.extraCount} occurrence${w.extraCount > 1 ? 's' : ''})` : '';
                // <bdi> isole le mot arabe : sans ça, Chrome réordonne
                // visuellement toute la ligne (nombres et tiret compris)
                // autour du texte RTL, même avec dir="ltr" sur le conteneur.
                return `<div class="word-marked-row${w.isActive ? ' active' : ''}" data-index="${w.index}" title="Revoir/corriger ce mot">${w.isActive ? '→ ' : '　'}${w.index + 1}. <bdi>${w.arabic}</bdi> — ${w.start.toFixed(2)} → ${w.end !== null ? w.end.toFixed(2) : '?'}${extraSuffix}</div>`;
            })
            .join('');

        wordMarkedList.querySelectorAll('.word-marked-row').forEach((row) => {
            row.addEventListener('click', () => {
                wordSession.setViewIndex(parseInt(row.dataset.index, 10));
                renderWordMode();
            });
        });

        // Garde le mot le plus pertinent toujours visible — sans ça, une
        // fois la liste plus haute que les 120px de la zone scrollable, il
        // faut scroller à la main pour le revoir. Deux cas : un mot déjà
        // marqué est en cours de relecture (.active présent, ex. après
        // ◀/▶/clic sur une ligne) ; ou on vient de marquer le dernier mot et
        // wordViewIndex pointe sur l'emplacement "à marquer" suivant, qui
        // n'existe pas encore dans cette liste — dans ce cas c'est la
        // DERNIÈRE ligne (le mot qu'on vient de finir) qu'on veut garder
        // visible.
        const activeRow = wordMarkedList.querySelector('.word-marked-row.active');
        const rowToShow = activeRow || wordMarkedList.lastElementChild;
        if (rowToShow) {
            rowToShow.scrollIntoView({ block: 'nearest' });
        }
    }

    // Occurrences supplémentaires : le cheikh peut redire un mot, ou une
    // suite de mots, plus tard dans le même passage. Comme le marquage
    // principal, ça enchaîne : démarrer une occurrence sur un mot puis
    // naviguer vers le mot suivant pour en démarrer une autre ferme
    // automatiquement la précédente au même instant. Un seul mot répété
    // isolément : un clic pour démarrer, un clic (sur ce même mot) pour
    // terminer. `extra` vient de wordSession.describe() : le calcul "quoi
    // afficher" est déjà fait, cette fonction ne fait que peindre et câbler
    // les événements DOM.
    function renderExtraOccurrences(extra) {
        toggleExtraOccurrenceBtn.textContent = extra.toggleLabel;
        toggleExtraOccurrenceBtn.disabled = wordSession.isWordMarkingLocked();

        // "Mot suivant" : ferme l'occurrence en cours ET avance directement
        // au mot suivant en un seul clic, pour enchaîner une phrase répétée
        // sans naviguer à la main avec ▶ entre chaque mot.
        advanceOccurrenceBtn.style.display = extra.canAdvance ? '' : 'none';
        advanceOccurrenceBtn.disabled = wordSession.isWordMarkingLocked();

        if (extra.activeWarning) {
            activeExtraWarning.textContent = `⚠ Occurrence encore ouverte sur le mot ${extra.activeWarning.wordIndex + 1} depuis ${extra.activeWarning.openStart.toFixed(2)}s — navigue jusque-là pour la terminer, ou clique ici pour l'y rattacher et l'enchaîner.`;
            activeExtraWarning.style.display = '';
        } else {
            activeExtraWarning.style.display = 'none';
        }

        // Glisser-déposer pour réordonner : utile quand une occurrence
        // antérieure (chronologiquement) est ajoutée après coup. Désactivé
        // tant qu'une occurrence de ce mot est encore ouverte (voir
        // reorderExtraOccurrence dans word-marking-session.js).
        const canReorder = extra.canReorder;

        extraOccurrencesList.innerHTML = extra.items.length === 0
            ? '<span style="color: var(--text-secondary); font-size: 13px;">Aucune occurrence supplémentaire</span>'
            : extra.items.map((e, i) => `<span class="extra-occurrence-row" data-extra-index="${i}"${canReorder ? ' draggable="true" title="Glisser pour réordonner"' : ''}>${i + 1}. ${e.start.toFixed(2)} → ${e.end !== null ? e.end.toFixed(2) : '…'}<button type="button" class="remove-extra-btn" data-extra-index="${i}" title="Supprimer">×</button></span>`).join('');

        extraOccurrencesList.querySelectorAll('.remove-extra-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.extraIndex, 10);
                wordSession.removeExtraOccurrence(idx);
                renderWordMode();
                updateVerseList();
            });
        });

        if (canReorder) {
            let dragSrcIndex = null;
            const rows = extraOccurrencesList.querySelectorAll('.extra-occurrence-row');
            rows.forEach((row, i) => {
                row.addEventListener('dragstart', () => {
                    dragSrcIndex = i;
                    row.classList.add('dragging');
                });
                row.addEventListener('dragend', () => {
                    row.classList.remove('dragging');
                    rows.forEach((r) => r.classList.remove('drag-over'));
                });
                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    row.classList.add('drag-over');
                });
                row.addEventListener('dragleave', () => {
                    row.classList.remove('drag-over');
                });
                row.addEventListener('drop', (e) => {
                    e.preventDefault();
                    row.classList.remove('drag-over');
                    if (dragSrcIndex === null || dragSrcIndex === i) return;
                    wordSession.reorderExtraOccurrence(dragSrcIndex, i);
                    dragSrcIndex = null;
                    renderWordMode();
                    updateVerseList();
                    showNotification('Occurrences réordonnées');
                });
            });
        }
    }

    // NB : on ne ferme PAS automatiquement un mot principal encore ouvert
    // (.end === null) quand une occurrence démarre ailleurs — contrairement
    // au dernier mot du verset (voir shrinkLastWordEndIfNeeded dans
    // word-marking-session.js, dont la fin par défaut est verse.end, une
    // vraie limite de bloc), un mot en cours de marquage peut légitimement
    // reprendre après une brève incise. Une fermeture automatique ici s'est
    // révélée prématurée en pratique (elle se produisait avant que le mot
    // ait fini d'être dit, obligeant à un contournement pour corriger
    // ensuite). Le flux normal — marquer le mot suivant — referme
    // correctement ce mot dès que l'utilisateur est prêt, sans avoir besoin
    // de deviner à l'avance.

    toggleExtraOccurrenceBtn.addEventListener('click', function() {
        if (!wordSession.isOpen() || !timeSource.isReady()) return;
        const time = timeSource.now();
        const result = wordSession.toggleExtraOccurrence(time);
        if (!result.ok) {
            // Ne devrait pas être cliquable dans cet état (la section est
            // masquée si la principale est ouverte, voir renderWordMode) —
            // gardé ici en filet de sécurité.
            if (result.reason === 'primary-open') {
                showNotification('Ce mot a encore une occurrence principale ouverte — termine-la d\'abord ("Terminer ce mot ici").');
            }
            return;
        }
        if (result.action === 'closed') {
            showNotification('Occurrence supplémentaire terminée');
        } else if (result.shrunk) {
            notifyShrunk(result.shrunk);
        } else {
            showNotification('Occurrence en cours — navigue au mot suivant pour l\'enchaîner, ou reclique ici pour la terminer');
        }
        renderWordMode();
        updateVerseList();
    });

    // Ferme directement la principale encore ouverte du mot affiché (seul
    // le mot le plus récemment marqué peut être dans ce cas). Équivalent
    // manuel de ce qui se passait avant automatiquement : l'utilisateur
    // choisit explicitement l'instant, plutôt qu'une fermeture devinée à
    // l'avance.
    terminateWordBtn.addEventListener('click', function() {
        if (!wordSession.isOpen() || !timeSource.isReady()) return;
        const time = timeSource.now();
        const result = wordSession.terminateWord(time);
        if (!result.ok) return;
        renderWordMode();
        updateVerseList();
        showNotification(`Mot ${result.wordIndex + 1} terminé à ${time.toFixed(2)}s`);
    });

    // Marque une nouvelle occurrence du VERSET en cours (pas d'un mot) —
    // le cheikh répète le verset entier plus loin dans le même passage.
    addVerseOccurrenceBtn.addEventListener('click', function() {
        if (!wordSession.isOpen() || !timeSource.isReady()) return;
        const time = timeSource.now();
        const result = wordSession.addOrCloseVerseOccurrence(time);
        if (!result.ok) {
            if (result.reason === 'end-before-start') {
                showNotification('La fin doit être après le début de cette occurrence');
            }
            return;
        }
        showNotification(
            result.action === 'closed'
                ? `Occurrence du verset ${result.verseId} terminée à ${time.toFixed(2)}s`
                : `Nouvelle occurrence du verset ${result.verseId} démarrée à ${time.toFixed(2)}s`,
        );
        renderWordMode();
        updateVerseList();
    });

    // Ferme l'occurrence ouverte sur le mot courant ET en ouvre une sur le
    // mot suivant, au même instant — un seul clic pour enchaîner une
    // phrase répétée, sans passer par les flèches ▶ entre chaque mot.
    advanceOccurrenceBtn.addEventListener('click', function() {
        if (!wordSession.isOpen() || !timeSource.isReady()) return;
        const time = timeSource.now();
        const result = wordSession.advanceOccurrence(time);
        if (!result.ok) {
            if (result.reason === 'target-not-marked') {
                showNotification('Le mot suivant n\'a pas encore d\'occurrence principale — marque-le d\'abord normalement.');
            } else if (result.reason === 'target-primary-open') {
                showNotification('Le mot suivant a encore une occurrence principale ouverte — termine-la d\'abord ("Terminer ce mot ici") avant d\'y enchaîner une occurrence.');
            }
            return;
        }
        if (result.shrunk) {
            notifyShrunk(result.shrunk);
        } else {
            showNotification('Occurrence enchaînée sur le mot suivant');
        }
        renderWordMode();
        updateVerseList();
    });

    prevWordBtn.addEventListener('click', function() {
        wordSession.prev();
        renderWordMode();
    });

    nextWordBtn.addEventListener('click', function() {
        wordSession.next();
        renderWordMode();
    });

    markWordBtn.addEventListener('click', function() {
        if (!wordSession.isOpen() || !timeSource.isReady()) return;
        const time = timeSource.now();
        const currentVerseId = verses[wordSession.getCurrentIndex()].id;
        const result = wordSession.markWord(time);
        if (!result.ok) return;
        if (result.allWordsMarked) {
            showNotification(`Verset ${currentVerseId} : tous les mots sont marqués`);
        }
        renderWordMode();
        updateVerseList();
    });

    // Recale le début d'un mot déjà marqué sans devoir tout annuler après
    // lui. Comme les mots d'un verset se suivent sans blanc, redéfinir le
    // début du mot N déplace aussi la fin du mot N-1 au même instant — la
    // continuité est ainsi préservée automatiquement. Ne touche que
    // l'occurrence principale (index 0) ; les occurrences supplémentaires
    // se gèrent séparément.
    correctWordBtn.addEventListener('click', function() {
        if (!wordSession.isOpen() || !timeSource.isReady()) return;
        const time = timeSource.now();
        const result = wordSession.correctWord(time);
        if (!result.ok) return;
        renderWordMode();
        updateVerseList();
        showNotification(`Début du mot ${result.wordIndex + 1} recalé à ${time.toFixed(2)}s`);
    });

    undoWordBtn.addEventListener('click', function() {
        const result = wordSession.undoWord();
        if (!result.ok) {
            showNotification('Aucun mot à annuler');
            return;
        }
        renderWordMode();
        updateVerseList();
        showNotification('Dernier mot annulé');
    });

    closeWordModeBtn.addEventListener('click', function() {
        const result = withLeaveConfirm((opts) => wordSession.requestClose(opts));
        if (!result.ok) return;
        applyCloseEffects();
    });

    // Avance l'audio au début du verset suivant sans changer le verset
    // ouvert dans le panneau mots — utile pour repérer où il commence
    // (ex. pour caler la fin du dernier mot) sans perdre le contexte de
    // marquage en cours (contrairement à "Verset suivant" qui bascule dessus).
    seekNextVerseWordsBtn.addEventListener('click', function() {
        if (!wordSession.isOpen() || !timeSource.isReady()) return;
        const nextVerse = verses[wordSession.getCurrentIndex() + 1];
        if (!nextVerse) {
            showNotification('Aucun verset suivant');
            return;
        }
        timeSource.seek(nextVerse.start);
        updateTimeDisplay();
        showNotification(`Audio avancé à ${nextVerse.start.toFixed(2)}s (verset ${nextVerse.id})`);
    });

    // Passe directement au mode mots du prochain verset marquable (données
    // de mots dispo + déjà borné), sans repasser par la liste principale —
    // la recherche et la garde vivent dans
    // wordSession.advanceToNextWordableVerse().
    nextVerseWordsBtn.addEventListener('click', function() {
        const result = withLeaveConfirm((opts) => wordSession.advanceToNextWordableVerse(opts));
        if (applyOpenResult(result)) return;
        if (result.reason === 'no-next-verse') {
            showNotification('Aucun verset suivant marquable après celui-ci');
        }
    });

    // La sérialisation d'un verset (fragment `{ id, startTime, endTime,
    // words? }`) vit dans verse-timeline.js — voir
    // VerseTimeline.serializeVerse. Ici on ne fait qu'ajouter la
    // ponctuation propre à chaque usage (copie groupée vs export).
    function formatVersesForCopy() {
        return verses.map((verse) => `${verseTimeline.serializeVerse(verse)},`).join('\n');
    }

    function formatVersesForExport() {
        return verses.map((verse) => `[${verseTimeline.serializeVerse(verse)},]`).join('\n');
    }
    
    function showNotification(message) {
        notification.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ${message}
        `;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2500);
    }
});