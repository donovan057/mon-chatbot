// Fonction universelle de génération d'UUID (Compatible HTTP local et HTTPS Vercel)
function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback pour contextes non sécurisés (ex: HTTP sur IP locale)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Variable globale pour stocker l'historique et la session
let chatHistory = [];
let currentSessionId = generateUUID();

// Configuration initiale de Marked.js + Highlight.js
if (typeof marked !== 'undefined') {
    marked.setOptions({
        highlight: function(code, lang) {
            if (typeof hljs !== 'undefined') {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            }
            return code;
        }
    });
}

// Écouteurs d'événements pour l'envoi de message
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') { sendMessage(); }
});

// Bouton Nouvelle Conversation
document.getElementById('new-chat-btn').addEventListener('click', () => {
    chatHistory = [];
    currentSessionId = generateUUID();
    
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = `
        <div class="message bot">
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="bubble-wrapper">
                <div class="bubble">Nouvelle discussion démarrée. Que puis-je faire pour vous ?</div>
                <button class="copy-btn" title="Copier"><i class="fa-regular fa-copy"></i></button>
            </div>
        </div>`;
    attachCopyEvents();
});

// Sélecteur Sombre / Clair
const themeBtn = document.getElementById('theme-btn');
themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const icon = themeBtn.querySelector('i');
    if (document.body.classList.contains('light-mode')) {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
});

// Afficher l'écran de maintenance et désactiver l'interface
function showMaintenanceOverlay() {
    const overlay = document.getElementById('maintenance-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
    document.getElementById('user-input').disabled = true;
    document.getElementById('send-btn').disabled = true;
}

// Envoi du message à l'API Serverless Vercel (/api/chat)
function sendMessage() {
    const inputField = document.getElementById('user-input');
    const messageText = inputField.value.trim();
    if (messageText === '') return;

    appendMessage(messageText, 'user');
    inputField.value = '';

    chatHistory.push({ role: 'user', content: messageText });
    const recentHistory = chatHistory.slice(-10);

    showTypingIndicator();

    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages: recentHistory,
            session_id: currentSessionId
        })
    })
    .then(async response => {
        const data = await response.json();

        // Détection du mode maintenance (HTTP 503)
        if (response.status === 503 || data.maintenance) {
            showMaintenanceOverlay();
            throw new Error('MAINTENANCE_ACTIVE');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Erreur réseau');
        }

        return data;
    })
    .then(data => {
        removeTypingIndicator();
        if (data.reply) {
            appendMessage(data.reply, 'bot');
            chatHistory.push({ role: 'assistant', content: data.reply });
        } else if (data.error) {
            appendMessage(`Erreur : ${data.error}`, 'bot');
        }
    })
    .catch(error => {
        removeTypingIndicator();
        if (error.message === 'MAINTENANCE_ACTIVE') return;

        console.error('Erreur:', error);
        appendMessage("Désolé, une erreur s'est produite lors de la connexion au serveur.", 'bot');
    });
}

// Ajout d'une bulle de message dans la zone de chat
function appendMessage(text, type) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.innerHTML = type === 'user' 
        ? '<i class="fa-solid fa-user"></i>' 
        : '<i class="fa-solid fa-robot"></i>';

    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'bubble-wrapper';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';

    wrapperDiv.appendChild(bubbleDiv);

    if (type === 'bot') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Copier';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        copyBtn.onclick = (e) => {
            const contentToCopy = bubbleDiv.innerText || text;
            copyToClipboard(contentToCopy, e.currentTarget);
        };
        wrapperDiv.appendChild(copyBtn);
    }

    msgDiv.appendChild(avatarDiv);
    msgDiv.appendChild(wrapperDiv);
    chatBox.appendChild(msgDiv);

    if (type === 'bot') {
        typeWriterEffect(text, bubbleDiv, chatBox);
    } else {
        bubbleDiv.textContent = text;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// Animation d'attente
function showTypingIndicator() {
    const chatBox = document.getElementById('chat-box');
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'message bot';
    indicator.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="bubble typing-dots">
            <span></span><span></span><span></span>
        </div>`;
    chatBox.appendChild(indicator);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// Machine à écrire
function typeWriterEffect(fullText, element, chatBox) {
    const words = fullText.split(' ');
    let index = 0;
    let currentText = '';
    const speed = 30;

    const timer = setInterval(() => {
        if (index < words.length) {
            currentText += (index === 0 ? '' : ' ') + words[index];
            
            if (typeof marked !== 'undefined') {
                element.innerHTML = marked.parse(currentText);
            } else {
                element.textContent = currentText;
            }
            
            chatBox.scrollTop = chatBox.scrollHeight;
            index++;
        } else {
            clearInterval(timer);
            if (typeof hljs !== 'undefined') {
                element.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        }
    }, speed);
}

// Système de copie
function copyToClipboard(text, buttonEl) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => showCopySuccess(buttonEl))
            .catch(() => fallbackCopy(text, buttonEl));
    } else {
        fallbackCopy(text, buttonEl);
    }
}

function fallbackCopy(text, buttonEl) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand('copy');
        showCopySuccess(buttonEl);
    } catch (err) {
        console.error('Erreur de copie:', err);
    }

    document.body.removeChild(textArea);
}

function showCopySuccess(buttonEl) {
    const btn = (buttonEl && typeof buttonEl.closest === 'function') 
        ? buttonEl.closest('.copy-btn') 
        : buttonEl;
        
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
        }, 2000);
    }
}

function attachCopyEvents() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = (e) => {
            const wrapper = e.currentTarget.closest('.bubble-wrapper');
            if (wrapper) {
                const bubbleElement = wrapper.querySelector('.bubble');
                if (bubbleElement) {
                    copyToClipboard(bubbleElement.innerText, e.currentTarget);
                }
            }
        };
    });
}

function hideMaintenanceOverlay() {
    const overlay = document.getElementById('maintenance-overlay');
    if (overlay) {
        overlay.classList.add('hidden')
    }
}

document.getElementById('user-input').disabled = false;
document.getElementById('send-btn').disabled = false;

attachCopyEvents();