const socket = io();

let currentRoomId = null;
let activeRoomData = null;
let myName = "";
let allRoomsCached = [];
let isChatOpen = false;

const bgMusic = document.getElementById('bg-music');
const clickSound = document.getElementById('click-sound');
const startSound = document.getElementById('start-sound');

function playClick() { clickSound.currentTime = 0; clickSound.play().catch(()=>{}); }
function playStart() { startSound.currentTime = 0; startSound.play().catch(()=>{}); }

// إغلاق الإعدادات عند النقر في أي مكان خارجها
document.addEventListener('click', (event) => {
    const settingsArea = document.getElementById('settings-area');
    const dropdown = document.getElementById('settings-dropdown');
    if (settingsArea && !settingsArea.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

document.getElementById('settings-toggle-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    playClick();
    document.getElementById('settings-dropdown').classList.toggle('hidden');
});

document.getElementById('volume-control').addEventListener('input', (e) => {
    const vol = e.target.value;
    bgMusic.volume = vol * 0.4;
    clickSound.volume = vol;
    startSound.volume = vol;
    document.getElementById('volume-status').textContent = `${Math.round(vol * 100)}%`;
});

// التبويبات السفلية
document.getElementById('tab-create-btn').addEventListener('click', () => {
    playClick();
    document.getElementById('tab-create-btn').classList.add('active-tab');
    document.getElementById('tab-search-btn').classList.remove('active-tab');
    document.getElementById('tab-create-content').classList.remove('hidden');
    document.getElementById('tab-search-content').classList.add('hidden');
});

document.getElementById('tab-search-btn').addEventListener('click', () => {
    playClick();
    document.getElementById('tab-search-btn').classList.add('active-tab');
    document.getElementById('tab-create-btn').classList.remove('active-tab');
    document.getElementById('tab-search-content').classList.remove('hidden');
    document.getElementById('tab-create-content').classList.add('hidden');
});

window.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('salfah_username');
    if (savedName) {
        myName = savedName;
        document.getElementById('main-hub-screen').classList.remove('hidden');
    } else {
        document.getElementById('name-screen').classList.remove('hidden');
    }
});

document.getElementById('submit-name-btn').addEventListener('click', () => {
    const inputName = document.getElementById('username-input').value.trim();
    if (!inputName) return alert("الرجاء كتابة اسمك أولاً!");
    playClick();
    myName = inputName;
    localStorage.setItem('salfah_username', myName);
    bgMusic.volume = 0.16; bgMusic.play().catch(()=>{});
    document.getElementById('name-screen').classList.add('hidden');
    document.getElementById('main-hub-screen').classList.remove('hidden');
});

document.getElementById('create-room-btn').addEventListener('click', () => {
    const roomName = document.getElementById('room-name').value.trim();
    const password = document.getElementById('room-pass').value.trim();
    const maxPlayers = document.getElementById('max-players').value;
    const spiesCount = document.getElementById('spies-count').value;
    const topic = document.getElementById('room-topic').value;
    const gameDuration = document.getElementById('game-duration').value;

    if (!roomName) return alert('الرجاء كتابة اسم للغرفة!');
    playClick();
    socket.emit('createRoom', { username: myName, roomName, password, maxPlayers, spiesCount, topic, gameDuration });
});

socket.on('roomJoined', (room) => {
    currentRoomId = room.id;
    document.getElementById('main-hub-screen').classList.add('hidden');
    document.getElementById('room-screen').classList.remove('hidden');
    document.getElementById('floating-chat-container').classList.remove('hidden');
    updateRoomUI(room);
});

socket.on('availableRooms', (rooms) => {
    allRoomsCached = rooms;
    renderRoomsList(rooms);
});

document.getElementById('search-input').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allRoomsCached.filter(r => r.name.toLowerCase().includes(query));
    renderRoomsList(filtered);
});

function renderRoomsList(rooms) {
    const roomsList = document.getElementById('rooms-list');
    roomsList.innerHTML = '';
    const available = rooms.filter(r => !r.gameStarted);
    if (available.length === 0) { roomsList.innerHTML = '<p style="color:#aaa; padding:10px;">لا توجد غرف نشطة تطابق بحثك حالياً</p>'; return; }
    
    available.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item animate-fade';
        div.innerHTML = `
            <span><b>${room.name}</b> (${room.currentPlayers}/${room.maxPlayers}) ${room.hasPassword ? '🔒' : '🔓'}</span>
            <button onclick="joinActiveRoom('${room.id}', ${room.hasPassword})">انضمام</button>
        `;
        roomsList.appendChild(div);
    });
}

window.joinActiveRoom = (roomId, hasPassword) => {
    playClick();
    let password = hasPassword ? prompt("أدخل الرقم السري للغرفة:") : "";
    if (hasPassword && !password) return;
    socket.emit('joinRoom', { username: myName, roomId, password });
};

socket.on('roomUpdated', (room) => { updateRoomUI(room); });

function updateRoomUI(room) {
    activeRoomData = room;
    document.getElementById('current-room-title').textContent = `غرفة: ${room.name} [الموضوع: ${room.topic}]`;
    const tableContainer = document.getElementById('table-container');
    tableContainer.innerHTML = '';
    
    room.players.forEach(p => {
        const seat = document.createElement('div');
        seat.className = 'player-seat animate-fade';
        seat.textContent = p.name + (p.id === room.hostId ? ' 👑' : '');
        tableContainer.appendChild(seat);
    });

    const startBtn = document.getElementById('start-game-btn');
    if (socket.id === room.hostId) startBtn.classList.remove('hidden');
    else startBtn.classList.add('hidden');
}

document.getElementById('start-game-btn').addEventListener('click', () => {
    if (currentRoomId) { playClick(); socket.emit('startRoomGame', currentRoomId); }
});

socket.on('gameStarted', (room) => {
    activeRoomData = room;
    playStart();
    document.getElementById('room-screen').classList.add('hidden');
    document.getElementById('game-play-screen').classList.remove('hidden');
    const me = room.players.find(p => p.id === socket.id);
    document.getElementById('player-word-display').textContent = me.word;
    renderGameTable(room.players, 'talking');
});

function renderGameTable(players, phase) {
    const gameTable = document.getElementById('game-table-container');
    gameTable.innerHTML = '';
    players.forEach(p => {
        const seat = document.createElement('div');
        seat.className = `player-seat ${!p.isAlive ? 'dead' : ''}`;
        seat.id = `seat-${p.id}`;
        seat.innerHTML = `<b>${p.name}</b>`;
        
        if (phase === 'voting' && p.isAlive) {
            // التحقق من منع اللاعب من التصويت على نفسه
            if (p.id === socket.id) {
                seat.classList.add('my-own-seat');
            } else {
                seat.classList.add('voting-phase');
                const me = activeRoomData.players.find(pl => pl.id === socket.id);
                if (me && me.votedFor === p.id) seat.classList.add('voted');

                seat.addEventListener('click', () => {
                    playClick();
                    socket.emit('castVote', { roomId: currentRoomId, targetId: p.id });
                });
            }
        }
        gameTable.appendChild(seat);
    });
}

socket.on('turnUpdate', (data) => {
    document.querySelectorAll('.player-seat').forEach(s => s.classList.remove('speaking'));
    const activeSeat = document.getElementById(`seat-${data.activePlayerId}`);
    if (activeSeat) activeSeat.classList.add('speaking');

    const turnText = document.getElementById('current-turn-text');
    const finishBtn = document.getElementById('finish-turn-btn');

    if (socket.id === data.activePlayerId) {
        turnText.textContent = "🔊 دورك الحالي للكلام وصياغة سؤالك لخداع الآخرين!";
        finishBtn.classList.remove('hidden');
    } else {
        const activePlayer = activeRoomData.players.find(p => p.id === data.activePlayerId);
        turnText.textContent = `انتظر.. الآن دور اللاعب: [ ${activePlayer ? activePlayer.name : ''} ] ليتحدث`;
        finishBtn.classList.add('hidden');
    }
});

document.getElementById('finish-turn-btn').addEventListener('click', () => {
    playClick(); socket.emit('nextTurn', currentRoomId);
});

socket.on('timerTick', (time) => { document.getElementById('timer-display').textContent = time; });

socket.on('phaseChanged', (data) => {
    activeRoomData.phase = data.phase;
    document.getElementById('table-header-title').textContent = "⚠️ بدأت مرحلة التصويت! اضغط على المشتبه به (لا يمكنك التصويت لنفسك):";
    document.getElementById('current-turn-text').textContent = "🗳️ الكل يصوت الآن على الطاولة الحية!";
    document.getElementById('finish-turn-btn').classList.add('hidden');
    renderGameTable(activeRoomData.players, 'voting');
});

socket.on('voteUpdated', (players) => {
    activeRoomData.players = players;
    renderGameTable(players, 'voting');
});

// ميزة الـ 10 خيارات عندما يتم كشف "برا السالفة"
socket.on('spyMustGuess', (data) => {
    if (socket.id === data.spyId) {
        // إذا كنت أنت برا السالفة، تفتح لك واجهة الـ 10 خيارات فوراً للتخمين
        const modal = document.getElementById('spy-guess-modal');
        const grid = document.getElementById('spy-options-grid');
        grid.innerHTML = '';
        modal.classList.remove('hidden');

        data.options.forEach(word => {
            const btn = document.createElement('button');
            btn.textContent = word;
            btn.addEventListener('click', () => {
                playClick();
                socket.emit('submitSpyGuess', { roomId: currentRoomId, guess: word });
                modal.classList.add('hidden');
            });
            grid.appendChild(btn);
        });
    } else {
        alert(`📢 تم كشف أن اللاعب [ ${data.spyName} ] هو اللي برا السالفة! ننتظر الآن تخمينه للكلمة لمعرفة من سيفوز...`);
    }
});

socket.on('playerEliminated', (data) => {
    alert(`📢 النتيجة: تم إقصاء اللاعب [ ${data.name} ] من الجولة!`);
});

socket.on('gameOver', (data) => {
    alert(`🏁 انتهت اللعبة تماماً!\nالنتيجة: ${data.message}`);
    location.reload();
});

socket.on('kickToLobby', () => {
    alert("تم إنهاء الغرفة! يعاد توجيهك للرادار الرئيسي.");
    location.reload();
});

/* نظام الشات */
const chatOverlay = document.getElementById('chat-overlay-modal');
const chatNotifDot = document.getElementById('chat-notif-dot');

document.getElementById('chat-toggle-btn').addEventListener('click', () => {
    playClick();
    chatOverlay.classList.remove('hidden');
    chatNotifDot.classList.add('hidden');
    isChatOpen = true;
});

document.getElementById('close-chat-modal-btn').addEventListener('click', () => {
    playClick();
    chatOverlay.classList.add('hidden');
    isChatOpen = false;
});

document.getElementById('send-chat-btn').addEventListener('click', sendMsg);
document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMsg(); });

function sendMsg() {
    const text = document.getElementById('chat-input').value.trim();
    if(!text) return;
    socket.emit('sendChatMessage', { roomId: currentRoomId, message: text });
    document.getElementById('chat-input').value = '';
}

socket.on('newChatMessage', (msg) => {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML += `<div class="chat-msg"><b>${msg.sender}:</b> ${msg.text}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
    if (!isChatOpen) chatNotifDot.classList.remove('hidden');
});

document.getElementById('leave-room-btn').addEventListener('click', () => { location.reload(); });
socket.on('errorMsg', (msg) => alert(msg));