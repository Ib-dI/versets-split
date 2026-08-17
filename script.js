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
    const undoWordBtn = document.getElementById('undoWordBtn');
    const closeWordModeBtn = document.getElementById('closeWordModeBtn');
    const wordMarkedList = document.getElementById('wordMarkedList');
    const surahIdInput = document.getElementById('surahId');
    const surahWordsStatus = document.getElementById('surahWordsStatus');
    const existingTimingsList = document.getElementById('existingTimingsList');

    let verses = [];
    let updateTimer;
    let wordModeVerseIndex = null;

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
            verseText.textContent = `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },${wordsProgress}`;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'verse-actions';

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
        wordModeVerseId.textContent = verse.id;
        wordModeSection.style.display = 'block';
        wordModeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        renderWordMode();
    }

    function closeWordMode() {
        wordModeVerseIndex = null;
        wordModeSection.style.display = 'none';
    }

    function renderWordMode() {
        const verse = verses[wordModeVerseIndex];
        const wordList = getWordList(verse.id);
        const doneCount = verse.words.length;

        if (doneCount >= wordList.length) {
            wordProgress.textContent = `Verset ${verse.id} — tous les mots sont marqués`;
            wordCurrent.textContent = '✓';
            markWordBtn.disabled = true;
        } else {
            wordProgress.textContent = `Mot ${doneCount + 1} / ${wordList.length}`;
            wordCurrent.textContent = wordList[doneCount];
            markWordBtn.disabled = false;
        }

        wordMarkedList.innerHTML = verse.words
            .map((w, i) => `${i + 1}. ${wordList[i]} — ${w.start.toFixed(2)} → ${w.end !== null ? w.end.toFixed(2) : '?'}`)
            .join('<br>');
    }

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
            verse.words[doneCount - 1].end = time;
        }

        if (doneCount === wordList.length - 1) {
            // Dernier mot : sa fin est déjà connue, c'est la fin du verset.
            verse.words.push({ start: time, end: verse.end });
            showNotification(`Verset ${verse.id} : tous les mots sont marqués`);
        } else {
            verse.words.push({ start: time, end: null });
        }

        renderWordMode();
        updateVerseList();
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
            verse.words[verse.words.length - 1].end = null;
        }
        renderWordMode();
        updateVerseList();
        showNotification('Dernier mot annulé');
    });

    closeWordModeBtn.addEventListener('click', closeWordMode);

    // Champ `words` au format TafsirAudioTiming.words de tafsir-app, prêt à
    // coller dans audios.ts. Absent tant qu'aucun mot n'a été marqué (les
    // verset sans données de mots restent inchangés).
    function formatWordsField(verse) {
        if (!verse.words || verse.words.length === 0) return '';
        const items = verse.words
            .map((w) => `{ startTime: ${w.start.toFixed(2)}, endTime: ${w.end !== null ? w.end.toFixed(2) : '?'} }`)
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