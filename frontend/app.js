// Fonction utilitaire pour ajouter un message dans la fenêtre de chat
function addMessageToChat(text, sender = 'user') {
  const chatMessages = document.getElementById('chat-messages');
  const welcomeBlock = document.getElementById('welcome-block');
  if (welcomeBlock && !welcomeBlock.classList.contains('slide-up')) {
    welcomeBlock.classList.add('slide-up');
    setTimeout(() => {
      welcomeBlock.style.display = 'none';
    }, 500);
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = sender === 'bot' ? 'bot-message' : 'user-message';
  msgDiv.textContent = text;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Upload file button
const addBtn = document.getElementById('add-btn');
const fileInput = document.getElementById('file-input');
addBtn.onclick = () => fileInput.click();
fileInput.onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  addMessageToChat(`Fichier "${file.name}" prêt à être envoyé.`, 'user');
  try {
    const response = await fetch('http://localhost:8000/upload', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error('Erreur lors de l\'upload');
  } catch (err) {
    addMessageToChat('Erreur lors de l\'envoi du fichier.', 'bot');
  }
  fileInput.value = '';
};

// Envoi de message texte
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
chatForm.onsubmit = async function(e) {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;
  addMessageToChat(text, 'user');
  userInput.value = '';

  try {
    const response = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await response.json();

    // Directly use data.response (string) and data.suggested_questions (array)
    if (data.response) {
      addMessageToChat(data.response, 'bot');
    }

    if (data.suggested_questions && Array.isArray(data.suggested_questions)) {
      const chatMessages = document.getElementById('chat-messages');
      const suggestionBlock = document.createElement('div');
      suggestionBlock.className = 'suggestion-block';
      suggestionBlock.innerHTML = '<strong>Vous pourriez aussi demander :</strong>';

      data.suggested_questions.forEach(q => {
        const questionBtn = document.createElement('button');
        questionBtn.textContent = q;
        questionBtn.className = 'suggestion-btn';
        questionBtn.onclick = () => {
          userInput.value = q;
        };
        suggestionBlock.appendChild(questionBtn);
      });

      chatMessages.appendChild(suggestionBlock);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

  } catch (err) {
    addMessageToChat('Erreur de connexion au serveur.', 'bot');
  }
};


// Gestion du message vocal (unifié avec audio playback)
const voiceBtn = document.getElementById('voice-btn');
let mediaRecorder, audioChunks = [];

voiceBtn.onclick = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('L\'enregistrement audio n\'est pas supporté sur ce navigateur.');
    return;
  }
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    voiceBtn.style.background = '#111';
    voiceBtn.style.color = '#fff';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      addMessageToChat('🎤 Message vocal envoyé, traitement en cours...', 'user');

      try {
        const response = await fetch('http://localhost:8000/voice-chat', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) throw new Error('Erreur lors de l\'envoi audio');
        const data = await response.json();

        addMessageToChat(data.response, 'bot');

        if (data.response) {
          addMessageToChat(data.response, 'bot');
        }
        
        if (data.audio_url) {
          const chatMessages = document.getElementById('chat-messages');
          const audioBlock = document.createElement('div');
          audioBlock.className = 'audio-block';
        
          const audioPlayer = document.createElement('audio');
          audioPlayer.controls = true;
          audioPlayer.src = `${data.audio_url}?t=${Date.now()}`;

          audioPlayer.src = data.audio_url;
        
          audioBlock.appendChild(audioPlayer);
          chatMessages.appendChild(audioBlock);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        if (data.suggested_questions && Array.isArray(data.suggested_questions)) {
          const chatMessages = document.getElementById('chat-messages');
          const suggestionBlock = document.createElement('div');
          suggestionBlock.className = 'suggestion-block';
          suggestionBlock.innerHTML = '<strong>Vous pourriez aussi demander :</strong>';
        
          data.suggested_questions.forEach(q => {
            const questionBtn = document.createElement('button');
            questionBtn.textContent = q;
            questionBtn.className = 'suggestion-btn';
            questionBtn.onclick = () => {
              userInput.value = q;
            };
            suggestionBlock.appendChild(questionBtn);
          });
        
          chatMessages.appendChild(suggestionBlock);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
      } catch (err) {
        addMessageToChat('❌ Erreur lors de l\'envoi ou du traitement vocal.', 'bot');
      }
    };
    mediaRecorder.start();
    voiceBtn.style.background = '#ff9800';
    voiceBtn.style.color = '#fff';
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        voiceBtn.style.background = '#111';
        voiceBtn.style.color = '#fff';
      }
    }, 10000);
  } catch (err) {
    alert('Impossible d\'accéder au micro.');
  }
};

// Contrôle de l'affichage du slide (sidebar)
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
sidebarToggle.onclick = () => {
  sidebar.classList.toggle('sidebar-hidden');
};
