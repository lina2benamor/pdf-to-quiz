// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// DOM Elements
const pdfInput = document.getElementById('pdfInput');
const dropArea = document.getElementById('dropArea');
const fileInfo = document.getElementById('fileInfo');
const convertBtn = document.getElementById('convertBtn');
const flashcardsContainer = document.getElementById('flashcardsContainer');
const results = document.getElementById('results');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const quizletBtn = document.getElementById('quizletBtn');

let pdfFile = null;
let confetti = null;

// Initialize confetti
function initConfetti() {
    const confettiSettings = { 
        target: 'confetti-canvas',
        max: 150,
        size: 1.5,
        animate: true,
        props: ['🦄', '🌈', '✨', '🍭', '🎀'],
        colors: [[255, 126, 185], [122, 240, 210], [255, 179, 71], [122, 240, 162]]
    };
    confetti = new ConfettiGenerator(confettiSettings);
}

// Celebrate with confetti
function celebrate() {
    if (!confetti) initConfetti();
    confetti.render();
    setTimeout(() => confetti.clear(), 3000);
}

// Event Listeners
pdfInput.addEventListener('change', handleFileSelect);
dropArea.addEventListener('click', () => pdfInput.click());
dropArea.addEventListener('dragover', handleDragOver);
dropArea.addEventListener('dragleave', handleDragLeave);
dropArea.addEventListener('drop', handleDrop);
convertBtn.addEventListener('click', convertToFlashcards);
copyBtn.addEventListener('click', copyToClipboard);
downloadBtn.addEventListener('click', downloadFlashcards);
quizletBtn.addEventListener('click', openInQuizlet);

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        pdfFile = file;
        fileInfo.textContent = `📄 ${file.name}`;
        fileInfo.style.color = 'var(--primary-color)';
        dropArea.classList.remove('dragover');
    } else {
        fileInfo.textContent = 'Please select a PDF file';
        fileInfo.style.color = 'var(--danger-color)';
    }
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        pdfFile = file;
        fileInfo.textContent = `📄 ${file.name}`;
        fileInfo.style.color = 'var(--primary-color)';
        pdfInput.files = e.dataTransfer.files;
    } else {
        fileInfo.textContent = 'Please drop a PDF file';
        fileInfo.style.color = 'var(--danger-color)';
    }
}

// Convert PDF to flashcards
async function convertToFlashcards() {
    if (!pdfFile) {
        showError('Please select a PDF file first');
        return;
    }

    convertBtn.disabled = true;
    flashcardsContainer.innerHTML = '<div class="no-cards">Processing your cute flashcards... ✨</div>';
    results.style.display = 'block';
    
    try {
        const flashcardType = document.getElementById('flashcardType').value;
        const pageRange = document.getElementById('pageRange').value;
        const maxCards = parseInt(document.getElementById('maxCards').value);
        
        const text = await extractTextFromPDF(pdfFile, pageRange, maxCards);
        const flashcards = generateFlashcards(text, flashcardType);
        
        displayFlashcards(flashcards);
        if (flashcards.length > 0) celebrate();
    } catch (error) {
        console.error('Error converting PDF:', error);
        showError('Oops! Something went wrong. Try a different PDF?');
    } finally {
        convertBtn.disabled = false;
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'no-cards';
    errorDiv.textContent = message;
    flashcardsContainer.innerHTML = '';
    flashcardsContainer.appendChild(errorDiv);
    results.style.display = 'block';
}

// Extract text from PDF
async function extractTextFromPDF(file, pageRange, maxPages) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    
    let pagesToProcess = [];
    const totalPages = pdf.numPages;
    
    // Parse page range if specified
    if (pageRange) {
        const ranges = pageRange.split(',');
        for (const range of ranges) {
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                for (let i = start; i <= (end || start); i++) {
                    if (i > 0 && i <= totalPages) pagesToProcess.push(i);
                }
            } else {
                const page = parseInt(range);
                if (page > 0 && page <= totalPages) pagesToProcess.push(page);
            }
        }
    } else {
        // Default to first N pages if no range specified
        pagesToProcess = Array.from({length: Math.min(maxPages, totalPages)}, (_, i) => i + 1);
    }
    
    // Remove duplicates and sort
    pagesToProcess = [...new Set(pagesToProcess)].sort((a, b) => a - b);
    
    // Limit to maxPages
    if (maxPages) {
        pagesToProcess = pagesToProcess.slice(0, maxPages);
    }
    
    // Extract text from each page
    let fullText = '';
    for (const pageNum of pagesToProcess) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }
    
    return fullText;
}

// Generate flashcards from text
function generateFlashcards(text, type) {
    const flashcards = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    if (type === 'qa') {
        // Q&A detection (look for question marks)
        let currentQ = '';
        let currentA = '';
        
        for (const line of lines) {
            if (line.trim().endsWith('?')) {
                if (currentQ && currentA) {
                    flashcards.push({ term: currentQ, definition: currentA });
                    currentQ = '';
                    currentA = '';
                }
                currentQ = line.trim();
            } else if (currentQ) {
                currentA += (currentA ? ' ' : '') + line.trim();
            }
        }
        
        if (currentQ && currentA) {
            flashcards.push({ term: currentQ, definition: currentA });
        }
    } else {
        // Term & definition detection (look for patterns like "Term: definition")
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const term = line.substring(0, colonIndex).trim();
                const definition = line.substring(colonIndex + 1).trim();
                
                if (term && definition) {
                    flashcards.push({ term, definition });
                }
            }
        }
    }
    
    // If no specific pattern found, split by paragraphs
    if (flashcards.length === 0) {
        for (let i = 0; i < lines.length - 1; i += 2) {
            flashcards.push({
                term: lines[i].trim(),
                definition: lines[i + 1].trim()
            });
        }
    }
    
    return flashcards.slice(0, 100); // Limit to 100 flashcards max
}

// Display flashcards in the UI
function displayFlashcards(flashcards) {
    flashcardsContainer.innerHTML = '';
    
    if (flashcards.length === 0) {
        flashcardsContainer.innerHTML = '<div class="no-cards">No flashcards found 😢 Try adjusting settings!</div>';
        return;
    }
    
    flashcards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'flashcard';
        cardElement.innerHTML = `
            <div class="term">${index + 1}. ${card.term}</div>
            <div class="definition">${card.definition}</div>
        `;
        flashcardsContainer.appendChild(cardElement);
    });
}

// Copy flashcards to clipboard
function copyToClipboard() {
    const flashcards = Array.from(document.querySelectorAll('.flashcard'));
    if (flashcards.length === 0) {
        showError('No flashcards to copy');
        return;
    }
    
    const textToCopy = flashcards.map((card, index) => {
        const term = card.querySelector('.term').textContent.replace(`${index + 1}. `, '');
        const definition = card.querySelector('.definition').textContent;
        return `${term}\t${definition}`; // Tab-separated for Quizlet import
    }).join('\n');
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            showError('Failed to copy. Try again!');
        });
}

// Download flashcards as TXT file
function downloadFlashcards() {
    const flashcards = Array.from(document.querySelectorAll('.flashcard'));
    if (flashcards.length === 0) {
        showError('No flashcards to download');
        return;
    }
    
    const textToDownload = flashcards.map((card, index) => {
        const term = card.querySelector('.term').textContent.replace(`${index + 1}. `, '');
        const definition = card.querySelector('.definition').textContent;
        return `${term}\t${definition}`;
    }).join('\n');
    
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cute-flashcards.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Open Quizlet with the flashcards
function openInQuizlet() {
    const flashcards = Array.from(document.querySelectorAll('.flashcard'));
    if (flashcards.length === 0) {
        showError('No flashcards to export');
        return;
    }
    
    const textForQuizlet = flashcards.map((card, index) => {
        const term = card.querySelector('.term').textContent.replace(`${index + 1}. `, '');
        const definition = card.querySelector('.definition').textContent;
        return `${term}\t${definition}`;
    }).join('\n');
    
    // Open Quizlet's create page
    window.open('https://quizlet.com/create-set', '_blank');
    
    // Show instructions
    const originalText = quizletBtn.textContent;
    quizletBtn.textContent = 'Check your tabs!';
    setTimeout(() => {
        quizletBtn.textContent = originalText;
    }, 3000);
    
    // Try to copy automatically
    navigator.clipboard.writeText(textForQuizlet).catch(console.error);
}

// Initialize confetti when DOM loads
document.addEventListener('DOMContentLoaded', initConfetti);