// Configuración
const MAX_LEVEL = 400;
const CHECK_INTERVAL = 10000; // 10 segundos
const NOTIFICATION_SOUND_URL = './sound.mp3';
const LEVEL_1_ALARMED_KEY = 'level_1_alarmed';
const OFFLINE_ALARMED_KEY = 'offline_alarmed';
const TOAST_DURATION = 5000; // Duración de los globitos en ms
const MAX_LEVEL_TIME = 5940; // 99 minutos en segundos

// Variables de estado
let history = [];
let intervalId = null;
let countdownInterval = null;
let levelTimeInterval = null;
let timeLeft = CHECK_INTERVAL / 1000;
let soundEnabled = false;
let notificationSound = null;
let volume = 0.5;
let isSoundStopped = false;
let confirmedNotificationLevel = 400;
let currentLevelStartTime = null;
let averageLevelTime = null;
let currentLevel = 0;
let avgLast12 = null; // Cambiado de avgLast6 a avgLast12
let lastLevelUpTime = null;
let hasLevel1Alarmed = false;
let hasOfflineAlarmed = false;
let slowLevelUpNotified = false;
let lastModalType = null;
let slowThreshold = 180;
let isMonitoring = false;

// Elementos DOM
const elements = {
  startButton: document.getElementById('startButton'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  stopSoundBtn: document.getElementById('stopSoundBtn'),
  characterName: document.getElementById('characterName'),
  slowThreshold: document.getElementById('slowThreshold'),
  toastContainer: document.getElementById('toastContainer'),
  currentLevel: document.getElementById('currentLevel'),
  onlineStatus: document.getElementById('onlineStatus'),
  lastLevelUpTime: document.getElementById('lastLevelUpTime'),
  avgLast12: document.getElementById('avgLast12'), // Cambiado de avgLast6 a avgLast12
  levelTimeText: document.getElementById('levelTimeText'),
  notificationLevel: document.getElementById('notificationLevel'),
  testSoundBtn: document.getElementById('testSoundBtn'),
  soundStatus: document.getElementById('soundStatus'),
  notificationVolume: document.getElementById('notificationVolume'),
  goalModal: document.getElementById('goalModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  levelChart: document.getElementById('levelChart'),
  statsPanel: document.getElementById('statsPanel')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded at 12:50 AM -04, July 31, 2025');

  // Validate all required elements
  if (!elements.toastContainer) console.error('Toast container not found in DOM');
  if (!elements.levelChart) console.error('LevelChart element not found in DOM');
  if (!elements.levelTimeText) console.error('Level time text not found in DOM');
  if (!elements.startButton) console.error('Start button not found in DOM');
  if (!elements.statsPanel) console.error('Stats panel not found in DOM');

  elements.startButton.addEventListener('click', handleStartButton);
  elements.clearAllBtn.addEventListener('click', clearAllData);
  elements.stopSoundBtn.addEventListener('click', toggleSoundStop);
  elements.testSoundBtn.addEventListener('click', testNotificationSound);
  elements.slowThreshold.addEventListener('input', validateSlowThreshold);
  elements.slowThreshold.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmSlowThreshold();
  });
  elements.slowThreshold.addEventListener('blur', confirmSlowThreshold);
  elements.notificationLevel.addEventListener('input', validateNotificationLevel);
  elements.notificationLevel.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmNotificationLevel();
  });
  elements.notificationLevel.addEventListener('blur', confirmNotificationLevel);
  elements.notificationVolume.addEventListener('input', updateVolume);
  elements.characterName.addEventListener('input', () => {
    if (isMonitoring) {
      isMonitoring = false;
      clearInterval(intervalId);
      clearInterval(countdownInterval);
      clearInterval(levelTimeInterval);
      elements.startButton.textContent = '▶️ Iniciar';
      elements.startButton.classList.remove('updating');
      if (elements.levelChart) {
        elements.levelChart.innerHTML = '<p class="warning">Ingresa un nombre y haz clic en Iniciar</p>';
      }
      if (elements.statsPanel) elements.statsPanel.style.display = 'none';
      elements.characterName.classList.remove('active-monitoring');
    }
  });

  soundEnabled = localStorage.getItem('soundEnabled') === 'true';
  isSoundStopped = localStorage.getItem('isSoundStopped') === 'true';
  confirmedNotificationLevel = parseInt(localStorage.getItem('notificationLevel')) || 400;
  volume = parseFloat(localStorage.getItem('notificationVolume')) || 0.5;
  hasLevel1Alarmed = localStorage.getItem(LEVEL_1_ALARMED_KEY) === 'true';
  hasOfflineAlarmed = localStorage.getItem(OFFLINE_ALARMED_KEY) === 'true';
  slowThreshold = parseInt(localStorage.getItem('slowThreshold')) || 180;

  elements.notificationLevel.value = confirmedNotificationLevel;
  elements.slowThreshold.value = slowThreshold;
  elements.notificationVolume.value = volume;
  updateSoundStatus();
  updateStopButton();
  initializeSound();
});

// Funciones de interfaz
function handleStartButton() {
  if (isMonitoring) return;
  const name = elements.characterName.value.trim();
  if (!name) {
    showToast('⚠️ Ingresa un nombre de personaje válido', 'warning');
    elements.characterName.classList.add('invalid');
    return;
  }
  elements.characterName.classList.remove('invalid');
  elements.startButton.textContent = '🔄 Actualizando';
  elements.startButton.classList.add('updating');
  startMonitoring();
}

function updateVolume() {
  volume = parseFloat(elements.notificationVolume.value);
  if (notificationSound) notificationSound.volume = volume;
  localStorage.setItem('notificationVolume', volume);
}

function validateSlowThreshold() {
  const value = parseInt(elements.slowThreshold.value);
  if (isNaN(value) || value < 0) {
    elements.slowThreshold.classList.add('invalid');
  } else {
    elements.slowThreshold.classList.remove('invalid');
  }
}

function confirmSlowThreshold() {
  const value = parseInt(elements.slowThreshold.value);
  if (isNaN(value) || value < 0) {
    showToast('⚠️ Umbral de subida lenta debe ser un número positivo', 'warning');
    elements.slowThreshold.value = slowThreshold;
    return;
  }
  slowThreshold = value;
  localStorage.setItem('slowThreshold', slowThreshold);
  showToast(`✓ Umbral de subida lenta ajustado a ${slowThreshold} segundos`, 'success');
  elements.slowThreshold.classList.remove('invalid');
}

function validateNotificationLevel() {
  const level = parseInt(elements.notificationLevel.value);
  if (isNaN(level) || level < 1 || level > MAX_LEVEL) {
    elements.notificationLevel.classList.add('invalid');
  } else {
    elements.notificationLevel.classList.remove('invalid');
  }
}

function confirmNotificationLevel() {
  const level = parseInt(elements.notificationLevel.value);
  if (isNaN(level) || level < 1 || level > MAX_LEVEL) {
    showToast('⚠️ Nivel debe estar entre 1 y 400', 'warning');
    elements.notificationLevel.value = confirmedNotificationLevel;
    return;
  }
  confirmedNotificationLevel = level;
  localStorage.setItem('notificationLevel', confirmedNotificationLevel);
  showToast(`✓ Notificación establecida en nivel ${confirmedNotificationLevel}`, 'success');
  elements.notificationLevel.classList.remove('invalid');
}

// Funciones de sonido
function initializeSound() {
  try {
    notificationSound = new Audio(NOTIFICATION_SOUND_URL);
    notificationSound.volume = volume;
    notificationSound.preload = 'auto';
    console.log('Sound initialized:', NOTIFICATION_SOUND_URL);
  } catch (err) {
    console.error('Error initializing sound:', err);
    showToast('⚠️ Error al cargar el archivo de sonido', 'warning');
  }
}

function updateSoundStatus() {
  elements.soundStatus.textContent = soundEnabled ? 'Sonido activado' : 'Sonido desactivado';
  elements.soundStatus.style.color = soundEnabled ? 'var(--primary)' : 'var(--warning)';
  localStorage.setItem('soundEnabled', soundEnabled);
}

function updateStopButton() {
  elements.stopSoundBtn.textContent = isSoundStopped ? '🔊 Reactivar' : '🔇 Silenciar';
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
    if (lastModalType === 'delay') {
      console.log('Slow level-up notification stopped due to silencing');
    }
  }
}

function testNotificationSound() {
  if (!notificationSound) {
    showToast('⚠️ Sonido no disponible. Verifica el archivo de audio.', 'warning');
    return;
  }
  soundEnabled = true;
  isSoundStopped = false;
  updateSoundStatus();
  updateStopButton();
  playNotificationSound(false);
}

function playNotificationSound(loop = false) {
  if (!soundEnabled || !notificationSound || isSoundStopped) return;
  try {
    notificationSound.currentTime = 0;
    notificationSound.loop = loop;
    notificationSound.play().catch(e => {
      console.error("Error al reproducir sonido:", e);
      showToast("⚠️ Error al reproducir sonido. Verifica los permisos del navegador.", 'warning');
    });
  } catch (e) {
    console.error("Error con el sonido:", e);
    showToast("⚠️ Error con el sonido", 'warning');
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
  lastModalType = type;
  elements.modalTitle.textContent = 
    type === 'level' ? '¡Meta Alcanzada!' :
    type === 'offline' ? '¡Personaje Desconectado!' :
    type === 'level1' ? '¡Nivel 1 Detectado!' :
    '¡Demora en Subir de Nivel!';
  elements.modalMessage.textContent = message;
  elements.goalModal.style.display = 'flex';
  console.log(`Showing modal: type=${type}, message=${message}`);
}

function closeGoalModal() {
  elements.goalModal.style.display = 'none';
  stopNotificationSound();
  if (lastModalType === 'delay') {
    slowLevelUpNotified = true;
    console.log('Slow level-up notification marked as notified');
  }
  if (lastModalType === 'offline') {
    hasOfflineAlarmed = true;
    localStorage.setItem(OFFLINE_ALARMED_KEY, 'true');
  }
  if (lastModalType === 'level1') {
    hasLevel1Alarmed = true;
    localStorage.setItem(LEVEL_1_ALARMED_KEY, 'true');
  }
}

function showToast(message, type) {
  if (!elements.toastContainer) {
    console.error('Cannot show toast: toastContainer is undefined');
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, TOAST_DURATION);
}

// Funciones de formato
function formatTime(seconds) {
  if (!seconds || seconds < 0) return 'N/A';
  seconds = Math.round(seconds); // Round to nearest second
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`; // Solo minutos y segundos
}

function formatStopwatch(seconds) {
  if (seconds >= MAX_LEVEL_TIME) {
    return '00:00'; // Reset to 00:00 if over 99 minutes
  }
  const totalSeconds = Math.floor(seconds % 3600);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

// Funciones de cálculo
function calculateAverageLevelTime(history) {
  const levelTimes = [];

  for (let i = 1; i < history.length; i++) {
    if (history[i].level > history[i-1].level) {
      const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp)) / 1000;
      const levelDiff = history[i].level - history[i-1].level;
      const timePerLevel = timeDiff / levelDiff;
      if (!isNaN(timePerLevel) && timePerLevel > 0) {
        for (let j = 0; j < levelDiff; j++) {
          levelTimes.push(timePerLevel);
        }
      } else {
        console.warn(`Invalid timePerLevel: ${timePerLevel} for level ${history[i].level}`);
      }
    }
  }

  const recentTimes = levelTimes.slice(-12); // Cambiado de -6 a -12 para últimos 12 niveles
  if (recentTimes.length === 0) return null;

  const avg = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
  const filteredTimes = recentTimes.filter(time => time <= avg * 2 && time > 0);

  if (filteredTimes.length === 0 && recentTimes.length > 0) {
    return recentTimes[recentTimes.length - 1];
  }

  const sum = filteredTimes.reduce((s, t) => s + t, 0);
  return sum / filteredTimes.length;
}

function calculateLast12Avg(history) { // Cambiado de calculateLast6Avg a calculateLast12Avg
  const levelTimes = [];

  for (let i = 1; i < history.length; i++) {
    if (history[i].level > history[i-1].level) {
      const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp)) / 1000;
      const levelDiff = history[i].level - history[i-1].level;
      const timePerLevel = timeDiff / levelDiff;
      if (!isNaN(timePerLevel) && timePerLevel > 0) {
        for (let j = 0; j < levelDiff; j++) {
          levelTimes.push(timePerLevel);
        }
      } else {
        console.warn(`Invalid timePerLevel: ${timePerLevel} for level ${history[i].level}`);
      }
    }
  }

  const recentTimes = levelTimes.slice(-12); // Cambiado de -6 a -12 para últimos 12 niveles
  if (recentTimes.length === 0) return null;

  const sum = recentTimes.reduce((s, t) => s + t, 0);
  return sum / recentTimes.length;
}

// Funciones de gráfico
function buildLevelHistory(history, maxItems = 10) {
  const levels = [];
  const times = [];

  console.log('Building level history with data:', history);

  if (history.length === 1) {
    levels.push(history[0].level);
    times.push(0);
    console.log('Single history entry, using placeholder time=0');
  } else if (history.length > 1) {
    for (let i = 1; i < history.length; i++) {
      if (history[i].level > history[i-1].level) {
        const timeDiff = (new Date(history[i].timestamp) - new Date(history[i-1].timestamp)) / 1000;
        const levelDiff = history[i].level - history[i-1].level;
        const timePerLevel = timeDiff / levelDiff;
        if (!isNaN(timePerLevel) && timePerLevel > 0) {
          for (let j = 0; j < levelDiff; j++) {
            levels.push(history[i-1].level + j + 1);
            times.push(timePerLevel);
          }
        } else {
          console.warn(`Invalid timePerLevel: ${timePerLevel} for level ${history[i].level}`);
        }
      } else {
        console.log(`No level increase: ${history[i-1].level} to ${history[i].level}`);
      }
    }
  }

  const result = {
    levels: levels.slice(-maxItems),
    times: times.slice(-maxItems),
    nextLevelTimes: []
  };

  console.log('Level history built:', result);
  return result;
}

function updateLevelChart(historyData) {
  console.log('Updating level chart with data:', historyData);

  if (!elements.levelChart) {
    console.error('Cannot update chart: levelChart element is undefined');
    showToast('⚠️ Error al actualizar gráfico', 'warning');
    return;
  }

  elements.levelChart.innerHTML = '';

  if (!historyData.levels.length || !historyData.times.length) {
    console.warn('No data to display in chart');
    elements.levelChart.innerHTML = '<p class="warning">No hay datos de historial para mostrar</p>';
    return;
  }

  const validTimes = historyData.times.filter(t => !isNaN(t) && t >= 0);
  const maxTime = validTimes.length > 0 ? Math.max(...validTimes, 10) : 10;

  historyData.levels.forEach((level, index) => {
    const time = historyData.times[index];
    if (!isNaN(time) && time >= 0) {
      const barHeight = (time / maxTime) * 100 || 10;
      const bar = document.createElement('div');
      bar.className = 'level-bar';
      bar.style.height = `${barHeight}%`;

      const label = document.createElement('div');
      label.className = 'level-label';
      label.textContent = time === 0 ? `${level} (N/A)` : `${level} (${formatStopwatch(time)})`;
      console.log(`Chart label for level ${level}: ${label.textContent} using formatStopwatch`);

      bar.appendChild(label);
      elements.levelChart.appendChild(bar);
    } else {
      console.warn(`Skipping invalid time: ${time} for level ${level}`);
    }
  });

  console.log('Chart updated, bars rendered:', elements.levelChart.children.length);
}

// Funciones de conteo
function startCountdown() {
  clearInterval(countdownInterval);
  timeLeft = CHECK_INTERVAL / 1000;
  updateButtonText();

  countdownInterval = setInterval(() => {
    timeLeft--;
    updateButtonText();

    if (timeLeft <= 0) {
      timeLeft = CHECK_INTERVAL / 1000;
      if (isMonitoring) monitor(elements.characterName.value.trim());
    }
  }, 1000);
}

function updateButtonText() {
  if (isMonitoring) {
    elements.startButton.textContent = `🔄 ${Math.round(timeLeft)}`;
  } else {
    elements.startButton.textContent = '▶️ Iniciar';
    elements.startButton.classList.remove('updating');
  }
}

function updateLevelTimeCircle() {
  if (!currentLevelStartTime || !elements.levelTimeText) {
    console.warn('updateLevelTimeCircle: currentLevelStartTime or levelTimeText is null');
    if (elements.levelTimeText) {
      elements.levelTimeText.textContent = '00:00';
      console.log('levelTimeText set to 00:00 due to null currentLevelStartTime or levelTimeText');
    }
    return;
  }
  const timeSinceLastLevelUp = (new Date() - new Date(currentLevelStartTime)) / 1000;
  console.log(`updateLevelTimeCircle: timeSinceLastLevelUp=${timeSinceLastLevelUp}, currentLevelStartTime=${currentLevelStartTime}`);
  if (timeSinceLastLevelUp >= MAX_LEVEL_TIME) {
    currentLevelStartTime = new Date().toISOString(); // Reset timer
    elements.levelTimeText.textContent = '00:00';
    console.log('Timer reset to 00:00 as it exceeded 99 minutes');
  } else {
    const formattedTime = formatStopwatch(timeSinceLastLevelUp);
    elements.levelTimeText.textContent = formattedTime;
    console.log(`levelTimeText updated to ${formattedTime} using formatStopwatch`);
  }
}

function startLevelTimeCountdown() {
  clearInterval(levelTimeInterval);
  updateLevelTimeCircle();
  levelTimeInterval = setInterval(updateLevelTimeCircle, 1000);
  console.log('startLevelTimeCountdown: Started interval for levelTimeText with formatStopwatch');
}

// Funciones de almacenamiento
async function loadHistory(name) {
  console.log(`Loading history for ${name}`);
  try {
    const response = await fetch(`/history?name=${encodeURIComponent(name)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Historial inválido: no es un arreglo');
    }
    console.log(`History loaded for ${name}:`, data);
    if (data.length > 0) {
      currentLevelStartTime = data[data.length - 1].timestamp;
      currentLevel = data[data.length - 1].level;
      averageLevelTime = calculateAverageLevelTime(data);
      avgLast12 = calculateLast12Avg(data); // Cambiado de calculateLast6Avg a calculateLast12Avg

      if (avgLast12 && elements.avgLast12) {
        elements.avgLast12.textContent = formatTime(avgLast12);
      }

      for (let i = data.length - 1; i > 0; i--) {
        if (data[i].level > history[i-1].level) {
          lastLevelUpTime = (new Date(data[i].timestamp) - new Date(data[i-1].timestamp)) / 1000;
          if (elements.lastLevelUpTime) elements.lastLevelUpTime.textContent = formatTime(lastLevelUpTime);
          console.log(`Last level-up time calculated: ${lastLevelUpTime} seconds for level ${data[i].level}`);
          break;
        }
      }

      const historyData = buildLevelHistory(data);
      updateLevelChart(historyData);
    }
    return data;
  } catch (err) {
    console.error('Error loading history:', err);
    showToast(`⚠️ Error al cargar historial: ${err.message}`, 'warning');
    return [];
  }
}

async function saveHistory(name, history) {
  console.log(`Saving history for ${name}:`, history);
  try {
    const response = await fetch('/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, history })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (err) {
    console.error('Error saving history:', err);
    showToast(`⚠️ Error al guardar historial: ${err.message}`, 'warning');
  }
}

async function clearAllData() {
  const name = elements.characterName.value.trim();
  if (!name) {
    showToast('⚠️ Ingresa un nombre de personaje para borrar sus datos', 'warning');
    return;
  }

  if (confirm(`¿Borrar todos los datos y archivo de historial para ${name}?`)) {
    try {
      const response = await fetch(`/history?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      history = [];
      currentLevelStartTime = null;
      averageLevelTime = null;
      currentLevel = 0;
      avgLast12 = null; // Cambiado de avgLast6 a avgLast12
      lastLevelUpTime = null;
      hasLevel1Alarmed = false;
      hasOfflineAlarmed = false;
      slowLevelUpNotified = false;
      localStorage.setItem(LEVEL_1_ALARMED_KEY, 'false');
      localStorage.setItem(OFFLINE_ALARMED_KEY, 'false');
      await saveHistory(name, history);
      showToast(`✓ Todos los datos borrados para ${name}`, 'success');
      if (elements.statsPanel) elements.statsPanel.style.display = 'none';
      elements.characterName.classList.remove('active-monitoring');
      clearInterval(intervalId);
      clearInterval(countdownInterval);
      clearInterval(levelTimeInterval);
      if (elements.currentLevel) elements.currentLevel.textContent = '0';
      if (elements.onlineStatus) {
        elements.onlineStatus.textContent = 'Desconocido';
        elements.onlineStatus.style.color = 'inherit';
      }
      if (elements.lastLevelUpTime) elements.lastLevelUpTime.textContent = 'N/A';
      if (elements.avgLast12) elements.avgLast12.textContent = '00:00'; // Cambiado de 00:00:00 a 00:00
      if (elements.levelTimeText) elements.levelTimeText.textContent = '00:00';
      if (elements.levelChart) {
        elements.levelChart.innerHTML = '<p class="warning">Historial borrado</p>';
      } else {
        console.error('Cannot set levelChart.innerHTML: levelChart element is undefined in clearAllData');
      }
      isMonitoring = false;
      updateButtonText();
    } catch (err) {
      console.error(`Error clearing data for ${name}:`, err);
      showToast(`⚠️ Error al borrar datos: ${err.message}`, 'warning');
    }
  }
}

// Funciones de monitoreo
async function fetchLevel(name) {
  console.log(`Fetching level for ${name}`);
  try {
    const response = await fetch(`/level?name=${encodeURIComponent(name)}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Personaje no encontrado');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Level data received for ${name}:`, data);
    if (!data.level || typeof data.isOnline !== 'boolean') {
      throw new Error('Formato de datos inválido');
    }
    return data;
  } catch (err) {
    console.error('Error fetching level:', err);
    if (err.message === 'Personaje no encontrado') {
      showToast(`⚠️ Personaje "${name}" no encontrado`, 'warning');
    } else {
      showToast(`⚠️ Error al obtener nivel: ${err.message}`, 'warning');
    }
    throw err;
  }
}

async function monitor(name) {
  console.log(`Monitoring ${name} at ${new Date().toISOString()}`);
  try {
    const { level, isOnline } = await fetchLevel(name);
    const now = new Date().toISOString();
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;

    if (elements.onlineStatus) {
      elements.onlineStatus.textContent = isOnline ? 'Online' : 'Offline';
      elements.onlineStatus.style.color = isOnline ? 'var(--primary)' : 'var(--danger)';
    }

    if (isOnline && hasOfflineAlarmed) {
      hasOfflineAlarmed = false;
      localStorage.setItem(OFFLINE_ALARMED_KEY, 'false');
      console.log('Offline alarm reset due to online status');
    }
    if (level > 1 && hasLevel1Alarmed) {
      hasLevel1Alarmed = false;
      localStorage.setItem(LEVEL_1_ALARMED_KEY, 'false');
      console.log('Level 1 alarm reset due to level > 1');
    }

    if (!lastEntry || lastEntry.level !== level || lastEntry.isOnline !== isOnline) {
      history.push({ level, isOnline, timestamp: now });
      await saveHistory(name, history);

      if (lastEntry && lastEntry.level < level) {
        lastLevelUpTime = (new Date(now) - new Date(lastEntry.timestamp)) / 1000;
        if (elements.lastLevelUpTime) elements.lastLevelUpTime.textContent = formatTime(lastLevelUpTime);
        console.log(`Level up detected, lastLevelUpTime: ${lastLevelUpTime} seconds`);
        slowLevelUpNotified = false;
        console.log('Slow level-up notification reset due to level up');
        currentLevelStartTime = now; // Update on level-up
      } else if (!lastEntry) {
        currentLevelStartTime = now; // Initialize for first entry
      }

      averageLevelTime = calculateAverageLevelTime(history);
      avgLast12 = calculateLast12Avg(history); // Cambiado de calculateLast6Avg a calculateLast12Avg

      if (avgLast12 && elements.avgLast12) {
        elements.avgLast12.textContent = formatTime(avgLast12);
      }

      const historyData = buildLevelHistory(history);
      updateLevelChart(historyData);

      if (level === confirmedNotificationLevel && !isSoundStopped) {
        playNotificationSound(true);
        showGoalModal('level', `¡Has alcanzado el nivel ${level}!`);
        showToast(`🎉 ¡Meta alcanzada! Nivel ${level} obtenido.`, 'success');
      }

      if (level === 1 && !hasLevel1Alarmed && !isSoundStopped) {
        playNotificationSound(true);
        showGoalModal('level1', `¡Estás en nivel 1!`);
        showToast(`⚠️ ¡Personaje en nivel 1!`, 'warning');
        hasLevel1Alarmed = true;
        localStorage.setItem(LEVEL_1_ALARMED_KEY, 'true');
      }

      if (!isOnline && !hasOfflineAlarmed && !isSoundStopped) {
        playNotificationSound(true);
        showGoalModal('offline', `¡${name} está desconectado!`);
        showToast(`⚠️ ¡Personaje desconectado!`, 'alert');
        hasOfflineAlarmed = true;
        localStorage.setItem(OFFLINE_ALARMED_KEY, 'true');
      }
    }

    if (currentLevelStartTime && isOnline && !isSoundStopped && currentLevel < MAX_LEVEL && !slowLevelUpNotified) {
      const timeSinceLastLevelUp = (new Date(now) - new Date(currentLevelStartTime)) / 1000;
      const slowLevelThreshold = (lastLevelUpTime || 0) + slowThreshold;
      console.log(`Slow level-up check: timeSinceLastLevelUp=${timeSinceLastLevelUp}, lastLevelUpTime=${lastLevelUpTime || 'N/A'}, slowThreshold=${slowThreshold}, totalThreshold=${slowLevelThreshold}, slowLevelUpNotified=${slowLevelUpNotified}`);
      if (timeSinceLastLevelUp > slowLevelThreshold) {
        playNotificationSound(true);
        showGoalModal('delay', `¡Subida lenta detectada! Tiempo: ${formatStopwatch(timeSinceLastLevelUp)}, Umbral: ${formatStopwatch(slowLevelThreshold)}`);
        showToast(`⚠️ Subida lenta: ${formatStopwatch(timeSinceLastLevelUp)} (Umbral: ${formatStopwatch(slowLevelThreshold)})`, 'warning');
        slowLevelUpNotified = true;
      }
    }

    currentLevel = level;
    if (elements.currentLevel) elements.currentLevel.textContent = level;
    if (elements.statsPanel) elements.statsPanel.style.display = 'block';

    startLevelTimeCountdown();
  } catch (err) {
    console.error('Error in monitor:', err);
    if (elements.onlineStatus) {
      elements.onlineStatus.textContent = 'Error';
      elements.onlineStatus.style.color = 'var(--warning)';
    }
  }
}

async function startMonitoring() {
  const name = elements.characterName.value.trim();
  if (!name) {
    showToast('⚠️ Ingresa un nombre de personaje válido', 'warning');
    elements.characterName.classList.add('invalid');
    return;
  }
  elements.characterName.classList.remove('invalid');

  // Clear chart and reset stats
  if (elements.levelChart) {
    elements.levelChart.innerHTML = '<p class="warning">Esperando datos...</p>';
  }
  if (elements.currentLevel) elements.currentLevel.textContent = '0';
  if (elements.onlineStatus) {
    elements.onlineStatus.textContent = 'Desconocido';
    elements.onlineStatus.style.color = 'inherit';
  }
  if (elements.lastLevelUpTime) elements.lastLevelUpTime.textContent = 'N/A';
  if (elements.avgLast12) elements.avgLast12.textContent = '00:00'; // Cambiado de 00:00:00 a 00:00
  if (elements.levelTimeText) elements.levelTimeText.textContent = '00:00';
  history = [];
  currentLevelStartTime = new Date().toISOString();
  averageLevelTime = null;
  currentLevel = 0;
  avgLast12 = null; // Cambiado de avgLast6 a avgLast12
  lastLevelUpTime = null;
  slowLevelUpNotified = false;

  clearInterval(intervalId);
  clearInterval(levelTimeInterval);
  elements.characterName.classList.add('active-monitoring');
  history = await loadHistory(name);
  console.log(`Starting monitoring for ${name}, initial history:`, history);
  await monitor(name);
  intervalId = setInterval(() => monitor(name), CHECK_INTERVAL);
  startCountdown();
  isMonitoring = true;
}