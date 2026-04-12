// script.js
// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker зарегистрирован:', registration);
                
                // Проверка обновлений
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('Новый Service Worker найден:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('Доступна новая версия!');
                            // Показать уведомление о обновлении
                            if (confirm('Доступна новая версия приложения. Обновить?')) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Ошибка регистрации Service Worker:', error);
            });
    });
}

// Запрос разрешения на уведомления
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Разрешение на уведомления получено');
        }
    }
}

// Отправка напоминания о задачах
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

// Проверять задачи каждый час
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 20) { // В 8 вечера
        sendTaskReminder();
    }
}, 3600000); // Каждый час
// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============
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

// Уровни (фиксированное количество баллов для перехода)
const levelExpNeeded = {
    1: 100, 2: 250, 3: 450, 4: 700, 5: 1000,
    6: 1350, 7: 1750, 8: 2200, 9: 2700, 10: 3300
};

// ============ ИНИЦИАЛИЗАЦИЯ ============
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    checkAuth();
    updateHeaderAvatar();
    document.getElementById('task-date-filter').value = new Date().toISOString().split('T')[0];
    document.getElementById('task-date').value = new Date().toISOString().split('T')[0];
    updateTasksDateDisplay();
    filterTasksByDate();
    
    const savedTheme = localStorage.getItem('theme') || 'light';
    changeTheme(savedTheme);
});

function loadData() {
    const savedUser = localStorage.getItem('smart_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
    
    const savedTasks = localStorage.getItem('smart_tasks');
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
    }
    
    const savedNotes = localStorage.getItem('smart_notes');
    if (savedNotes) {
        notes = JSON.parse(savedNotes);
    }
    
    const savedStats = localStorage.getItem('smart_stats');
    if (savedStats) {
        userStats = JSON.parse(savedStats);
    }
}

function saveAllData() {
    if (currentUser) {
        localStorage.setItem('smart_user', JSON.stringify(currentUser));
    }
    localStorage.setItem('smart_tasks', JSON.stringify(tasks));
    localStorage.setItem('smart_notes', JSON.stringify(notes));
    localStorage.setItem('smart_stats', JSON.stringify(userStats));
}

// ============ АВТОРИЗАЦИЯ ============
function checkAuth() {
    if (currentUser) {
        showTab('tasks');
        document.querySelector('.sticker-nav').style.display = 'flex';
        document.querySelector('.header').style.display = 'flex';
    } else {
        showTab('login');
        document.querySelector('.sticker-nav').style.display = 'none';
        document.querySelector('.header').style.display = 'none';
    }
}

function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const users = JSON.parse(localStorage.getItem('smart_users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        currentUser = user;
        saveAllData();
        checkAuth();
        updateHeaderAvatar();
        loadUserData();
    } else {
        alert('Неверный email или пароль');
    }
}

function register() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    if (!username || !email || !password) {
        alert('Заполните все поля');
        return;
    }
    
    const users = JSON.parse(localStorage.getItem('smart_users') || '[]');
    if (users.find(u => u.email === email)) {
        alert('Пользователь с таким email уже существует');
        return;
    }
    
    const newUser = { id: Date.now(), username, email, password, avatar: null };
    users.push(newUser);
    localStorage.setItem('smart_users', JSON.stringify(users));
    currentUser = newUser;
    saveAllData();
    checkAuth();
    updateHeaderAvatar();
}

function logout() {
    currentUser = null;
    saveAllData();
    checkAuth();
}

function switchToRegister() {
    showTab('register');
}

function switchToLogin() {
    showTab('login');
}

function loadUserData() {
    displayNotesList();
    updateProgressTab();
    checkMascotReaction();
}

// ============ НАВИГАЦИЯ ============
function switchTab(tabName, event) {
    if (event && event.currentTarget) {
        document.querySelectorAll('.sticker-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
    }
    showTab(tabName);
    updateMascotForTab(tabName);
}

function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'tasks') {
        filterTasksByDate();
        checkOverdueTasks();
    } else if (tabName === 'notes') {
        displayNotesList();
    } else if (tabName === 'progress') {
        updateProgressTab();
    } else if (tabName === 'profile' && currentUser) {
        document.getElementById('username').value = currentUser.username || '';
        document.getElementById('user-email').value = currentUser.email || '';
    }
}

function updateHeaderAvatar() {
    const avatarLetter = document.getElementById('header-avatar-letter');
    const profileAvatarLetter = document.getElementById('profile-avatar-letter');
    if (currentUser && currentUser.username) {
        const letter = currentUser.username.charAt(0).toUpperCase();
        avatarLetter.textContent = letter;
        if (profileAvatarLetter) profileAvatarLetter.textContent = letter;
    }
}

function saveProfile() {
    if (currentUser) {
        currentUser.username = document.getElementById('username').value;
        currentUser.email = document.getElementById('user-email').value;
        saveAllData();
        updateHeaderAvatar();
        alert('Профиль сохранен');
    }
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (file && currentUser) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentUser.avatar = e.target.result;
            saveAllData();
        };
        reader.readAsDataURL(file);
    }
}

// ============ ЗАДАЧИ ============
function openTaskModal(taskId = null) {
    editingTaskId = taskId;
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('task-modal-title');
    
    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            title.textContent = 'Редактировать задачу';
            document.getElementById('task-name').value = task.name;
            document.getElementById('task-date').value = task.date;
            document.getElementById('task-points').value = task.points;
            selectCategory(task.category);
        }
    } else {
        title.textContent = 'Новая задача';
        document.getElementById('task-name').value = '';
        document.getElementById('task-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('task-points').value = 1;
        selectCategory('custom');
    }
    modal.classList.add('active');
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
    editingTaskId = null;
}

function selectCategory(category) {
    selectedCategory = category;
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.cat === category) {
            btn.classList.add('active');
        }
    });
}

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
            id: Date.now(),
            name,
            category: selectedCategory,
            date,
            points,
            completed: false,
            completedDate: null
        });
    }
    
    saveAllData();
    closeTaskModal();
    filterTasksByDate();
}

function filterTasksByDate() {
    const selectedDate = document.getElementById('task-date-filter').value;
    updateTasksDateDisplay();
    
    const filteredTasks = tasks.filter(task => task.date === selectedDate);
    displayTasks(filteredTasks);
    checkEveningReminder();
}

function updateTasksDateDisplay() {
    const date = new Date(document.getElementById('task-date-filter').value);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('tasks-date-display').textContent = date.toLocaleDateString('ru-RU', options);
}

function displayTasks(taskList) {
    const board = document.getElementById('tasks-board');
    
    if (taskList.length === 0) {
        board.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Нет задач на этот день</div>';
        return;
    }
    
    board.innerHTML = taskList.map(task => `
        <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="toggleTaskComplete(${task.id})"></div>
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.name)}</div>
                <span class="task-category ${task.category}">${getCategoryIcon(task.category)} ${getCategoryName(task.category)}</span>
            </div>
            <div class="task-points">+${task.points}</div>
        </div>
    `).join('');
}

function getCategoryIcon(category) {
    const icons = { health: '💪', household: '🏠', custom: '📋' };
    return icons[category] || '📋';
}

function getCategoryName(category) {
    const names = { health: 'Здоровье', household: 'Бытовые', custom: 'Кастомные' };
    return names[category] || 'Кастомные';
}

async function toggleTaskComplete(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.completed) return;
    
    task.completed = true;
    task.completedDate = new Date().toISOString().split('T')[0];
    
    // Расчет баллов: 1 * n дней в серии * n-й уровень пользователя
    const streakBonus = Math.max(1, userStats.streak || 1);
    const levelBonus = userStats.level;
    const earnedPoints = task.points * streakBonus * levelBonus;
    
    // Обновление статистики
    userStats.totalPoints += earnedPoints;
    userStats.totalCompleted++;
    userStats.weeklyCompleted[new Date().getDay()] = (userStats.weeklyCompleted[new Date().getDay()] || 0) + 1;
    
    // Обновление серии
    const today = new Date().toISOString().split('T')[0];
    if (userStats.lastTaskDate === today) {
        // Уже сегодня отмечали
    } else if (userStats.lastTaskDate === getYesterdayDate()) {
        userStats.streak++;
    } else {
        userStats.streak = 1;
    }
    userStats.lastTaskDate = today;
    
    // Добавление опыта
    addExperience(earnedPoints);
    
    saveAllData();
    filterTasksByDate();
    updateProgressTab();
    
    // Маскот поддерживает
    updateMascotImage('happy', 'tasks');
    
    // Проверка перехода уровня
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
    
    if (leveledUp) {
        showLevelUpCelebration();
    }
    
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

function checkLevelUp() {
    // Проверка при каждом обновлении
    updateExpBar();
}

// ============ ЗАМЕТКИ ============
function openNoteModal(noteId = null) {
    editingNoteId = noteId;
    const modal = document.getElementById('note-modal');
    const title = document.getElementById('note-modal-title');
    
    if (noteId) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            title.textContent = 'Редактировать заметку';
            document.getElementById('note-title').value = note.title;
            document.getElementById('note-content').value = note.content;
        }
    } else {
        title.textContent = 'Новая заметка';
        document.getElementById('note-title').value = '';
        document.getElementById('note-content').value = '';
    }
    modal.classList.add('active');
}

function closeNoteModal() {
    document.getElementById('note-modal').classList.remove('active');
    editingNoteId = null;
}

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
        notes.unshift({
            id: Date.now(),
            title: title || 'Без заголовка',
            content,
            date
        });
    }
    
    saveAllData();
    closeNoteModal();
    displayNotesList();
}

// Добавьте или замените функцию displayNotesList() в script.js

function displayNotesList() {
    const container = document.getElementById('notes-list-notes');
    
    if (notes.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">Нет заметок</div>';
        return;
    }
    
    container.innerHTML = notes.map(note => {
        // Обрезаем текст до первой строки и ограничиваем длину
        let previewText = note.content || '';
        // Берем первую строку
        const firstLine = previewText.split('\n')[0];
        // Обрезаем до 50 символов
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
        saveAllData();
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

function checkMascotReaction() {
    const activeTab = document.querySelector('.tab.active').id;
    if (activeTab === 'tasks-tab') {
        updateMascotImage('happy', 'tasks');
    } else if (activeTab === 'notes-tab') {
        updateMascotImage('notes', 'notes');
    } else if (activeTab === 'progress-tab') {
        updateMascotImage('congrats', 'progress');
    }
}

function checkOverdueTasks() {
    const yesterday = getYesterdayDate();
    const overdueTasks = tasks.filter(t => t.date === yesterday && !t.completed);
    if (overdueTasks.length > 0) {
        updateMascotImage('worried', 'tasks');
        setTimeout(() => {
            if (document.querySelector('#tasks-tab.active')) {
                updateMascotImage('happy', 'tasks');
            }
        }, 5000);
    }
}

function checkEveningReminder() {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 23) {
        const todayTasks = tasks.filter(t => t.date === now.toISOString().split('T')[0] && !t.completed);
        if (todayTasks.length > 0) {
            updateMascotImage('warning', 'tasks');
        }
    }
}

// ============ ТЕМА ============
// В script.js найдите функцию changeTheme и обновите её:

function changeTheme(theme) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(`${theme}-theme`);
    localStorage.setItem('theme', theme);
    
    // Обновляем активное состояние кнопок
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
    
    // Принудительно обновляем цвета элементов
    document.querySelectorAll('.tab-title, h2, h3, .date-display, .stat-label-progress').forEach(el => {
        el.style.color = theme === 'dark' ? '#ffffff' : '';
    });
}

// Добавьте эту функцию для обновления цветов при загрузке
function updateThemeColors() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.querySelectorAll('.tab-title, h2, h3, .date-display').forEach(el => {
            el.style.color = '#ffffff';
        });
    }
}

// Вызовите в DOMContentLoaded:
document.addEventListener('DOMContentLoaded', function() {
    // ... существующий код ...
    updateThemeColors();
});

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
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