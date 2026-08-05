// Variable globale pour stocker l'historique de la conversation
let chatHistory = [];

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

// 1. Bouton Nouvelle Conversation (Mis à jour avec réinitialisation)
document.getElementById('new-chat-btn').addEventListener('click', () => {
    chatHistory = []; // Vide la mémoire locale du chatbot
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

// 2. Sélecteur Sombre / Clair
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

// 3. Envoi du message à l'API Serverless Vercel (/api/chat)
function sendMessage() {
    const inputField = document.getElementById('user-input');
    const messageText = inputField.value.trim();
    if (messageText === '') return;

    appendMessage(messageText, 'user');
    inputField.value = '';

    // Enregistrement dans la mémoire locale
    chatHistory.push({ role: 'user', content: messageText });

    // On garde uniquement les 10 derniers messages pour alléger la requête
    const recentHistory = chatHistory.slice(-10);

    showTypingIndicator();

    // Appel à l'API Vercel Node.js / Supabase
    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recentHistory }) // Clé "messages" au pluriel
    })
    .then(response => {
        if (!response.ok) throw new Error('Erreur réseau');
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        if (data.reply) {
            appendMessage(data.reply, 'bot');
            // Enregistrement de la réponse (sans les guillemets)
            chatHistory.push({ role: 'assistant', content: data.reply });
        } else if (data.error) {
            appendMessage(`Erreur : ${data.error}`, 'bot');
        }
    })
    .catch(error => {
        removeTypingIndicator();
        console.error('Erreur:', error);
        appendMessage("Désolé, une erreur s'est produite lors de la connexion au serveur.", 'bot');
    });
}

// 4. Ajout d'une bulle de message dans la zone de chat
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

// 5. Animation d'attente (Indicateur de saisie)
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

// 6. Animation d'écriture mot par mot (Machine à écrire)
function typeWriterEffect(fullText, element, chatBox) {
    const words = fullText.split(' ');
    let index = 0;
    let currentText = '';
    const speed = 30; // Vitesse en ms par mot

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
            // Applique la coloration syntaxique du code à la fin
            if (typeof hljs !== 'undefined') {
                element.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        }
    }, speed);
}

// 7. Système de Copie Universel (HTTPS + HTTP local)
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

// Lancement initial des événements
attachCopyEvents();