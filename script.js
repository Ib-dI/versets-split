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
    const exportBtn = document.getElementById('exportBtn');
    const exportText = document.getElementById('exportText');
    const notification = document.getElementById('notification');
    const verseIdInput = document.getElementById('verseId');
    const timeControlBtns = document.querySelectorAll('.time-control-btn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    
    let verses = [];
    let updateTimer;
    
    // Charger un fichier audio
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            audioPlayer.src = url;
            audioWrapper.style.display = 'block';
            clearAudioBtn.classList.add('visible');
            fileName.textContent = file.name;
            verses = [];
            updateVerseList();
            showNotification('Audio chargé avec succès');
        }
    });
    
    // Supprimer l'audio
    clearAudioBtn.addEventListener('click', function() {
        audioPlayer.src = '';
        audioFileInput.value = '';
        audioWrapper.style.display = 'none';
        clearAudioBtn.classList.remove('visible');
        fileName.textContent = 'Charger un fichier audio';
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
    
    // Marquer le début d'un verset
    startVerseBtn.addEventListener('click', function() {
        if (!audioPlayer.src) {
            showNotification('Veuillez charger un fichier audio d\'abord');
            return;
        }
        const time = audioPlayer.currentTime;
        const verseId = parseInt(verseIdInput.value) || 1;
        verses.push({ id: verseId, start: time, end: null });
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
            verseText.textContent = `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },`;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'verse-actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn verse-action-btn';
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
            copyBtn.addEventListener('click', () => {
                const text = `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },`;
                navigator.clipboard.writeText(text)
                    .then(() => showNotification('Verset copié'))
                    .catch(err => console.error('Erreur de copie:', err));
            });
            
            const resetBtn = document.createElement('button');
            resetBtn.className = 'end-btn verse-action-btn';
            resetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
            resetBtn.addEventListener('click', () => {
                verses.splice(index, 1);
                updateVerseList();
                showNotification('Verset supprimé');
            });
            
            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(resetBtn);
            
            verseEntry.appendChild(verseText);
            verseEntry.appendChild(actionsDiv);
            verseList.appendChild(verseEntry);
        });
    }
    
    function formatVersesForCopy() {
        return verses.map((verse) => 
            `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },`
        ).join('\n');
    }
    
    function formatVersesForExport() {
        return verses.map((verse) => 
            `[{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },]`
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