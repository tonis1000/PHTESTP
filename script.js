// URL der PHP-Datei
let phpFileUrl = '';

// Maximale Anzahl von Versuchen zur Extraktion der URL
const maxAttempts = 3;

// Funktion zum Extrahieren der Stream-URL aus der PHP-Datei
async function extractStreamUrlFromPhpFile() {
    try {
        // Durchführen von mehreren Versuchen
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Versuch ${attempt}...`);

            // PHP-Datei abrufen
            const response = await fetch(phpFileUrl);
            const phpFileContent = await response.text();

            // Regulärer Ausdruck zum Extrahieren der URL
            const urlRegex = /(?:https?|ftp):\/\/[\n\S]+/;

            // Match der URL
            const urlMatch = phpFileContent.match(urlRegex);

            if (urlMatch && urlMatch.length > 0) {
                // Extrahierte URL
                const streamUrl = urlMatch[0];
                console.log('Gefundene Stream-URL:', streamUrl);
                displayResult(streamUrl);
                return streamUrl;
            } else {
                console.log('Keine Stream-URL gefunden.');
            }
        }

        console.log('Maximale Anzahl von Versuchen erreicht, keine gültige Stream-URL gefunden.');
        displayResult('Maximale Anzahl von Versuchen erreicht, keine gültige Stream-URL gefunden.');
        return null;
    } catch (error) {
        console.error('Fehler beim Extrahieren der Stream-URL:', error);
        displayResult('Fehler beim Extrahieren der Stream-URL.');
        return null;
    }
}

// Funktion aufrufen und Stream-URL extrahieren
function extractUrlHandler() {
    const phpLinkInput = document.getElementById('phpLink');
    phpFileUrl = phpLinkInput.value.trim();
    extractStreamUrlFromPhpFile();
}

// Funktion zum Anzeigen des Ergebnisses
function displayResult(result) {
    const outputDiv = document.getElementById('output');
    outputDiv.textContent = result;
}

// Event-Listener für den Button
const extractUrlButton = document.getElementById('extractUrlButton');
extractUrlButton.addEventListener('click', extractUrlHandler);
