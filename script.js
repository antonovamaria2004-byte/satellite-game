(function () {
    'use strict';

    // ============================================================
    // НАСТРОЙКИ И КАМПАНИЯ
    // ============================================================
    const CAMPAIGN = [
        { count: 2, interval: 5, altitude: 300, title: 'Запустить 2 спутника' },
        { count: 3, interval: 4, altitude: 400, title: 'Запустить 3 спутника' },
        { count: 4, interval: 3, altitude: 450, title: 'Запустить 4 спутника' },
        { count: 5, interval: 2, altitude: 500, title: 'Запустить 5 спутников' },
        { count: 6, interval: 2, altitude: 550, title: 'Запустить 6 спутников' }
    ];

    const CAMS = [
        { name: 'Малая', radius: 15, fuelPenalty: 0 },
        { name: 'Стандарт', radius: 25, fuelPenalty: 10 },
        { name: 'Широкая', radius: 40, fuelPenalty: 25 }
    ];

    const PERSPECTIVE_TILT = 0.45;
    const DEBRIS_SPAWN_CHANCE = 0.008;

    // --- DOM ---
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    const impulseSlider = document.getElementById('impulse');
    const impulseValue = document.getElementById('impulse-value');
    const countSlider = document.getElementById('count');
    const countValue = document.getElementById('count-value');
    const intervalSlider = document.getElementById('interval');
    const intervalValue = document.getElementById('interval-value');
    
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const correctBtn = document.getElementById('correct-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    const setupPanel = document.getElementById('setup-panel');
    const setupId = document.getElementById('setup-id');
    const setupAlt = document.getElementById('setup-alt');
    const setupAltVal = document.getElementById('setup-alt-val');
    const setupInc = document.getElementById('setup-inc');
    const setupIncVal = document.getElementById('setup-inc-val');
    const setupCam = document.getElementById('setup-cam');
    const setupCamVal = document.getElementById('setup-cam-val');
    const setupEngineBtn = document.getElementById('setup-engine');

    const coverageValue = document.getElementById('coverage-value');
    const selectedInfo = document.getElementById('selected-info');
    const selectedValue = document.getElementById('selected-value');
    const resultScreen = document.getElementById('result-screen');
    const resultTitle = document.getElementById('result-title');
    const resultText = document.getElementById('result-text');
    const resultNextBtn = document.getElementById('result-next-btn');
    const resultResetBtn = document.getElementById('result-reset-btn');
    
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const guideBtn = document.getElementById('guide-btn');
    const guideScreen = document.getElementById('guide-screen');
    const closeGuideBtn = document.getElementById('close-guide-btn');

    // --- Состояние ---
    const game = {
        running: false,
        paused: false,
        finished: false,
        time: 0,
        flightTimeLimit: 30,
        impulse: 50,
        totalSatellites: 2,
        launchInterval: 5,
        lastLaunchTime: 0,
        satellites: [],
        collisions: 0,
        earthRadius: 70,
        selectedSatellite: null,
        stars: [],
        clouds: [],
        debris: [],
        debrisSpawned: false,
        launchQueue: [],
        selectedQueueIndex: -1,
        coveragePercent: 0
    };

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ ОЧЕРЕДИ
    // ============================================================
    function initQueue(count) {
        game.launchQueue = [];
        for (let i = 0; i < count; i++) {
            game.launchQueue.push({ altitude: 300 + (i * 40), inclination: 0, cam: 1, engine: 'chem' });
        }
        game.selectedQueueIndex = -1;
        setupPanel.classList.add('hidden');
        renderQueue();
    }

    function renderQueue() {
        const queueContainer = document.getElementById('satellite-queue');
        queueContainer.innerHTML = '';
        for (let i = 0; i < game.totalSatellites; i++) {
            const btn = document.createElement('button');
            const item = game.launchQueue[i];
            const hue = item.inclination * 2; 
            btn.className = `queue-btn`;
            btn.style.borderColor = `hsl(${hue}, 100%, 50%)`;
            btn.style.color = `hsl(${hue}, 100%, 50%)`;
            btn.textContent = i + 1;
            
            if (i === game.selectedQueueIndex) btn.classList.add('selected-for-setup');
            if (i < game.satellites.length && game.running) btn.disabled = true;
            else if (!game.running) {
                btn.onclick = () => {
                    game.selectedQueueIndex = i;
                    renderQueue();
                    updateSetupPanel();
                };
            }
            queueContainer.appendChild(btn);
        }
    }

    function updateSetupPanel() {
        if (game.selectedQueueIndex === -1 || game.running) {
            setupPanel.classList.add('hidden');
            return;
        }
        const item = game.launchQueue[game.selectedQueueIndex];
        setupPanel.classList.remove('hidden');
        setupId.textContent = game.selectedQueueIndex + 1;
        setupAlt.value = item.altitude;
        setupAltVal.textContent = item.altitude;
        setupInc.value = item.inclination;
        setupIncVal.textContent = item.inclination;
        setupCam.value = item.cam;
        setupCamVal.textContent = CAMS[item.cam].name;
        setupEngineBtn.textContent = item.engine === 'chem' ? 'Двигатель: Хим (мощный)' : 'Двигатель: Ион (эконом)';
    }

    setupAlt.addEventListener('input', function() {
        game.launchQueue[game.selectedQueueIndex].altitude = parseInt(this.value);
        setupAltVal.textContent = this.value;
        if (!game.running) render();
    });
    setupInc.addEventListener('input', function() {
        game.launchQueue[game.selectedQueueIndex].inclination = parseInt(this.value);
        setupIncVal.textContent = this.value;
        renderQueue(); 
        if (!game.running) render();
    });
    setupCam.addEventListener('input', function() {
        game.launchQueue[game.selectedQueueIndex].cam = parseInt(this.value);
        setupCamVal.textContent = CAMS[this.value].name;
    });
    setupEngineBtn.addEventListener('click', function() {
        const item = game.launchQueue[game.selectedQueueIndex];
        item.engine = item.engine === 'chem' ? 'ion' : 'chem';
        updateSetupPanel();
    });

    // ============================================================
    // ФИЗИКА И ЛОГИКА
    // ============================================================
    function createSatellite(index) {
        const impulseFactor = game.impulse / 100;
        const startRadius = 40 + impulseFactor * 60;
        const startAngle = (Math.PI * 2 / game.totalSatellites) * index;
        const queueItem = game.launchQueue[index];
        const camParams = CAMS[queueItem.cam];

        return {
            id: index + 1,
            angle: startAngle,
            radius: startRadius,
            targetRadius: game.earthRadius + queueItem.altitude / 10,
            inclination: queueItem.inclination, 
            engineType: queueItem.engine,
            camRadius: camParams.radius,
            baseSpeed: (0.8 + impulseFactor * 1.2),
            speedMultiplier: 1.0,
            maxFuel: 150 - camParams.fuelPenalty,
            fuel: 150 - camParams.fuelPenalty,
            battery: 100,
            inShadow: false,
            trail: []
        };
    }

    function update(dt) {
        if (!game.running || game.paused || game.finished) return;
        game.time += dt;

        // Запуск
        if (game.satellites.length < game.totalSatellites && game.time - game.lastLaunchTime >= game.launchInterval) {
            game.satellites.push(createSatellite(game.satellites.length));
            game.lastLaunchTime = game.time;
            document.getElementById('launched-value').textContent = game.satellites.length + ' / ' + game.totalSatellites;
            renderQueue();
        }

        // Мусор
        if (!game.debrisSpawned && Math.random() < DEBRIS_SPAWN_CHANCE) {
            game.debris.push({ angle: Math.random() * Math.PI * 2, radius: 150 + Math.random() * 200, speed: 0.5, life: 15 });
            game.debrisSpawned = true;
            showBanner('⚠ Космический мусор!');
        }
        for (let i = game.debris.length - 1; i >= 0; i--) {
            let d = game.debris[i];
            d.angle += d.speed * dt; d.life -= dt;
            if (d.life <= 0) game.debris.splice(i, 1);
        }

        // Обновление спутников
        game.satellites.forEach(sat => {
            // Тень (Солнце слева)
            const sunAngle = Math.PI; 
            let diff = Math.abs(sat.angle - sunAngle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            
            // Если наклон сильный, тень меньше влияет (спутник летает "над" и "под" тенью)
            const shadowFactor = 1 - (sat.inclination / 90); 
            sat.inShadow = diff < (Math.PI / 3) * shadowFactor;
            
            if (sat.inShadow) sat.battery -= 20 * dt;
            else sat.battery = Math.min(100, sat.battery + 15 * dt);
            sat.battery = Math.max(0, sat.battery);

            // Движение
            sat.angle += sat.baseSpeed * sat.speedMultiplier * dt;
            if (sat.angle > Math.PI * 2) sat.angle -= Math.PI * 2;

            // Приближение
            const diffR = sat.targetRadius - sat.radius;
            sat.radius += diffR * 0.5 * dt;

            // След
            sat.trail.push({ angle: sat.angle, radius: sat.radius });
            if (sat.trail.length > 20) sat.trail.shift();
        });

        // Столкновения (с учетом наклона)
        for (let i = 0; i < game.satellites.length; i++) {
            for (let j = i + 1; j < game.satellites.length; j++) {
                const s1 = game.satellites[i];
                const s2 = game.satellites[j];
                if (Math.abs(s1.inclination - s2.inclination) > 15) continue; // Разные плоскости = нет столкновения
                
                if (Math.abs(s1.radius - s2.radius) < 15) {
                    let angleDiff = Math.abs(s1.angle - s2.angle);
                    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                    if (angleDiff < 0.15) {
                        game.collisions++;
                        document.getElementById('collision-value').textContent = game.collisions;
                        s2.angle += 0.3; 
                    }
                }
            }
        }

        // Расчет покрытия
        let cov = 0;
        game.satellites.forEach(s => {
            if (Math.abs(s.radius - s.targetRadius) < 10 && s.battery > 0) cov += s.camRadius;
        });
        game.coveragePercent = Math.min(100, Math.round(cov * 1.2));
        coverageValue.textContent = game.coveragePercent + '%';

        if (game.satellites.length >= game.totalSatellites && game.time >= game.flightTimeLimit) {
            finishGame();
        }
    }

    // ============================================================
    // ОТРИСОВКА (НОРМАЛЬНАЯ)
    // ============================================================
    function render() {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        ctx.clearRect(0, 0, w, h);

        // Звезды
        for (let i = 0; i < 100; i++) {
            // Просто генерируем статичные звезды при первом рендере
            if (!game.stars[i]) game.stars[i] = {x: Math.random()*w, y: Math.random()*h, r: Math.random()*1.5};
            ctx.beginPath();
            ctx.arc(game.stars[i].x, game.stars[i].y, game.stars[i].r, 0, Math.PI*2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }

        // --- ЗЕМЛЯ ---
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1a6fb0';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Тень (полупрозрачный сектор)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, game.earthRadius + 150, Math.PI * 0.8, Math.PI * 1.2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // --- ОРБИТЫ И СПУТНИКИ ---
        game.satellites.forEach(sat => {
            // Эллипс орбиты (наклон визуально сплющивает)
            const orbitTilt = PERSPECTIVE_TILT * Math.cos(sat.inclination * Math.PI / 180);
            
            // Отрисовка орбиты
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.ellipse(cx, cy, sat.targetRadius, sat.targetRadius * orbitTilt, 0, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
            ctx.stroke();
            ctx.setLineDash([]);

            // Позиция спутника
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius * orbitTilt;

            // Зона покрытия
            ctx.beginPath();
            ctx.arc(x, y, sat.camRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fill();

            // Спутник
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            
            if (sat.battery <= 0) ctx.fillStyle = '#ff4444';
            else if (sat.inShadow) ctx.fillStyle = '#888888';
            else ctx.fillStyle = '#ffffff';
            
            ctx.fill();

            // Полоска батареи
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(x - 8, y - 12, 16 * (sat.battery / 100), 2);
        });
    }

    // ============================================================
    // КОРРЕКЦИЯ И ЗАВЕРШЕНИЕ
    // ============================================================
    function correctSelected() {
        if (!game.selectedSatellite) return;
        const sat = game.selectedSatellite;

        if (sat.battery <= 0) {
            showBanner('Нет энергии (в тени)!');
            return;
        }

        const fuelCost = sat.engineType === 'chem' ? 20 : 2;
        const speedGain = sat.engineType === 'chem' ? 0.2 : 0.02;

        if (sat.fuel < fuelCost) {
            showBanner('Нет топлива!');
            return;
        }

        sat.fuel -= fuelCost;
        sat.speedMultiplier = Math.min(3.0, sat.speedMultiplier + speedGain);
        selectedValue.textContent = `SAT-${sat.id} | Топл: ${Math.round(sat.fuel)} | Батарея: ${Math.round(sat.battery)}% | Скор: ${Math.round(sat.speedMultiplier*100)}%`;
    }

    function finishGame() {
        game.running = false; game.finished = true;
        const success = game.collisions === 0;
        
        resultTitle.textContent = success ? 'УСПЕХ' : 'НЕУДАЧА';
        resultTitle.style.color = success ? '#00ff00' : '#ff4444';
        resultText.innerHTML = `Столкновений: ${game.collisions}<br>Покрытие Земли: ${game.coveragePercent}%<br>Время: ${game.time.toFixed(1)} с`;
        
        resultScreen.classList.remove('hidden');
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ И ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    function showBanner(text) {
        const b = document.getElementById('event-banner');
        document.getElementById('event-text').textContent = text;
        b.classList.remove('hidden');
        setTimeout(() => b.classList.add('hidden'), 2000);
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        render();
    }
    window.addEventListener('resize', resizeCanvas);

    // Меню
    menuBtn.onclick = () => sideMenu.classList.toggle('hidden');
    closeMenuBtn.onclick = () => sideMenu.classList.add('hidden');
    guideBtn.onclick = () => { guideScreen.classList.remove('hidden'); sideMenu.classList.add('hidden'); };
    closeGuideBtn.onclick = () => guideScreen.classList.add('hidden');

    // Старт
    startBtn.onclick = () => {
        if (game.running) return;
        game.running = true; game.paused = false; game.finished = false;
        game.time = 0; game.lastLaunchTime = 0;
        game.satellites = []; game.collisions = 0; game.debris = []; game.debrisSpawned = false;
        game.totalSatellites = parseInt(countSlider.value);
        game.launchInterval = parseInt(intervalSlider.value);
        game.impulse = parseInt(impulseSlider.value);
        
        resultScreen.classList.add('hidden');
        document.getElementById('collision-value').textContent = '0';
        document.getElementById('launched-value').textContent = '0 / ' + game.totalSatellites;
        startBtn.disabled = true; pauseBtn.disabled = false;
        renderQueue();
    };

    // Пауза
    pauseBtn.onclick = () => {
        game.paused = !game.paused;
        pauseBtn.textContent = game.paused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА';
    };

    // Сброс
    resetBtn.onclick = () => {
        game.running = false; game.paused = false; game.finished = false;
        game.satellites = []; game.collisions = 0; game.debris = [];
        game.time = 0;
        resultScreen.classList.add('hidden');
        startBtn.disabled = false; pauseBtn.disabled = true;
        renderQueue(); render();
    };

    resultResetBtn.onclick = resetBtn.onclick;
    resultNextBtn.onclick = () => {
        // Заглушка для следующей миссии
        resetBtn.onclick();
    };

    correctBtn.onclick = correctSelected;

    // Выбор спутника
    canvas.addEventListener('click', (e) => {
        if (!game.running) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        
        let found = null;
        game.satellites.forEach(sat => {
            const orbitTilt = PERSPECTIVE_TILT * Math.cos(sat.inclination * Math.PI / 180);
            const sx = cx + Math.cos(sat.angle) * sat.radius;
            const sy = cy + Math.sin(sat.angle) * sat.radius * orbitTilt;
            if (Math.hypot(x - sx, y - sy) < 20) found = sat;
        });
        
        if (found) {
            game.selectedSatellite = found;
            correctBtn.disabled = false;
            correctBtn.style.background = '#0055aa';
            selectedInfo.classList.remove('hidden');
            selectedValue.textContent = `SAT-${found.id} | Топл: ${Math.round(found.fuel)} | Батарея: ${Math.round(found.battery)}%`;
        } else {
            game.selectedSatellite = null;
            correctBtn.disabled = true;
            correctBtn.style.background = '#333';
            selectedInfo.classList.add('hidden');
        }
    });

    // Игровой цикл
    let lastTime = performance.now();
    function loop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        update(dt);
        render();
        requestAnimationFrame(loop);
    }

    // Инициализация
    initQueue(3);
    resizeCanvas();
    requestAnimationFrame(loop);
})();
