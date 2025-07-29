// Configuración
const MAX_LEVEL = 400;
const CHECK_INTERVAL = 10000; // 10 segundos
const NOTIFICATION_SOUND_URL = './sound.mp3';

// Variables de estado
let history = [];
let intervalId = null;
let countdownInterval = null;
let timeLeft = CHECK_INTERVAL / 1000;
let soundEnabled = false;
let notificationSound = null;
let volume = 0.5;
let isSoundStopped = false;
let confirmedNotificationLevel = 400;
let currentLevelStartTime = null;
let averageLevelTime = null;
let levelProgressInterval = null;
let currentLevel = 0;

// Elementos DOM
const elements = {
  startButton: document.getElementById('startButton'),
  clearDataBtn: document.getElementById('clearDataBtn'),
  stopSoundBtn: document.getElementById('stopSoundBtn'),
  characterName: document.getElementById('characterName'),
  output: document.getElementById('output'),
  updateProgress: document.getElementById('updateProgress'),
  updateProgressBar: document.getElementById('updateProgressBar'),
  updateProgressText: document.getElementById('updateProgressText'),
  statsPanel: document.getElementById('statsPanel'),
  currentLevel: document.getElementById('currentLevel'),
  onlineStatus: document.getElementById('onlineStatus'),
  currentLevelTime: document.getElementById('currentLevelTime'),
  timeToLevelUp: document.getElementById('timeToLevelUp'),
  levelChart: document.getElementById('levelChart'),
  notificationLevel: document.getElementById('notificationLevel'),
  confirmLevelBtn: document.getElementById('confirmLevelBtn'),
  testSoundBtn: document.getElementById('testSoundBtn'),
  soundStatus: document.getElementById('soundStatus'),
  levelProgressBar: document.getElementById('levelProgressBar'),
  levelProgressText: document.getElementById('levelProgressText'),
  levelProgressTime: document.getElementById('levelProgressTime'),
  estimateProgressBar: document.getElementById('estimateProgressBar'),
  estimateProgressText: document.getElementById('estimateProgressText'),
  estimateProgressTime: document.getElementById('estimateProgressTime'),
  goalModal: document.getElementById('goalModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  closeModalBtn: document.getElementById('closeModalBtn')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  elements.startButton.addEventListener('click', startMonitoring);
  elements.clearDataBtn.addEventListener('click', clearHistory);
  elements.stopSoundBtn.addEventListener('click', toggleSoundStop);
  elements.testSoundBtn.addEventListener('click', testNotificationSound);
  elements.confirmLevelBtn.addEventListener('click', confirmNotificationLevel);
  elements.closeModalBtn.addEventListener('click', closeGoalModal);

  // Cargar configuración desde localStorage
  soundEnabled = localStorage.getItem('soundEnabled') === 'true';
  isSoundStopped = localStorage.getItem('isSoundStopped') === 'true';
  confirmedNotificationLevel = parseInt(localStorage.getItem('notificationLevel')) || 400;

  elements.notificationLevel.value = confirmedNotificationLevel;
  updateSoundStatus();
  updateStopButton();
  initializeSound();
});

// Funciones de sonido
function initializeSound() {
  notificationSound = new Audio(NOTIFICATION_SOUND_URL);
  notificationSound.volume = volume;
  notificationSound.preload = 'auto';
}

function updateSoundStatus() {
  elements.soundStatus.textContent = soundEnabled ? 'Sonido activado' : 'Sonido desactivado';
  elements.soundStatus.style.color = soundEnabled ? 'var(--primary)' : 'var(--warning)';
  localStorage.setItem('soundEnabled', soundEnabled);
}

function updateStopButton() {
  elements.stopSoundBtn.textContent = isSoundStopped ? 'Reactivar' : 'Silenciar';
  elements.stopSoundBtn.className = isSoundStopped ? 'button-warning' : 'button-danger';
  localStorage.setItem('isSoundStopped', isSoundStopped);
}

function toggleSoundStop() {
  isSoundStopped = !isSoundStopped;
  updateStopButton();
  if (isSoundStopped && notificationSound) {
    notificationSound.pause();
    notificationSound.currentTime = 0;
    notificationSound.loop = false;
    elements.goalModal.style.display = 'none';
  }
}

function testNotificationSound() {
  soundEnabled = true;
  isSoundStopped = false;
  updateSoundStatus();
  updateStopButton();
  playNotificationSound(false);
}

function playNotificationSound(loop = true) {
  if (soundEnabled && notificationSound && !isSoundStopped) {
    try {
      notificationSound.currentTime = 0;
      notificationSound.loop = loop;
      notificationSound.play().catch(e => {
        console.error("Error al reproducir sonido:", e);
        elements.soundStatus.textContent = "Error al reproducir sonido";
      });
    } catch (e) {
      console.error("Error con el sonido:", e);
      elements.soundStatus.textContent = "Error con el sonido";
    }
  }
}

function stopNotificationSound() {
  if (notificationSound) {
    notificationSound.pause();
    notificationSound.currentTime = 0;
    notificationSound.loop = false;
  }
}

// Funciones de interfaz
function showGoalModal(type, message) {
  elements.modalTitle.textContent = type === 'level' ? '¡Meta Alcanzada!' : '¡Personaje Desconectado!';
  elements.modalMessage.textContent = message;
  elements.goalModal.style.display = 'flex';
}

function closeGoalModal() {
  elements.goalModal.style.display = 'none';
  stopNotificationSound();
}

function confirmNotificationLevel() {
  const level = parseInt(elements.notificationLevel.value);
  if (isNaN(level) || level < 1 || level > MAX_LEVEL) {
    alert('Por favor, ingresa un nivel válido entre 1 y 400');
    return;
  }
  confirmedNotificationLevel = level;
  localStorage.setItem('notificationLevel', confirmedNotificationLevel);
  elements.output.innerHTML = `<p class="success">✓ Notificación establecida en nivel ${confirmedNotificationLevel}</p>`;
}

// Funciones de formato
function formatTime(seconds) {
  seconds = Math.round(seconds);
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Funciones de cálculo
function calculateAverageLevelTime(history) {
  const levelTimes = [];
  
  // Recorrer el historial para encontrar cambios de nivel
  for (let i = 1; i < history.length; i++) {
    if (history[i].level > history[i-1].level) {
      const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp));
      levelTimes.push(timeDiff / 1000); // Convertir a segundos
    }
  }
  
  // Calcular promedio de los últimos 5 niveles (o todos si hay menos de 5)
  const recentTimes = levelTimes.slice(-5);
  if (recentTimes.length === 0) return null;
  
  // Filtrar valores atípicos (más del doble del promedio)
  const avg = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
  const filteredTimes = recentTimes.filter(time => time <= avg * 2 && time > 0);
  
  // Si todos los tiempos son atípicos, usar el más reciente
  if (filteredTimes.length === 0 && recentTimes.length > 0) {
    return recentTimes[recentTimes.length - 1];
  }
  
  const sum = filteredTimes.reduce((s, t) => s + t, 0);
  return sum / filteredTimes.length;
}

function updateLevelProgress() {
  if (!currentLevelStartTime || !averageLevelTime || averageLevelTime <= 0) {
    // Si no tenemos datos suficientes, reiniciar las barras
    elements.levelProgressBar.style.width = '0%';
    elements.levelProgressText.textContent = '0%';
    elements.levelProgressTime.textContent = '00:00:00';
    elements.estimateProgressBar.style.width = '0%';
    elements.estimateProgressText.textContent = '0%';
    elements.estimateProgressTime.textContent = '00:00:00';
    return;
  }
  
  const now = new Date();
  const timeInLevel = (now - new Date(currentLevelStartTime)) / 1000;
  let progressPercent = Math.min(100, (timeInLevel / averageLevelTime) * 100);
  
  // Asegurarnos de que el porcentaje no sea NaN
  if (isNaN(progressPercent)) {
    progressPercent = 0;
  }
  
  // Actualizar barra de progreso del tiempo en nivel
  elements.levelProgressBar.style.width = `${progressPercent}%`;
  elements.levelProgressText.textContent = `${Math.round(progressPercent)}%`;
  elements.levelProgressTime.textContent = formatTime(timeInLevel);
  elements.currentLevelTime.textContent = formatTime(timeInLevel);
  
  // Actualizar tiempo estimado para subir
  if (progressPercent < 100) {
    const remainingTime = Math.max(0, averageLevelTime - timeInLevel);
    elements.timeToLevelUp.textContent = formatTime(remainingTime);
    elements.estimateProgressBar.style.width = `${progressPercent}%`;
    elements.estimateProgressText.textContent = `${Math.round(progressPercent)}%`;
    elements.estimateProgressTime.textContent = formatTime(remainingTime);
  } else {
    // Si ya pasamos el tiempo promedio, mostrar que debería haber subido
    elements.timeToLevelUp.textContent = '¡Debería subir!';
    elements.estimateProgressBar.style.width = '100%';
    elements.estimateProgressText.textContent = '100%';
    elements.estimateProgressTime.textContent = '00:00:00';
  }
}

// Funciones de gráfico
function buildLevelHistory(history, maxItems = 10) {
  const levels = [];
  const times = [];
  
  for (let i = 1; i < history.length; i++) {
    if (history[i].level > history[i-1].level) {
      const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp));
      levels.push(history[i].level);
      times.push(timeDiff / 1000); // Convertir a segundos
    }
  }
  
  return {
    levels: levels.slice(-maxItems),
    times: times.slice(-maxItems)
  };
}

function updateLevelChart(historyData) {
  elements.levelChart.innerHTML = '';
  const maxTime = Math.max(...historyData.times, 10);
  
  historyData.levels.forEach((level, index) => {
    const barHeight = (historyData.times[index] / maxTime) * 100;
    const bar = document.createElement('div');
    bar.className = 'level-bar';
    bar.style.height = `${barHeight}%`;
    
    const label = document.createElement('div');
    label.className = 'level-label';
    label.textContent = level;
    
    bar.appendChild(label);
    elements.levelChart.appendChild(bar);
  });
}

// Funciones de monitoreo
async function fetchLevel(name) {
  const response = await fetch(`/level?name=${encodeURIComponent(name)}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Error desconocido');
  }
  return await response.json();
}

async function monitor(name) {
  try {
    const { level, isOnline } = await fetchLevel(name);
    const now = new Date().toISOString();
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;
    
    // Actualizar estado en línea
    elements.onlineStatus.textContent = isOnline ? 'Online' : 'Offline';
    elements.onlineStatus.style.color = isOnline ? 'var(--primary)' : 'var(--danger)';
    
    // Verificar si el nivel cambió
    if (!lastEntry || lastEntry.level !== level) {
      // Agregar nueva entrada al historial
      history.push({ level, timestamp: now });
      saveHistory(name, history);
      
      // Si el nivel cambió, reiniciar el tiempo de inicio del nivel
      currentLevelStartTime = now;
      
      // Calcular nuevo promedio de tiempo por nivel
      averageLevelTime = calculateAverageLevelTime(history);
      
      // Reiniciar el intervalo de progreso si es necesario
      if (levelProgressInterval) {
        clearInterval(levelProgressInterval);
      }
      levelProgressInterval = setInterval(updateLevelProgress, 1000);
      
      // Actualizar gráfico
      const historyData = buildLevelHistory(history);
      updateLevelChart(historyData);
      
      // Notificar si se alcanzó el nivel objetivo
      if (level === confirmedNotificationLevel && !isSoundStopped) {
        playNotificationSound(true);
        showGoalModal('level', `¡Has alcanzado el nivel ${level}!`);
        elements.output.innerHTML += `<p class="success">🎉 ¡Meta alcanzada! Nivel ${level} obtenido.</p>`;
      }
    }
    
    // Actualizar nivel actual
    currentLevel = level;
    elements.currentLevel.textContent = level;
    elements.statsPanel.style.display = 'block';
    elements.updateProgress.style.display = 'block';
    
    // Actualizar progreso inmediatamente
    updateLevelProgress();
    
    // Manejar estado offline
    if (!isOnline && !isSoundStopped) {
      playNotificationSound(true);
      showGoalModal('offline', `¡${name} está desconectado!`);
      elements.output.innerHTML += `<p class="alert">⚠️ ¡Personaje desconectado!</p>`;
    }
    
    startCountdown();
    
  } catch (err) {
    elements.output.innerHTML = `<p class="warning">⚠️ ${err.message}</p>`;
    elements.onlineStatus.textContent = 'Error';
    elements.onlineStatus.style.color = 'var(--warning)';
  }
}

function startCountdown() {
  clearInterval(countdownInterval);
  timeLeft = CHECK_INTERVAL / 1000;
  updateProgressBar(100);
  
  countdownInterval = setInterval(() => {
    timeLeft--;
    const percent = (timeLeft / (CHECK_INTERVAL / 1000)) * 100;
    updateProgressBar(percent);
    
    if (timeLeft <= 0) {
      timeLeft = CHECK_INTERVAL / 1000;
    }
  }, 1000);
}

function updateProgressBar(percent) {
  elements.updateProgressBar.style.width = `${percent}%`;
  elements.updateProgressText.textContent = `Actualizando en ${timeLeft}s`;
}

// Funciones de almacenamiento
function loadHistory(name) {
  const stored = localStorage.getItem(`history_${name}`);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.length > 0) {
      currentLevelStartTime = parsed[parsed.length - 1].timestamp;
      currentLevel = parsed[parsed.length - 1].level;
      averageLevelTime = calculateAverageLevelTime(parsed);
    }
    return parsed;
  }
  return [];
}

function saveHistory(name, history) {
  localStorage.setItem(`history_${name}`, JSON.stringify(history));
}

function clearHistory() {
  const name = elements.characterName.value.trim();
  if (!name) return alert('Ingresa un nombre para borrar sus datos');
  
  if (confirm(`¿Borrar todos los datos de ${name}?`)) {
    localStorage.removeItem(`history_${name}`);
    history = [];
    currentLevelStartTime = null;
    averageLevelTime = null;
    currentLevel = 0;
    if (levelProgressInterval) {
      clearInterval(levelProgressInterval);
      levelProgressInterval = null;
    }
    elements.output.innerHTML = `<p class="success">✓ Datos borrados para ${name}</p>`;
    elements.statsPanel.style.display = 'none';
    elements.updateProgress.style.display = 'none';
    clearInterval(intervalId);
    clearInterval(countdownInterval);
  }
}

// Iniciar monitoreo
function startMonitoring() {
  const name = elements.characterName.value.trim();
  if (!name) return alert('Ingresa un nombre de personaje');
  
  clearInterval(intervalId);
  if (levelProgressInterval) {
    clearInterval(levelProgressInterval);
  }
  history = loadHistory(name);
  monitor(name);
  intervalId = setInterval(() => monitor(name), CHECK_INTERVAL);
}