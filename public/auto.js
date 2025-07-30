// Configuración
const MAX_LEVEL = 400;
const CHECK_INTERVAL = 10000; // 10 segundos
const NOTIFICATION_SOUND_URL = './sound.mp3';
const LEVEL_1_ALARMED_KEY = 'level_1_alarmed';
const TOAST_DURATION = 5000; // Duración de los globitos en ms

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
let avgLast6 = null;
let lastLevelUpTime = null;
let hasLevel1Alarmed = false;
let slowLevelUpNotified = false;
let lastModalType = null;
let slowThreshold = 180;

// Elementos DOM
const elements = {
  startButton: document.getElementById('startButton'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  stopSoundBtn: document.getElementById('stopSoundBtn'),
  characterName: document.getElementById('characterName'),
  slowThreshold: document.getElementById('slowThreshold'),
  toastContainer: document.getElementById('toastContainer'),
  updateProgress: document.getElementById('updateProgress'),
  updateProgressCircle: document.getElementById('updateProgressCircle'),
  updateProgressText: document.getElementById('updateProgressText'),
  statsPanel: document.getElementById('statsPanel'),
  currentLevel: document.getElementById('currentLevel'),
  onlineStatus: document.getElementById('onlineStatus'),
  lastLevelUpTime: document.getElementById('lastLevelUpTime'),
  avgLast6: document.getElementById('avgLast6'),
  levelTimeCircle: document.getElementById('levelTimeCircle'),
  levelTimeText: document.getElementById('levelTimeText'),
  notificationLevel: document.getElementById('notificationLevel'),
  confirmLevelBtn: document.getElementById('confirmLevelBtn'),
  testSoundBtn: document.getElementById('testSoundBtn'),
  soundStatus: document.getElementById('soundStatus'),
  notificationVolume: document.getElementById('notificationVolume'),
  goalModal: document.getElementById('goalModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  levelChart: document.getElementById('levelChart')
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded at 06:35 AM -04, July 30, 2025');
  
  if (!elements.toastContainer) console.error('Toast container not found in DOM');
  if (!elements.levelChart) console.error('LevelChart element not found in DOM');
  if (!elements.levelTimeCircle) console.error('Level time circle not found in DOM');
  
  elements.startButton.addEventListener('click', startMonitoring);
  elements.clearAllBtn.addEventListener('click', clearAllData);
  elements.stopSoundBtn.addEventListener('click', toggleSoundStop);
  elements.testSoundBtn.addEventListener('click', testNotificationSound);
  elements.confirmLevelBtn.addEventListener('click', confirmNotificationLevel);
  elements.closeModalBtn.addEventListener('click', closeGoalModal);
  elements.slowThreshold.addEventListener('change', updateSlowThreshold);
  elements.notificationVolume.addEventListener('input', updateVolume);

  soundEnabled = localStorage.getItem('soundEnabled') === 'true';
  isSoundStopped = localStorage.getItem('isSoundStopped') === 'true';
  confirmedNotificationLevel = parseInt(localStorage.getItem('notificationLevel')) || 400;
  volume = parseFloat(localStorage.getItem('notificationVolume')) || 0.5;
  hasLevel1Alarmed = localStorage.getItem(LEVEL_1_ALARMED_KEY) === 'true';
  slowThreshold = parseInt(localStorage.getItem('slowThreshold')) || 180;

  elements.notificationLevel.value = confirmedNotificationLevel;
  elements.slowThreshold.value = slowThreshold;
  elements.notificationVolume.value = volume;
  updateSoundStatus();
  updateStopButton();
  initializeSound();
});

function updateSlowThreshold() {
  slowThreshold = parseInt(elements.slowThreshold.value) || 180;
  if (slowThreshold < 0) slowThreshold = 0;
  localStorage.setItem('slowThreshold', slowThreshold);
  showToast(`✓ Umbral de subida lenta ajustado a ${slowThreshold} segundos`, 'success');
}

function updateVolume() {
  volume = parseFloat(elements.notificationVolume.value);
  if (notificationSound) notificationSound.volume = volume;
  localStorage.setItem('notificationVolume', volume);
}

// Funciones de sonido
function initializeSound() {
  notificationSound = new Audio(NOTIFICATION_SOUND_URL);
  notificationSound.volume = volume;
  notificationSound.preload = 'auto';
  console.log('Sound initialized:', NOTIFICATION_SOUND_URL);
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
    if (lastModalType === 'delay') {
      console.log('Slow level-up notification stopped due to silencing');
    }
  }
}

function testNotificationSound() {
  soundEnabled = true;
  isSoundStopped = false;
  updateSoundStatus();
  updateStopButton();
  playNotificationSound(false);
}

function playNotificationSound(loop = false) {
  if (soundEnabled && notificationSound && !isSoundStopped) {
    try {
      notificationSound.currentTime = 0;
      notificationSound.loop = loop;
      notificationSound.play().catch(e => {
        console.error("Error al reproducir sonido:", e);
        showToast("⚠️ Error al reproducir sonido", 'warning');
      });
    } catch (e) {
      console.error("Error con el sonido:", e);
      showToast("⚠️ Error con el sonido", 'warning');
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
    console.log('Slow level-up notification stopped due to modal close');
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

function confirmNotificationLevel() {
  const level = parseInt(elements.notificationLevel.value);
  if (isNaN(level) || level < 1 || level > MAX_LEVEL) {
    showToast('⚠️ Ingresa un nivel válido entre 1 y 400', 'warning');
    return;
  }
  confirmedNotificationLevel = level;
  localStorage.setItem('notificationLevel', confirmedNotificationLevel);
  showToast(`✓ Notificación establecida en nivel ${confirmedNotificationLevel}`, 'success');
}

// Funciones de formato
function formatTime(seconds) {
  if (!seconds || seconds < 0) return 'N/A';
  seconds = Math.round(seconds);
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
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
  
  const recentTimes = levelTimes.slice(-6);
  if (recentTimes.length === 0) return null;
  
  const avg = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
  const filteredTimes = recentTimes.filter(time => time <= avg * 2 && time > 0);
  
  if (filteredTimes.length === 0 && recentTimes.length > 0) {
    return recentTimes[recentTimes.length - 1];
  }
  
  const sum = filteredTimes.reduce((s, t) => s + t, 0);
  return sum / filteredTimes.length;
}

function calculateLast6Avg(history) {
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
  
  const recentTimes = levelTimes.slice(-6);
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
      label.textContent = time === 0 ? `${level} (N/A)` : `${level} (${formatTime(time)})`;
      
      bar.appendChild(label);
      elements.levelChart.appendChild(bar);
    } else {
      console.warn(`Skipping invalid time: ${time} for level ${level}`);
    }
  });
  
  console.log('Chart updated, bars rendered:', elements.levelChart.children.length);
}

// Funciones de conteo circular
function updateLevelTimeCircle() {
  if (!currentLevelStartTime || !elements.levelTimeText) {
    elements.levelTimeText.textContent = 'N/A';
    return;
  }
  const timeSinceLastLevelUp = (new Date() - new Date(currentLevelStartTime)) / 1000;
  elements.levelTimeText.textContent = formatTime(timeSinceLastLevelUp);
  const percent = Math.min((timeSinceLastLevelUp / ((lastLevelUpTime || 300) + slowThreshold)) * 100, 100);
  const offset = 125.6 - (percent / 100) * 125.6; // 125.6 is circumference (2 * π * 20)
  elements.levelTimeCircle.style.strokeDashoffset = offset;
}

// Funciones de almacenamiento
async function loadHistory(name) {
  console.log(`Loading history for ${name}`);
  try {
    const response = await fetch(`/history?name=${encodeURIComponent(name)}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log(`History loaded for ${name}:`, data);
    if (data.length > 0) {
      currentLevelStartTime = data[data.length - 1].timestamp;
      currentLevel = data[data.length - 1].level;
      averageLevelTime = calculateAverageLevelTime(data);
      avgLast6 = calculateLast6Avg(data);
      
      if (avgLast6) {
        elements.avgLast6.textContent = formatTime(avgLast6);
      }
      
      for (let i = data.length - 1; i > 0; i--) {
        if (data[i].level > data[i-1].level) {
          lastLevelUpTime = (new Date(data[i].timestamp) - new Date(data[i-1].timestamp)) / 1000;
          elements.lastLevelUpTime.textContent = formatTime(lastLevelUpTime);
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
    await fetch('/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, history })
    });
  } catch (err) {
    console.error('Error saving history:', err);
    showToast(`⚠️ Error al guardar historial: ${err.message}`, 'warning');
  }
}

async function clearAllData() {
  const name = elements.characterName.value.trim();
  if (!name) {
    showToast('⚠️ Ingresa un nombre para borrar sus datos', 'warning');
    return;
  }
  
  if (confirm(`¿Borrar todos los datos y archivo de historial para ${name}?`)) {
    try {
      await fetch(`/history?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      history = [];
      currentLevelStartTime = null;
      averageLevelTime = null;
      currentLevel = 0;
      avgLast6 = null;
      lastLevelUpTime = null;
      hasLevel1Alarmed = false;
      slowLevelUpNotified = false;
      localStorage.setItem(LEVEL_1_ALARMED_KEY, 'false');
      await saveHistory(name, history);
      showToast(`✓ Todos los datos borrados para ${name}`, 'success');
      elements.statsPanel.style.display = 'none';
      elements.updateProgress.style.display = 'none';
      elements.characterName.classList.remove('active-monitoring');
      clearInterval(intervalId);
      clearInterval(countdownInterval);
      clearInterval(levelTimeInterval);
      elements.avgLast6.textContent = '00:00:00';
      elements.lastLevelUpTime.textContent = 'N/A';
      elements.levelTimeText.textContent = 'N/A';
      if (elements.levelChart) {
        elements.levelChart.innerHTML = '<p class="warning">Historial borrado</p>';
      } else {
        console.error('Cannot set levelChart.innerHTML: levelChart element is undefined in clearAllData');
      }
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
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log(`Level data received for ${name}:`, data);
    if (!data.level || typeof data.isOnline !== 'boolean') {
      throw new Error('Invalid level data format');
    }
    return data;
  } catch (err) {
    console.error('Error fetching level:', err);
    showToast(`⚠️ Error al obtener nivel: ${err.message}`, 'warning');
    throw err;
  }
}

async function monitor(name) {
  console.log(`Monitoring ${name} at ${new Date().toISOString()}`);
  try {
    const { level, isOnline } = await fetchLevel(name);
    const now = new Date().toISOString();
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;
    
    elements.onlineStatus.textContent = isOnline ? 'Online' : 'Offline';
    elements.onlineStatus.style.color = isOnline ? 'var(--primary)' : 'var(--danger)';
    
    if (!lastEntry || lastEntry.level !== level) {
      history.push({ level, timestamp: now });
      await saveHistory(name, history);
      
      if (lastEntry && lastEntry.level < level) {
        lastLevelUpTime = (new Date(now) - new Date(lastEntry.timestamp)) / 1000;
        elements.lastLevelUpTime.textContent = formatTime(lastLevelUpTime);
        console.log(`Level up detected, lastLevelUpTime: ${lastLevelUpTime} seconds`);
        slowLevelUpNotified = false;
        console.log('Slow level-up notification reset due to level up');
      }
      
      currentLevelStartTime = now;
      averageLevelTime = calculateAverageLevelTime(history);
      avgLast6 = calculateLast6Avg(history);
      
      if (avgLast6) {
        elements.avgLast6.textContent = formatTime(avgLast6);
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
    } else if (level !== 1 && hasLevel1Alarmed) {
      hasLevel1Alarmed = false;
      localStorage.setItem(LEVEL_1_ALARMED_KEY, 'false');
    }
    
    if (currentLevelStartTime && !isSoundStopped && currentLevel < MAX_LEVEL && !slowLevelUpNotified) {
      const timeSinceLastLevelUp = (new Date(now) - new Date(currentLevelStartTime)) / 1000;
      const slowLevelThreshold = (lastLevelUpTime || 0) + slowThreshold;
      console.log(`Slow level-up check: timeSinceLastLevelUp=${timeSinceLastLevelUp}, lastLevelUpTime=${lastLevelUpTime || 'N/A'}, slowThreshold=${slowThreshold}, totalThreshold=${slowLevelThreshold}, slowLevelUpNotified=${slowLevelUpNotified}`);
      if (timeSinceLastLevelUp > slowLevelThreshold) {
        playNotificationSound(true);
        showGoalModal('delay', `¡Subida lenta detectada! Tiempo: ${formatTime(timeSinceLastLevelUp)}, Umbral: ${formatTime(slowLevelThreshold)}`);
        showToast(`⚠️ Subida lenta: ${formatTime(timeSinceLastLevelUp)} (Umbral: ${formatTime(slowLevelThreshold)})`, 'warning');
        slowLevelUpNotified = true;
      }
    }
    
    currentLevel = level;
    elements.currentLevel.textContent = level;
    elements.statsPanel.style.display = 'block';
    elements.updateProgress.style.display = 'block';
    
    if (!isOnline && !isSoundStopped) {
      playNotificationSound(true);
      showGoalModal('offline', `¡${name} está desconectado!`);
      showToast(`⚠️ ¡Personaje desconectado!`, 'alert');
    }
    
    startCountdown();
    startLevelTimeCountdown();
    
  } catch (err) {
    console.error('Error in monitor:', err);
    elements.onlineStatus.textContent = 'Error';
    elements.onlineStatus.style.color = 'var(--warning)';
  }
}

function startCountdown() {
  clearInterval(countdownInterval);
  timeLeft = CHECK_INTERVAL / 1000;
  updateProgressCircle(100);
  
  countdownInterval = setInterval(() => {
    timeLeft--;
    const percent = (timeLeft / (CHECK_INTERVAL / 1000)) * 100;
    updateProgressCircle(percent);
    
    if (timeLeft <= 0) {
      timeLeft = CHECK_INTERVAL / 1000;
    }
  }, 1000);
}

function updateProgressCircle(percent) {
  const offset = 125.6 - (percent / 100) * 125.6; // 125.6 is circumference (2 * π * 20)
  elements.updateProgressCircle.style.strokeDashoffset = offset;
  elements.updateProgressText.textContent = `${Math.round(timeLeft)}s`;
}

function startLevelTimeCountdown() {
  clearInterval(levelTimeInterval);
  updateLevelTimeCircle();
  levelTimeInterval = setInterval(updateLevelTimeCircle, 1000);
}

// Iniciar monitoreo
async function startMonitoring() {
  const name = elements.characterName.value.trim();
  if (!name) {
    showToast('⚠️ Ingresa un nombre de personaje', 'warning');
    return;
  }
  
  clearInterval(intervalId);
  clearInterval(levelTimeInterval);
  elements.characterName.classList.add('active-monitoring');
  history = await loadHistory(name);
  console.log(`Starting monitoring for ${name}, initial history:`, history);
  await monitor(name);
  intervalId = setInterval(() => monitor(name), CHECK_INTERVAL);
}