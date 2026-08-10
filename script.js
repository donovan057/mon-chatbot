// === 1. UTILITAIRES & CONFIGURATION INITIALE ===

// URL de base de l'API (Incontournable pour Capacitor / Android)
const API_BASE_URL = 'https://mon-chatbot-chi.vercel.app';

// Générateur universel d'UUID (Compatible local HTTP et Vercel HTTPS)
function generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Variables globales de session
let chatHistory = [];
let currentSessionId = localStorage.getItem('session_id') || generateUUID();
localStorage.setItem('session_id', currentSessionId);

// Cache mémoire pour l'affichage instantané
const sessionsCache = new Map();

// Sauvegarde locale des sessions de l'utilisateur
function saveUserSession(sessionId) {
    let userSessions = JSON.parse(localStorage.getItem('my_sessions') || '[]');
    if (!userSessions.includes(sessionId)) {
        userSessions.push(sessionId);
        localStorage.setItem('my_sessions', JSON.stringify(userSessions));
    }
}

// Initialisation de la première session locale
saveUserSession(currentSessionId);

// Configuration de Marked.js + Highlight.js
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

// === 2. INITIALISATION & ÉCOUTEURS D'ÉVÉNEMENTS ===

document.addEventListener('DOMContentLoaded', () => {
    // Écouteurs pour l'envoi de messages
    document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    document.getElementById('user-input')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') { sendMessage(); }
    });

    // Bouton Nouvelle Conversation
    document.getElementById('new-chat-btn')?.addEventListener('click', startNewChat);

    // Bouton Tout supprimer 
    document.getElementById('clear-all-btn')?.addEventListener('click', clearAllSessions);

    // Bouton Hamburger (3 traits) pour la sidebar & Overlay
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    toggleSidebarBtn?.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar?.classList.toggle('open');
            overlay?.classList.toggle('active');
        } else {
            sidebar?.classList.toggle('collapsed');
        }
    });

    // Clic sur l'overlay pour fermer la sidebar
    overlay?.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
    });

    // Fermer la sidebar en cliquant à l'extérieur (zone vide) sur mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar?.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !toggleSidebarBtn?.contains(e.target)) {
                sidebar.classList.remove('open');
                overlay?.classList.remove('active');
            }
        }
    });

    // Sélecteur de thème Sombre / Clair
    const themeBtn = document.getElementById('theme-btn');
    themeBtn?.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const icon = themeBtn.querySelector('i');
        if (icon) {
            icon.className = document.body.classList.contains('light-mode') 
                ? 'fa-solid fa-sun' 
                : 'fa-solid fa-moon';
        }
    });

    // Écouteur global pour fermer la maintenance
    document.addEventListener('click', function (e) {
        if (e.target.closest('#close-maintenance-btn') || e.target.closest('#close-maintenance-main-btn')) {
            hideMaintenanceOverlay();
        }
    });

    // Attacher la copie aux éléments existants au chargement
    attachCopyEvents();

    // Charger l'historique Supabase de la session active et la liste des sessions
    loadHistory(currentSessionId);
    fetchAndRenderSessions();
});

// === 3. LOGIQUE D'ENVOI ET RÉCEPTION DE MESSAGES ===

function sendMessage() {
    const inputField = document.getElementById('user-input');
    if (!inputField) return;

    const messageText = inputField.value.trim();
    if (messageText === '') return;

    appendMessage(messageText, 'user');
    inputField.value = '';

    chatHistory.push({ role: 'user', content: messageText });

    // Mise à jour synchrone du cache mémoire
    if (sessionsCache.has(currentSessionId)) {
        sessionsCache.get(currentSessionId).push({ sender: 'user', message: messageText });
    }

    const recentHistory = chatHistory.slice(-10);

    showTypingIndicator();

    fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages: recentHistory,
            session_id: currentSessionId
        })
    })
    .then(async response => {
        const data = await response.json();

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

            // Mise à jour du cache mémoire pour le bot
            if (sessionsCache.has(currentSessionId)) {
                sessionsCache.get(currentSessionId).push({ sender: 'bot', message: data.reply });
            }

            fetchAndRenderSessions(); // Mettre à jour la sidebar après réponse
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

// === 4. HISTORIQUE SUPABASE & CACHE MÉMOIRE ===

function renderMessages(messages) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    // Si la conversation est vide sur le serveur
    if (!messages || messages.length === 0) {
        if (chatBox.children.length === 1 && chatBox.querySelector('.message.bot')) {
            return;
        }
        chatBox.innerHTML = '';
        appendMessage("Nouvelle discussion démarrée. Que puis-je faire pour vous ?", 'bot', true);
        return;
    }

    // Si la conversation contient des messages, charger l'historique Supabase
    chatBox.innerHTML = '';
    chatHistory = [];

    messages.forEach(msg => {
        const role = msg.sender === 'user' ? 'user' : 'assistant';
        const uiType = msg.sender === 'user' ? 'user' : 'bot';
        
        chatHistory.push({ role: role, content: msg.message });
        appendMessage(msg.message, uiType, true);
    });
}

async function loadHistory(sessionId) {
    const hasCache = sessionsCache.has(sessionId);

    // 1. Restitution instantanée si disponible en cache
    if (hasCache) {
        renderMessages(sessionsCache.get(sessionId));
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/history?session_id=${sessionId}`);
        const data = await response.json();

        if (response.ok && Array.isArray(data.messages)) {
            const previousMessages = sessionsCache.get(sessionId);
            sessionsCache.set(sessionId, data.messages);

            // Mettre à jour le DOM uniquement si l'utilisateur est toujours sur cette session
            if (sessionId === currentSessionId) {
                const hasChanged = JSON.stringify(previousMessages) !== JSON.stringify(data.messages);
                if (!hasCache || hasChanged) {
                    renderMessages(data.messages);
                }
            }
        }
    } catch (error) {
        console.error("Erreur lors du chargement de l'historique :", error);
    }
}

function startNewChat() {
    chatHistory = [];
    currentSessionId = generateUUID();
    localStorage.setItem('session_id', currentSessionId);
    saveUserSession(currentSessionId);
    
    const chatBox = document.getElementById('chat-box');
    if (chatBox) chatBox.innerHTML = '';
    
    appendMessage("Nouvelle discussion démarrée. Que puis-je faire pour vous ?", 'bot', true);
    fetchAndRenderSessions();
}

// === 5. AFFICHAGE & MANIPULATION DU DOM ===

function appendMessage(text, type, skipAnimation = false) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

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

    if (type === 'bot' && !skipAnimation) {
        typeWriterEffect(text, bubbleDiv, chatBox);
    } else {
        if (type === 'bot' && typeof marked !== 'undefined') {
            bubbleDiv.innerHTML = marked.parse(text);
            if (typeof hljs !== 'undefined') {
                bubbleDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
            }
        } else {
            bubbleDiv.textContent = text;
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    }
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

// Indicateurs de chargement
function showTypingIndicator() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

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

// === 6. MAINTENANCE & SYSTÈME DE COPIE ===

function showMaintenanceOverlay() {
    const overlay = document.getElementById('maintenance-overlay');
    if (overlay) overlay.classList.remove('hidden');

    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    if (userInput) userInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
}

function hideMaintenanceOverlay() {
    const overlay = document.getElementById('maintenance-overlay');
    if (overlay) overlay.classList.add('hidden');

    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    if (userInput) userInput.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
}

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

// === 7. GESTION DES SESSIONS SIDEBAR & SUPPRESSION ===

async function fetchAndRenderSessions() {
    try {
        saveUserSession(currentSessionId);
        const mySessions = JSON.parse(localStorage.getItem('my_sessions') || '[]');

        const response = await fetch(`${API_BASE_URL}/api/sessions`);
        const data = await response.json();

        if (response.ok && Array.isArray(data.sessions)) {
            const sidebarContainer = document.getElementById('sessions-list');
            if (!sidebarContainer) return;

            sidebarContainer.innerHTML = '';

            // Filtrer pour ne conserver que les sessions créées par ce navigateur
            const userOnlySessions = data.sessions.filter(s => mySessions.includes(s.session_id));

            userOnlySessions.forEach(session => {
                const item = document.createElement('div');
                const isActive = session.session_id === currentSessionId ? 'active' : '';
                item.className = `session-item ${isActive}`;

                item.innerHTML = `
                    <div class="session-info">
                        <i class="fa-regular fa-message"></i>
                        <span>${session.preview || 'Discussion'}</span>
                    </div>
                    <button class="delete-session-btn" title="Supprimer la conversation">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                `;

                item.onclick = () => {
                    currentSessionId = session.session_id;
                    localStorage.setItem('session_id', currentSessionId);
                    loadHistory(currentSessionId);
                    fetchAndRenderSessions();

                    if (window.innerWidth <= 768) {
                        document.querySelector('.sidebar')?.classList.remove('open');
                        document.getElementById('sidebar-overlay')?.classList.remove('active');
                    }
                };

                const deleteBtn = item.querySelector('.delete-session-btn');
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await deleteSession(session.session_id);
                };

                sidebarContainer.appendChild(item);
            });
        }
    } catch (error) {
        console.error("Erreur lors de la récupération des sessions :", error);
    }
}

async function deleteSession(sessionId) {
    const confirmDelete = await showCustomModal({
        title: "Supprimer la conversation ?",
        message: "Cette action est irréversible et supprimera l'historique.",
        confirmText: "Supprimer",
        iconType: "warning"
    });

    if (!confirmDelete) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/delete-session?session_id=${sessionId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            sessionsCache.delete(sessionId);
            
            let userSessions = JSON.parse(localStorage.getItem('my_sessions') || '[]');
            userSessions = userSessions.filter(id => id !== sessionId);
            localStorage.setItem('my_sessions', JSON.stringify(userSessions));

            if (sessionId === currentSessionId) {
                startNewChat();
            } else {
                fetchAndRenderSessions();
            }
        }
    } catch (error) {
        console.error("Erreur lors de la suppression de la session :", error);
    }
}

async function clearAllSessions() {
    const mySessions = JSON.parse(localStorage.getItem('my_sessions') || '[]');

    if (mySessions.length === 0) {
        await showCustomModal({
            title: "Aucune conversation",
            message: "Vous n'avez aucune conversation à supprimer.",
            isAlert: true,
            confirmText: "Compris",
            iconType: "info"
        });
        return;
    }

    const confirmDelete = await showCustomModal({
        title: "Tout supprimer ?",
        message: "Voulez-vous vraiment supprimer TOUTES vos conversations ? Cette action est définitive.",
        confirmText: "Tout effacer",
        iconType: "warning"
    });

    if (!confirmDelete) return;

    try {
        await Promise.all(mySessions.map(sessionId =>
            fetch(`${API_BASE_URL}/api/delete-session?session_id=${sessionId}`, { method: 'DELETE' })
        ));

        sessionsCache.clear();
        localStorage.removeItem('my_sessions');
        startNewChat();
    } catch (error) {
        console.error("Erreur lors de la suppression globale :", error);
    }
}

// Fonction pour ouvrir la modale personnalisée sous forme de Promise
function showCustomModal({ title, message, isAlert = false, confirmText = "Confirmer", iconType = "warning" }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const iconEl = document.getElementById('modal-icon');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        if (!modal) {
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;

        // Type d'icône & couleur du bouton de confirmation
        iconEl.className = `modal-icon ${iconType}`;
        if (iconType === 'warning') {
            iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            confirmBtn.style.background = '#ef4444';
        } else {
            iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
            confirmBtn.style.background = '#3b82f6';
        }

        // Mode Alerte (un seul bouton) vs Confirmation (deux boutons)
        cancelBtn.style.display = isAlert ? 'none' : 'block';

        modal.classList.remove('hidden');

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}