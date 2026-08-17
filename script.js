// WORDS_BY_SURAH (data/words-by-surah.js) et EXISTING_TIMINGS
// (data/existing-timings.js) sont générées depuis tafsir-app — voir ces
// fichiers pour leur origine. Chargées comme <script> avant celui-ci.

document.addEventListener('DOMContentLoaded', function() {
    const audioPlayer = document.getElementById('audioPlayer');
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
    const wordCurrent = document.getElementById('wordCurrent');
    const markWordBtn = document.getElementById('markWordBtn');
    const correctWordBtn = document.getElementById('correctWordBtn');
    const undoWordBtn = document.getElementById('undoWordBtn');
    const closeWordModeBtn = document.getElementById('closeWordModeBtn');
    const nextVerseWordsBtn = document.getElementById('nextVerseWordsBtn');
    const extraOccurrencesSection = document.getElementById('extraOccurrencesSection');
    const extraOccurrencesList = document.getElementById('extraOccurrencesList');
    const toggleExtraOccurrenceBtn = document.getElementById('toggleExtraOccurrenceBtn');
    const activeExtraWarning = document.getElementById('activeExtraWarning');
    const wordMarkedList = document.getElementById('wordMarkedList');
    const prevWordBtn = document.getElementById('prevWordBtn');
    const nextWordBtn = document.getElementById('nextWordBtn');
    const surahIdInput = document.getElementById('surahId');
    const surahWordsStatus = document.getElementById('surahWordsStatus');
    const existingTimingsList = document.getElementById('existingTimingsList');
    const toggleVerseLockBtn = document.getElementById('toggleVerseLock');
    const toggleWordLockBtn = document.getElementById('toggleWordLock');

    let verses = [];
    let updateTimer;
    let wordModeVerseIndex = null;
    // Index du mot affiché dans le panneau (navigable via les flèches),
    // distinct du nombre de mots déjà marqués — permet de revoir/corriger
    // un mot précédent sans devoir tout annuler jusque-là.
    let wordViewIndex = 0;
    // Index du mot dont la dernière occurrence supplémentaire est encore
    // ouverte (null si aucune) — permet d'enchaîner l'occurrence sur le
    // mot suivant en navigant, comme le marquage principal. Remis à zéro
    // à chaque ouverture/fermeture du mode mots.
    let activeExtraWordIndex = null;

    // Verrous anti-clic-réflexe : Début/Fin verset et Marquer ce mot sont
    // des habitudes de clic — utiles quand on marque activement, gênants
    // (et destructeurs) le reste du temps. Déverrouillés par défaut ;
    // ouvrir le mode mots verrouille automatiquement les versets, le
    // fermer les redéverrouille (voir openWordMode/closeWordMode).
    let verseMarkingLocked = false;
    let wordMarkingLocked = false;

    function renderVerseLock() {
        toggleVerseLockBtn.classList.toggle('locked', verseMarkingLocked);
        toggleVerseLockBtn.classList.toggle('unlocked', !verseMarkingLocked);
        startVerseBtn.disabled = verseMarkingLocked;
        endVerseBtn.disabled = verseMarkingLocked;
    }

    function renderWordLock() {
        toggleWordLockBtn.classList.toggle('locked', wordMarkingLocked);
        toggleWordLockBtn.classList.toggle('unlocked', !wordMarkingLocked);
        if (wordModeVerseIndex !== null) {
            renderWordMode();
        } else {
            markWordBtn.disabled = wordMarkingLocked;
        }
    }

    toggleVerseLockBtn.addEventListener('click', function() {
        verseMarkingLocked = !verseMarkingLocked;
        renderVerseLock();
        showNotification(verseMarkingLocked ? 'Marquage de versets verrouillé' : 'Marquage de versets déverrouillé');
    });

    toggleWordLockBtn.addEventListener('click', function() {
        wordMarkingLocked = !wordMarkingLocked;
        renderWordLock();
        showNotification(wordMarkingLocked ? 'Marquage de mots verrouillé' : 'Marquage de mots déverrouillé');
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
                verses = part.timings.map((t) => ({
                    id: t.id,
                    start: t.startTime,
                    end: t.endTime,
                    words: [],
                }));
                const lastId = verses.length > 0 ? verses[verses.length - 1].id : 0;
                verseIdInput.value = lastId + 1;
                closeWordMode();
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
        verses = [];
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
        verses = [];
        updateVerseList();
        currentTimeDisplay.textContent = '0.00';
        showNotification('Audio supprimé');
    });
    
    // Contrôles de temps personnalisés
    timeControlBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const timeChange = parseFloat(this.getAttribute('data-time'));
            audioPlayer.currentTime = Math.max(0, Math.min(audioPlayer.duration, audioPlayer.currentTime + timeChange));
            updateTimeDisplay();
        });
    });
    
    // Bouton play/pause personnalisé
    playPauseBtn.addEventListener('click', function() {
        if (!audioPlayer.src) {
            showNotification('Veuillez charger un fichier audio d\'abord');
            return;
        }
        
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
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
        const currentTime = audioPlayer.currentTime;
        currentTimeDisplay.textContent = currentTime.toFixed(2);
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
        if (!audioPlayer.src) {
            showNotification('Veuillez charger un fichier audio d\'abord');
            return;
        }
        const time = audioPlayer.currentTime;
        const verseId = parseInt(verseIdInput.value) || 1;
        verses.push({ id: verseId, start: time, end: null, words: [] });
        updateVerseList();
        showNotification(`Début de verset ${verseId} marqué`);
        verseIdInput.value = verseId + 1;
    });
    
    // Marquer la fin d'un verset
    endVerseBtn.addEventListener('click', function() {
        if (verses.length === 0) {
            showNotification('Aucun verset à terminer');
            return;
        }
        
        const lastVerse = verses[verses.length - 1];
        if (lastVerse.end !== null) {
            showNotification('Ce verset a déjà une fin');
            return;
        }
        
        const time = audioPlayer.currentTime;
        lastVerse.end = time;
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
        const verse = verses[index];
        const sameId = verses.filter((v) => v.id === verse.id);
        if (sameId.length <= 1) return null;
        const position = verses.slice(0, index + 1).filter((v) => v.id === verse.id).length;
        return { position, total: sameId.length };
    }

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
            verseText.textContent = `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },${wordsProgress}${occSuffix}`;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'verse-actions';

            const seekBtn = document.createElement('button');
            seekBtn.className = 'seek-btn verse-action-btn';
            seekBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            seekBtn.title = 'Avancer l\'audio au début de ce verset';
            seekBtn.disabled = !audioPlayer.src;
            seekBtn.addEventListener('click', () => {
                audioPlayer.currentTime = verse.start;
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
            wordsBtn.addEventListener('click', () => openWordMode(index));

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn verse-action-btn';
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
            copyBtn.addEventListener('click', () => {
                const text = `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'}${formatWordsField(verse)} },`;
                navigator.clipboard.writeText(text)
                    .then(() => showNotification('Verset copié'))
                    .catch(err => console.error('Erreur de copie:', err));
            });
            
            const resetBtn = document.createElement('button');
            resetBtn.className = 'end-btn verse-action-btn';
            resetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
            resetBtn.addEventListener('click', () => {
                verses.splice(index, 1);
                if (index > 0) {
                    verses[index - 1].end = null;
                    // Le dernier mot du verset précédent était calé sur son
                    // ancienne fin (voir markWordBtn) — devenue invalide.
                    verses[index - 1].words = [];
                }
                if (wordModeVerseIndex === index) {
                    closeWordMode();
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
            verseList.appendChild(verseEntry);
        });
    }
    
    // Ouvre le mode mots pour un verset (déjà borné start+end).
    function openWordMode(index) {
        const verse = verses[index];
        const wordList = getWordList(verse.id);
        if (!wordList || verse.end === null) return;

        wordModeVerseIndex = index;
        wordViewIndex = verse.words.length;
        activeExtraWordIndex = null;
        const occ = getOccurrenceInfo(index);
        wordModeVerseId.textContent = verse.id + (occ ? ` (occurrence ${occ.position}/${occ.total})` : '');
        // Avance directement l'audio au début du verset — pas besoin de
        // rechercher la position à la main avant de marquer les mots.
        audioPlayer.currentTime = verse.start;
        updateTimeDisplay();
        wordModeSection.style.display = 'block';
        wordModeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Verrouille Début/Fin verset pendant qu'on marque des mots — c'est
        // précisément le moment où un clic par réflexe dessus abîmerait le
        // verset en cours.
        verseMarkingLocked = true;
        renderVerseLock();
        renderWordMode();
    }

    function closeWordMode() {
        wordModeVerseIndex = null;
        wordModeSection.style.display = 'none';
        verseMarkingLocked = false;
        activeExtraWordIndex = null;
        renderVerseLock();
    }

    // Vrai si une occurrence supplémentaire est en cours (démarrée, pas
    // encore terminée) — sert à avertir avant de fermer/changer de verset
    // sans l'avoir refermée, plutôt que de la laisser silencieusement
    // ouverte (fin `?` à l'export, comme c'est arrivé la première fois).
    function hasOpenExtraOccurrence() {
        if (wordModeVerseIndex === null || activeExtraWordIndex === null) return false;
        const occurrences = verses[wordModeVerseIndex].words[activeExtraWordIndex];
        return occurrences.length > 1 && occurrences[occurrences.length - 1].end === null;
    }

    function confirmLeavingOpenExtraOccurrence() {
        if (!hasOpenExtraOccurrence()) return true;
        return window.confirm(
            `Une occurrence supplémentaire est encore ouverte sur le mot ${activeExtraWordIndex + 1} ` +
            '(jamais refermée). Continuer quand même la laissera incomplète (fin "?"). Continuer ?'
        );
    }

    // `wordViewIndex` navigue parmi : les mots déjà marqués [0, doneCount-1]
    // (relecture/correction), PLUS un emplacement "à marquer" à l'index
    // doneCount tant que le verset n'est pas complet. Une fois complet, il
    // n'y a plus d'emplacement à marquer, seulement des mots à corriger.
    function renderWordMode() {
        const verse = verses[wordModeVerseIndex];
        const wordList = getWordList(verse.id);
        const total = wordList.length;
        const doneCount = verse.words.length;
        const maxIndex = doneCount < total ? doneCount : total - 1;
        wordViewIndex = Math.min(Math.max(wordViewIndex, 0), maxIndex);
        const isPendingSlot = wordViewIndex === doneCount && doneCount < total;

        prevWordBtn.disabled = wordViewIndex <= 0;
        nextWordBtn.disabled = wordViewIndex >= maxIndex;

        wordProgress.textContent = isPendingSlot
            ? `Mot ${wordViewIndex + 1} / ${total} — à marquer`
            : `Mot ${wordViewIndex + 1} / ${total}` + (doneCount >= total ? ' — tous les mots sont marqués' : ' (déjà marqué)');
        wordCurrent.textContent = wordList[wordViewIndex];

        if (isPendingSlot) {
            markWordBtn.style.display = '';
            correctWordBtn.style.display = 'none';
            markWordBtn.disabled = wordMarkingLocked;
            extraOccurrencesSection.style.display = 'none';
        } else {
            markWordBtn.style.display = 'none';
            correctWordBtn.style.display = '';
            extraOccurrencesSection.style.display = '';
            // occurrences[0] = occurrence principale (chaîne contiguë avec
            // les mots voisins) ; occurrences[1+] = occurrences
            // supplémentaires, indépendantes, gérées plus bas.
            const primary = verse.words[wordViewIndex][0];
            correctWordBtn.textContent = `Recaler le début ici (actuel : ${primary.start.toFixed(2)}s)`;
            correctWordBtn.disabled = wordMarkingLocked;
            renderExtraOccurrences();
        }

        wordMarkedList.innerHTML = verse.words
            .map((occurrences, i) => {
                const primary = occurrences[0];
                const extraCount = occurrences.length - 1;
                const extraSuffix = extraCount > 0 ? ` (+${extraCount} occurrence${extraCount > 1 ? 's' : ''})` : '';
                // <bdi> isole le mot arabe : sans ça, Chrome réordonne
                // visuellement toute la ligne (nombres et tiret compris)
                // autour du texte RTL, même avec dir="ltr" sur le conteneur.
                return `${i === wordViewIndex ? '→ ' : '　'}${i + 1}. <bdi>${wordList[i]}</bdi> — ${primary.start.toFixed(2)} → ${primary.end !== null ? primary.end.toFixed(2) : '?'}${extraSuffix}`;
            })
            .join('<br>');
    }

    // Occurrences supplémentaires : le cheikh peut redire un mot, ou une
    // suite de mots, plus tard dans le même passage. Comme le marquage
    // principal, ça enchaîne : démarrer une occurrence sur un mot puis
    // naviguer vers le mot suivant pour en démarrer une autre ferme
    // automatiquement la précédente au même instant (`activeExtraWordIndex`
    // retient sur quel mot l'occurrence est encore ouverte, quel que soit
    // le mot affiché à l'instant du clic). Un seul mot répété isolément :
    // un clic pour démarrer, un clic (sur ce même mot) pour terminer.
    function renderExtraOccurrences() {
        const verse = verses[wordModeVerseIndex];
        const occurrences = verse.words[wordViewIndex];
        const extras = occurrences.slice(1);

        if (activeExtraWordIndex === null) {
            toggleExtraOccurrenceBtn.textContent = '+ Ajouter une occurrence ici';
        } else if (activeExtraWordIndex === wordViewIndex) {
            toggleExtraOccurrenceBtn.textContent = 'Terminer cette occurrence ici';
        } else {
            toggleExtraOccurrenceBtn.textContent = 'Continuer ici (ferme le mot précédent)';
        }
        toggleExtraOccurrenceBtn.disabled = wordMarkingLocked;

        if (activeExtraWordIndex !== null && activeExtraWordIndex !== wordViewIndex) {
            const openStart = verse.words[activeExtraWordIndex][verse.words[activeExtraWordIndex].length - 1].start;
            activeExtraWarning.textContent = `⚠ Occurrence encore ouverte sur le mot ${activeExtraWordIndex + 1} depuis ${openStart.toFixed(2)}s — navigue jusque-là pour la terminer, ou clique ici pour l'y rattacher et l'enchaîner.`;
            activeExtraWarning.style.display = '';
        } else {
            activeExtraWarning.style.display = 'none';
        }

        extraOccurrencesList.innerHTML = extras.length === 0
            ? '<span style="color: var(--text-secondary); font-size: 13px;">Aucune occurrence supplémentaire</span>'
            : extras.map((e, i) => `<span class="extra-occurrence-row">${i + 1}. ${e.start.toFixed(2)} → ${e.end !== null ? e.end.toFixed(2) : '…'}<button type="button" class="remove-extra-btn" data-extra-index="${i}" title="Supprimer">×</button></span>`).join('');

        extraOccurrencesList.querySelectorAll('.remove-extra-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.extraIndex, 10);
                occurrences.splice(idx + 1, 1); // +1 : l'index 0 est la principale
                const stillOpen = occurrences.length > 1 && occurrences[occurrences.length - 1].end === null;
                if (activeExtraWordIndex === wordViewIndex && !stillOpen) {
                    activeExtraWordIndex = null;
                }
                renderWordMode();
                updateVerseList();
            });
        });
    }

    // Le dernier mot d'un verset a sa fin calée sur `verse.end` par défaut
    // (voir markWordBtn) — une approximation, pas une vraie frontière
    // observée comme pour les autres mots. Si une occurrence supplémentaire
    // d'un AUTRE mot démarre avant cette fin, c'est la preuve que le
    // cheikh a repris la parole plus tôt que prévu : on resserre la fin du
    // dernier mot sur ce début plutôt que de laisser l'approximation.
    function shrinkLastWordEndIfNeeded(verse, newOccurrenceWordIndex, startTime) {
        const total = getWordList(verse.id)?.length;
        if (!total) return false;
        const lastIndex = total - 1;
        if (newOccurrenceWordIndex === lastIndex) return false; // le dernier mot qui se répète lui-même n'informe rien
        if (verse.words.length <= lastIndex) return false; // le dernier mot n'est pas encore marqué

        const lastWordPrimary = verse.words[lastIndex][0];
        if (lastWordPrimary.end !== null && startTime < lastWordPrimary.end) {
            lastWordPrimary.end = startTime;
            showNotification(
                `Fin du dernier mot resserrée à ${startTime.toFixed(2)}s (occurrence détectée avant)`,
            );
            return true;
        }
        return false;
    }

    toggleExtraOccurrenceBtn.addEventListener('click', function() {
        if (wordModeVerseIndex === null || wordMarkingLocked || !audioPlayer.src) return;
        const verse = verses[wordModeVerseIndex];
        const time = audioPlayer.currentTime;

        if (activeExtraWordIndex !== null && activeExtraWordIndex !== wordViewIndex) {
            // Ferme l'occurrence ouverte sur l'AUTRE mot, à cet instant —
            // c'est ce qui chaîne une phrase répétée sur plusieurs mots.
            const other = verse.words[activeExtraWordIndex];
            other[other.length - 1].end = time;
        }

        if (activeExtraWordIndex === wordViewIndex) {
            const occurrences = verse.words[wordViewIndex];
            occurrences[occurrences.length - 1].end = time;
            activeExtraWordIndex = null;
            showNotification('Occurrence supplémentaire terminée');
        } else {
            verse.words[wordViewIndex].push({ start: time, end: null });
            activeExtraWordIndex = wordViewIndex;
            const shrunk = shrinkLastWordEndIfNeeded(verse, wordViewIndex, time);
            if (!shrunk) {
                showNotification('Occurrence en cours — navigue au mot suivant pour l\'enchaîner, ou reclique ici pour la terminer');
            }
        }

        renderWordMode();
        updateVerseList();
    });

    prevWordBtn.addEventListener('click', function() {
        wordViewIndex -= 1;
        renderWordMode();
    });

    nextWordBtn.addEventListener('click', function() {
        wordViewIndex += 1;
        renderWordMode();
    });

    markWordBtn.addEventListener('click', function() {
        if (wordModeVerseIndex === null || !audioPlayer.src) return;
        const verse = verses[wordModeVerseIndex];
        const wordList = getWordList(verse.id);
        const time = audioPlayer.currentTime;
        const doneCount = verse.words.length;
        if (doneCount >= wordList.length) return;

        // Le clic marque le début du mot en cours. Si un mot précédent est
        // encore ouvert (pas de end), ce même instant en marque la fin —
        // les mots d'un verset se suivent sans blanc entre eux.
        if (doneCount > 0) {
            verse.words[doneCount - 1][0].end = time;
        }

        if (doneCount === wordList.length - 1) {
            // Dernier mot : sa fin est déjà connue, c'est la fin du verset.
            verse.words.push([{ start: time, end: verse.end }]);
            showNotification(`Verset ${verse.id} : tous les mots sont marqués`);
        } else {
            verse.words.push([{ start: time, end: null }]);
        }

        wordViewIndex = verse.words.length;
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
        if (wordModeVerseIndex === null || wordMarkingLocked || !audioPlayer.src) return;
        const verse = verses[wordModeVerseIndex];
        if (wordViewIndex >= verse.words.length) return;

        const time = audioPlayer.currentTime;
        verse.words[wordViewIndex][0].start = time;
        if (wordViewIndex > 0) {
            verse.words[wordViewIndex - 1][0].end = time;
        }

        renderWordMode();
        updateVerseList();
        showNotification(`Début du mot ${wordViewIndex + 1} recalé à ${time.toFixed(2)}s`);
    });

    undoWordBtn.addEventListener('click', function() {
        if (wordModeVerseIndex === null) return;
        const verse = verses[wordModeVerseIndex];
        if (verse.words.length === 0) {
            showNotification('Aucun mot à annuler');
            return;
        }
        verse.words.pop();
        if (verse.words.length > 0) {
            verse.words[verse.words.length - 1][0].end = null;
        }
        wordViewIndex = verse.words.length;
        renderWordMode();
        updateVerseList();
        showNotification('Dernier mot annulé');
    });

    closeWordModeBtn.addEventListener('click', function() {
        if (!confirmLeavingOpenExtraOccurrence()) return;
        closeWordMode();
    });

    // Passe directement au mode mots du prochain verset marquable (données
    // de mots dispo + déjà borné), sans repasser par la liste principale.
    function findNextWordableVerseIndex(fromIndex) {
        for (let i = fromIndex + 1; i < verses.length; i++) {
            const v = verses[i];
            if (getWordList(v.id) && v.end !== null) return i;
        }
        return -1;
    }

    nextVerseWordsBtn.addEventListener('click', function() {
        if (wordModeVerseIndex === null) return;
        if (!confirmLeavingOpenExtraOccurrence()) return;
        const nextIndex = findNextWordableVerseIndex(wordModeVerseIndex);
        if (nextIndex === -1) {
            showNotification('Aucun verset suivant marquable après celui-ci');
            return;
        }
        openWordMode(nextIndex);
    });

    // Champ `words` au format TafsirAudioTiming.words de tafsir-app, prêt à
    // coller dans audios.ts. Absent tant qu'aucun mot n'a été marqué (les
    // versets sans données de mots restent inchangés). Chaque mot est un
    // tableau d'occurrences ({startTime,endTime}[]) — normalement une
    // seule (la principale), plus si le mot est redit plus tard dans le
    // même passage. Miroir de VerseHighlight.occurrences côté tafsir-app,
    // appliqué au niveau du mot plutôt que du verset.
    function formatWordsField(verse) {
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

    function formatVersesForCopy() {
        return verses.map((verse) =>
            `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'}${formatWordsField(verse)} },`
        ).join('\n');
    }

    function formatVersesForExport() {
        return verses.map((verse) =>
            `[{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'}${formatWordsField(verse)} },]`
        ).join('\n');
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