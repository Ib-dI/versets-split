document.addEventListener('DOMContentLoaded', function() {
    const audioPlayer = document.getElementById('audioPlayer');
    const currentTimeDisplay = document.getElementById('currentTime');
    const startVerseBtn = document.getElementById('startVerse');
    const endVerseBtn = document.getElementById('endVerse');
    const copyAllBtn = document.getElementById('copyAll');
    const verseList = document.getElementById('verseList');
    const audioFileInput = document.getElementById('audioFile');
    const exportBtn = document.getElementById('exportBtn');
    const exportText = document.getElementById('exportText');
    const notification = document.getElementById('notification');
    const verseIdInput = document.getElementById('verseId');
    
    let verses = [];
    let updateTimer;
    
    // Charger un fichier audio
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            audioPlayer.src = url;
            verses = [];
            updateVerseList();
        }
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
        const time = audioPlayer.currentTime;
        const verseId = parseInt(verseIdInput.value) || 1;
        verses.push({ id: verseId, start: time, end: null });
        updateVerseList();
        showNotification(`Début de verset ${verseId} marqué`);
        // Incrémenter automatiquement l'ID pour le prochain verset
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
            .then(() => showNotification('Versets copiés!'))
            .catch(err => console.error('Erreur de copie:', err));
    });
    
    // Exporter les versets
    exportBtn.addEventListener('click', function() {
        exportText.value = formatVersesForExport();
    });
    
    function updateVerseList() {
        verseList.innerHTML = '';
        
        if (verses.length === 0) {
            verseList.innerHTML = '<p>Aucun verset marqué</p>';
            return;
        }
        
        verses.forEach((verse, index) => {
            const verseEntry = document.createElement('div');
            verseEntry.className = 'verse-entry';
            
            const verseText = document.createElement('span');
            verseText.textContent = `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },`;

            // Création du conteneur pour les boutons d'action
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'verse-actions';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn verse-action-btn';
            copyBtn.textContent = 'Copier';
            copyBtn.addEventListener('click', () => {
                const text = `{ id: ${verse.id}, startTime: ${verse.start.toFixed(2)}, endTime: ${verse.end ? verse.end.toFixed(2)+'' : '?'} },`;
                navigator.clipboard.writeText(text)
                    .then(() => showNotification('Verset copié!'))
                    .catch(err => console.error('Erreur de copie:', err));
            });
            
            const resetBtn = document.createElement('button');
            resetBtn.className = 'end-btn verse-action-btn';
            resetBtn.textContent = 'Reset';
            resetBtn.addEventListener('click', () => {
                verses.splice(index, 1);
                updateVerseList();
                showNotification('Verset supprimé !');
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
        notification.textContent = message;
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }
}); 