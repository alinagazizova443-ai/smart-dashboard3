// ============ SUPABASE ============
const SUPABASE_URL = 'https://bejonrlrnurzfjbhhrdm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sI-5JZx_kfCnvHYscYohhg_9eJ4fKmj';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let tasks = [];
let notes = [];
let userStats = {
    level: 1,
    exp: 0,
    expToNext: 100,
    totalPoints: 0,
    totalCompleted: 0,
    streak: 0,
    lastTaskDate: null,
    weeklyCompleted: [0, 0, 0, 0, 0, 0, 0]
};

let selectedCategory = 'custom';
let editingTaskId = null;
let editingNoteId = null;

const levelExpNeeded = {
    1: 100, 2: 250, 3: 450, 4: 700, 5: 1000,
    6: 1350, 7: 1750, 8: 2200, 9: 2700, 10: 3300
};

// ============ Service Worker (без изменений) ============
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker зарегистрирован:', registration);
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if (confirm('Доступна новая версия приложения. Обновить?')) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch(error => console.error('Ошибка регистрации Service Worker:', error));
    });
}

async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') console.log('Разрешение на уведомления получено');
    }
}

function sendTaskReminder() {
    if (Notification.permission === 'granted') {
        const todayTasks = tasks.filter(t => t.date === new Date().toISOString().split('T')[0] && !t.completed);
        if (todayTasks.length > 0) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('Напоминание о задачах', {
                    body: `У вас осталось ${todayTasks.length} невыполненных задач на сегодня`,
                    icon: '/public/192.png',
                    badge: '/public/192.png',
                    tag: 'task-reminder',
                    requireInteraction: true
                });
            });
        }
    }
}
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 20) sendTaskReminder();
}, 3600000);

// ============ ИНИЦИАЛИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', async function() {
    // Загружаем тему
    const savedTheme = localStorage.getItem('theme') || 'light';
    changeTheme(savedTheme);
    updateThemeColors();

    // Устанавливаем даты
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('task-date-filter').value = today;
    document.getElementById('task-date').value = today;
    updateTasksDateDisplay();

    // Проверяем авторизацию
    const savedUser = localStorage.getItem('smart_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        // Проверяем, активна ли сессия в Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            currentUser = user;
            saveUserToLocalStorage();
            showMainApp();
        } else {
            showAuthScreen();
        }
    } else {
        showAuthScreen();
    }
});

// ============ ХРАНЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ ============
function getUserStorageKey() {
    return `smart_${currentUser.id}_data`;
}

function loadUserData() {
    const key = getUserStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
        const data = JSON.parse(saved);
        tasks = data.tasks || [];
        notes = data.notes || [];
        userStats = data.userStats || { level: 1, exp: 0, totalPoints: 0, streak: 0, weeklyCompleted: [0,0,0,0,0,0,0] };
    } else {
        tasks = [];
        notes = [];
        userStats = { level: 1, exp: 0, totalPoints: 0, streak: 0, weeklyCompleted: [0,0,0,0,0,0,0] };
    }
    updateAllUI();
}

function saveUserData() {
    if (!currentUser) return;
    const key = getUserStorageKey();
    const data = { tasks, notes, userStats };
    localStorage.setItem(key, JSON.stringify(data));
}

function updateAllUI() {
    displayNotesList();
    if (typeof updateHabitsDisplay === 'function') updateHabitsDisplay();
    updateProgressTab();
    filterTasksByDate();
}

// Заглушка для updateHabitsDisplay (если нет привычек)
function updateHabitsDisplay() {
    // Если привычек нет, ничего не делаем
}

// ============ АВТОРИЗАЦИЯ ============
async function register() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const username = document.getElementById('reg-username').value;
    if (!email || !password || !username) {
        alert('Заполните все поля');
        return;
    }
    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username } }
    });
    if (error) {
        alert('Ошибка: ' + error.message);
    } else {
        currentUser = data.user;
        saveUserToLocalStorage();
        showMainApp();
        alert('Регистрация успешна! Добро пожаловать.');
    }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        alert('Введите email и пароль');
        return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Ошибка входа: ' + error.message);
    } else {
        currentUser = data.user;
        saveUserToLocalStorage();
        showMainApp();
        alert('Добро пожаловать!');
    }
}

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    localStorage.removeItem('smart_user');
    tasks = [];
    notes = [];
    userStats = { level: 1, exp: 0, totalPoints: 0, streak: 0, weeklyCompleted: [0,0,0,0,0,0,0] };
    showAuthScreen();
}

function saveUserToLocalStorage() {
    if (currentUser) {
        localStorage.setItem('smart_user', JSON.stringify(currentUser));
    }
}

function showAuthScreen() {
    document.querySelector('.sticker-nav').style.display = 'none';
    document.querySelector('.header').style.display = 'none';
    document.getElementById('login-tab').style.display = 'block';
    document.getElementById('register-tab').style.display = 'block';
    document.getElementById('tasks-tab').style.display = 'none';
    document.getElementById('notes-tab').style.display = 'none';
    document.getElementById('progress-tab').style.display = 'none';
    document.getElementById('profile-tab').style.display = 'none';
    document.getElementById('settings-tab').style.display = 'none';
}

function showMainApp() {
    document.querySelector('.sticker-nav').style.display = 'flex';
    document.querySelector('.header').style.display = 'flex';
    document.getElementById('login-tab').style.display = 'none';
    document.getElementById('register-tab').style.display = 'none';
    // Показываем вкладку задач
    switchTab('tasks', null);
    loadUserData();
}

function switchToRegister() {
    showTab('register');
}

function switchToLogin() {
    showTab('login');
}

// ============ НАВИГАЦИЯ ============
function switchTab(tabName, event) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = '';
    }
    // Обновляем активный стикер
    if (event && event.currentTarget) {
        document.querySelectorAll('.sticker-btn').forEach(btn => btn.classList.remove('active'));
        event.currentTarget.classList.add('active');
    } else {
        // Если event нет, пытаемся найти стикер по имени вкладки
        const stickerMap = { tasks: 0, notes: 1, progress: 2 };
        const stickers = document.querySelectorAll('.sticker-btn');
        stickers.forEach((sticker, idx) => {
            if (stickerMap[tabName] === idx) sticker.classList.add('active');
            else sticker.classList.remove('active');
        });
    }
    updateMascotForTab(tabName);
    if (tabName === 'tasks') {
        filterTasksByDate();
        checkOverdueTasks();
    } else if (tabName === 'notes') {
        displayNotesList();
    } else if (tabName === 'progress') {
        updateProgressTab();
    } else if (tabName === 'profile') {
        if (currentUser) {
            document.getElementById('username').value = currentUser.user_metadata?.username || '';
            document.getElementById('user-email').value = currentUser.email || '';
        }
    }
}

function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = '';
    }
}

function updateHeaderAvatar() {
    const avatarLetter = document.getElementById('header-avatar-letter');
    const profileAvatarLetter = document.getElementById('profile-avatar-letter');
    if (currentUser && currentUser.user_metadata?.username) {
        const letter = currentUser.user_metadata.username.charAt(0).toUpperCase();
        if (avatarLetter) avatarLetter.textContent = letter;
        if (profileAvatarLetter) profileAvatarLetter.textContent = letter;
    }
}

function saveProfile() {
    if (currentUser) {
        // Обновляем метаданные пользователя в Supabase (опционально)
        const newUsername = document.getElementById('username').value;
        supabase.auth.updateUser({ data: { username: newUsername } }).then(() => {
            if (currentUser.user_metadata) currentUser.user_metadata.username = newUsername;
            else currentUser.user_metadata = { username: newUsername };
            saveUserToLocalStorage();
            updateHeaderAvatar();
            alert('Профиль сохранен');
        }).catch(err => alert('Ошибка: ' + err.message));
    }
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file && currentUser) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Сохраняем аватар в localStorage (только локально)
            const key = getUserStorageKey();
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            data.avatar = e.target.result;
            localStorage.setItem(key, JSON.stringify(data));
            alert('Аватар обновлен (только локально)');
        };
        reader.readAsDataURL(file);
    }
}

// ============ ЗАДАЧИ (с сохранением через saveUserData) ============
function openTaskModal(taskId = null) { /* без изменений */ }
function closeTaskModal() { /* без изменений */ }
function selectCategory(category) { /* без изменений */ }

function saveTask() {
    const name = document.getElementById('task-name').value;
    const date = document.getElementById('task-date').value;
    const points = parseInt(document.getElementById('task-points').value) || 1;
    if (!name) {
        alert('Введите название задачи');
        return;
    }
    if (editingTaskId) {
        const index = tasks.findIndex(t => t.id === editingTaskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], name, category: selectedCategory, date, points };
        }
        editingTaskId = null;
    } else {
        tasks.push({
            id: Date.now(), name, category: selectedCategory, date, points,
            completed: false, completedDate: null
        });
    }
    saveUserData();
    closeTaskModal();
    filterTasksByDate();
}

function filterTasksByDate() { /* без изменений */ }
function updateTasksDateDisplay() { /* без изменений */ }
function displayTasks(taskList) { /* без изменений */ }
function getCategoryIcon(category) { /* без изменений */ }
function getCategoryName(category) { /* без изменений */ }

async function toggleTaskComplete(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.completed) return;
    task.completed = true;
    task.completedDate = new Date().toISOString().split('T')[0];
    const streakBonus = Math.max(1, userStats.streak || 1);
    const levelBonus = userStats.level;
    const earnedPoints = task.points * streakBonus * levelBonus;
    userStats.totalPoints += earnedPoints;
    userStats.totalCompleted++;
    const dayOfWeek = new Date().getDay();
    userStats.weeklyCompleted[dayOfWeek] = (userStats.weeklyCompleted[dayOfWeek] || 0) + 1;
    const today = new Date().toISOString().split('T')[0];
    if (userStats.lastTaskDate === today) {
        // ничего
    } else if (userStats.lastTaskDate === getYesterdayDate()) {
        userStats.streak++;
    } else {
        userStats.streak = 1;
    }
    userStats.lastTaskDate = today;
    addExperience(earnedPoints);
    saveUserData();
    filterTasksByDate();
    updateProgressTab();
    updateMascotImage('happy', 'tasks');
    checkLevelUp();
}

function addExperience(points) {
    userStats.exp += points;
    let leveledUp = false;
    while (userStats.exp >= getExpNeededForLevel(userStats.level + 1)) {
        userStats.level++;
        userStats.exp -= getExpNeededForLevel(userStats.level);
        leveledUp = true;
    }
    if (leveledUp) showLevelUpCelebration();
    updateExpBar();
}

function getExpNeededForLevel(level) {
    return levelExpNeeded[level] || levelExpNeeded[10] + (level - 10) * 600;
}

function updateExpBar() {
    const currentLevelExp = getExpNeededForLevel(userStats.level);
    const percent = (userStats.exp / currentLevelExp) * 100;
    document.getElementById('exp-fill').style.width = `${Math.min(100, percent)}%`;
    document.getElementById('exp-text').textContent = `${userStats.exp} / ${currentLevelExp}`;
    document.getElementById('current-level').textContent = userStats.level;
    document.getElementById('level-image').src = `/public/${userStats.level}.png`;
}

function showLevelUpCelebration() {
    alert(`🎉 Поздравляем! Вы достигли ${userStats.level} уровня! 🎉`);
    updateMascotImage('levelup', 'progress');
}

function checkLevelUp() { updateExpBar(); }

// ============ ЗАМЕТКИ (с сохранением через saveUserData) ============
function openNoteModal(noteId = null) { /* без изменений */ }
function closeNoteModal() { /* без изменений */ }

function saveNote() {
    const title = document.getElementById('note-title').value;
    const content = document.getElementById('note-content').value;
    const date = new Date().toISOString().split('T')[0];
    if (!title && !content) {
        alert('Заполните хотя бы одно поле');
        return;
    }
    if (editingNoteId) {
        const index = notes.findIndex(n => n.id === editingNoteId);
        if (index !== -1) {
            notes[index] = { ...notes[index], title: title || 'Без заголовка', content };
        }
        editingNoteId = null;
    } else {
        notes.unshift({ id: Date.now(), title: title || 'Без заголовка', content, date });
    }
    saveUserData();
    closeNoteModal();
    displayNotesList();
}

function displayNotesList() {
    const container = document.getElementById('notes-list-notes');
    if (notes.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Нет заметок</div>';
        return;
    }
    container.innerHTML = notes.map(note => {
        let previewText = note.content || '';
        const firstLine = previewText.split('\n')[0];
        const truncatedText = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
        return `
            <div class="note-card">
                <h4>${escapeHtml(note.title)}</h4>
                <p class="note-preview">${escapeHtml(truncatedText || 'Нет текста')}</p>
                <div class="note-actions">
                    <button onclick="openNoteModal(${note.id})">✏️</button>
                    <button onclick="deleteNote(${note.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteNote(id) {
    if (confirm('Удалить заметку?')) {
        notes = notes.filter(n => n.id !== id);
        saveUserData();
        displayNotesList();
    }
}

// ============ ПРОГРЕСС ============
function updateProgressTab() {
    updateExpBar();
    document.getElementById('streak-progress').textContent = userStats.streak || 0;
    document.getElementById('total-completed-progress').textContent = userStats.totalCompleted;
    document.getElementById('total-points-progress').textContent = userStats.totalPoints;
    updateWeeklyChart();
}

function updateWeeklyChart() {
    const canvas = document.getElementById('weekly-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const today = new Date().getDay();
    const data = userStats.weeklyCompleted || [0,0,0,0,0,0,0];
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width - 40) / 7 - 5;
    const maxValue = Math.max(...data, 1);
    for (let i = 0; i < 7; i++) {
        const height = (data[i] / maxValue) * (canvas.height - 50);
        ctx.fillStyle = i === today - 1 ? '#FF4133' : '#69A1AC';
        ctx.fillRect(20 + i * (barWidth + 5), canvas.height - height - 20, barWidth, height);
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.fillText(days[i], 20 + i * (barWidth + 5), canvas.height - 5);
    }
}

// ============ МАСКОТ ============
function updateMascotForTab(tabName) {
    const images = {
        tasks: '/public/mascot-happy.png',
        notes: '/public/mascot-notes.png',
        progress: '/public/mascot-congrats.png'
    };
    const imgId = tabName === 'tasks' ? 'mascot-image' : 
                  tabName === 'notes' ? 'mascot-notes-image' : 'mascot-progress-image';
    const img = document.getElementById(imgId);
    if (img) img.src = images[tabName] || '/public/mascot-happy.png';
}

function updateMascotImage(type, tab) {
    const images = {
        happy: '/public/mascot-happy.png',
        notes: '/public/mascot-notes.png',
        congrats: '/public/mascot-congrats.png',
        worried: '/public/mascot-worried.png',
        warning: '/public/mascot-warning.png',
        levelup: '/public/mascot-levelup.png'
    };
    const imgId = tab === 'tasks' ? 'mascot-image' : 
                  tab === 'notes' ? 'mascot-notes-image' : 'mascot-progress-image';
    const img = document.getElementById(imgId);
    if (img) img.src = images[type] || images.happy;
}

function checkOverdueTasks() {
    const yesterday = getYesterdayDate();
    const overdueTasks = tasks.filter(t => t.date === yesterday && !t.completed);
    if (overdueTasks.length > 0) {
        updateMascotImage('worried', 'tasks');
        setTimeout(() => {
            if (document.querySelector('#tasks-tab.active')) updateMascotImage('happy', 'tasks');
        }, 5000);
    }
}

function checkEveningReminder() {
    const now = new Date();
    if (now.getHours() >= 23) {
        const todayTasks = tasks.filter(t => t.date === now.toISOString().split('T')[0] && !t.completed);
        if (todayTasks.length > 0) updateMascotImage('warning', 'tasks');
    }
}

// ============ ТЕМА ============
function changeTheme(theme) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(`${theme}-theme`);
    localStorage.setItem('theme', theme);
    const lightBtn = document.querySelector('.light-theme-btn');
    const darkBtn = document.querySelector('.dark-theme-btn');
    if (lightBtn && darkBtn) {
        if (theme === 'light') {
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        } else {
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        }
    }
    document.querySelectorAll('.tab-title, h2, h3, .date-display, .stat-label-progress').forEach(el => {
        el.style.color = theme === 'dark' ? '#ffffff' : '';
    });
}

function updateThemeColors() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.querySelectorAll('.tab-title, h2, h3, .date-display').forEach(el => {
            el.style.color = '#ffffff';
        });
    }
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ============
function getYesterdayDate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}