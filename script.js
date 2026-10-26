(function () {
    'use strict';

    // ============================================================
    // КАМПАНИЯ И НАСТРОЙКИ
    // ============================================================
    const CAMPAIGN = [
        { count: 2, interval: 5, altitude: 300, title: 'Запустить 2 спутника' },
        { count: 3, interval: 4, altitude: 400, title: 'Запустить 3 спутника' },
        { count: 4, interval: 3, altitude: 450, title: 'Запустить 4 спутника' },
        { count: 5, interval: 2, altitude: 500, title: 'Запустить 5 спутников' },
        { count: 6, interval: 2, altitude: 550, title: 'Запустить 6 спутников' }
    ];

    // Настройки камер
    const CAMS = [
        { name: 'Малая', radius: 10, weight: 0 },
        { name: 'Стандарт', radius: 20, weight: 10 },
        { name: 'Широкая', radius: 35, weight: 25 }
    ];

    const PERSPECTIVE_TILT = 0.45;
    const DEBRIS_SPAWN_CHANCE = 0.008;

    // --- DOM ---
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    // Элементы UI
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
    
    // Меню
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
        flightTimeLimit: 40, // Дадим больше времени из-за сложности
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
            game.launchQueue.push({ 
                altitude: 300 + (i * 40), 
                inclination: 0, 
                cam: 1, 
                engine: 'chem' 
            });
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
            // Цвет зависит от наклона орбиты (0 - голубой, 90 - красный)
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

    // Обработчики панели настройки
    setupAlt.addEventListener('input', function() {
        game.launchQueue[game.selectedQueueIndex].altitude = parseInt(this.value);
        setupAltVal.textContent = this.value;
        if (!game.running) render();
    });
    setupInc.addEventListener('input', function() {
        game.launchQueue[game.selectedQueueIndex].inclination = parseInt(this.value);
        setupIncVal.textContent = this.value;
        renderQueue(); // Перекрашиваем кнопку
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
    // ЛОГИКА ФИЗИКИ И ОБНОВЛЕНИЯ
    // ============================================================
    function createSatellite(index) {
        const impulseFactor = game.impulse / 100;
        const startRadius = 40 + impulseFactor * 60;
        const startAngle = (Math.PI * 2 / game.totalSatellites) * index;
        const queueItem = game.launchQueue[index];
        const camParams = CAMS[queueItem.cam];

        // Влияние камеры на вес (больше камера = больше топлива на маневры)
        const weightPenalty = camParams.weight; 

        return {
            id: index + 1,
            angle: startAngle,
            radius: startRadius,
            targetRadius: game.earthRadius + queueItem.altitude / 10,
            inclination: queueItem.inclination * (Math.PI / 180), // в радианы
            engineType: queueItem.engine,
            camRadius: camParams.radius,
            
            baseSpeed: (0.8 + impulseFactor * 1.2),
            speedMultiplier: 1.0,
            
            maxFuel: 150 - weightPenalty,
            fuel: 150 - weightPenalty,
            battery: 100, // Энергия
            
            inShadow: false,
            trail: []
        };
    }

    function update(dt) {
        if (!game.running || game.paused || game.finished) return;
        game.time += dt;

        // Запуск новых
        if (game.satellites.length < game.totalSatellites && 
            game.time - game.lastLaunchTime >= game.launchInterval) {
            game.satellites.push(createSatellite(game.satellites.length));
            game.lastLaunchTime = game.time;
            document.getElementById('launched-value').textContent = game.satellites.length + ' / ' + game.totalSatellites;
            renderQueue();
        }

        // Мусор
        if (!game.debrisSpawned && Math.random() < DEBRIS_SPAWN_CHANCE) spawnDebris();

        // Обновление спутников
        game.satellites.forEach(sat => {
            // 1. Проверка тени (Солнце слева сверху)
            // Если угол спутника находится в определенном секторе, он в тени
            const sunAngle = -Math.PI / 4; // Солнце светит с левого верхнего угла
            let diff = Math.abs(sat.angle - sunAngle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            
            sat.inShadow = diff < Math.PI / 2.5; // Примерно 70 градусов сектор тени
            
            // 2. Энергия
            if (sat.inShadow) {
                sat.battery -= 15 * dt; // Тратим батарею
            } else {
                sat.battery = Math.min(100, sat.battery + 10 * dt); // Заряжаемся
            }
            sat.battery = Math.max(0, sat.battery);

            // 3. Движение
            const speed = sat.baseSpeed * sat.speedMultiplier;
            sat.angle += speed * dt;
            if (sat.angle > Math.PI * 2) sat.angle -= Math.PI * 2;

            // 4. Приближение к цели
            const diffR = sat.targetRadius - sat.radius;
            sat.radius += diffR * 0.5 * dt;

            // 5. След
            sat.trail.push({ angle: sat.angle, radius: sat.radius });
            if (sat.trail.length > 30) sat.trail.shift();
        });

        // Проверка столкновений (теперь с учетом наклона)
        for (let i = 0; i < game.satellites.length; i++) {
            for (let j = i + 1; j < game.satellites.length; j++) {
                const s1 = game.satellites[i];
                const s2 = game.satellites[j];
                
                // Если наклоны различаются больше чем на 15 градусов - они не столкнутся
                if (Math.abs(s1.inclination - s2.inclination) > 0.26) continue;

                if (Math.abs(s1.radius - s2.radius) < 15) {
                    let angleDiff = Math.abs(s1.angle - s2.angle);
                    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                    if (angleDiff < 0.15) {
                        game.collisions++;
                        document.getElementById('collision-value').textContent = game.collisions;
                        s2.angle += 0.3; // Отталкиваем
                    }
                }
            }
        }

        updateCoverage();

        if (game.satellites.length >= game.totalSatellites && game.time >= game.flightTimeLimit) {
            finishGame();
        }
    }

    function updateCoverage() {
        // Упрощенный расчет покрытия: суммируем радиусы камер
        let totalCoverage = 0;
        game.satellites.forEach(sat => {
            // Чем ближе к цели, тем лучше работает
            if (Math.abs(sat.radius - sat.targetRadius) < 10) {
                totalCoverage += sat.camRadius;
            }
        });
        // Ограничиваем 100%
        game.coveragePercent = Math.min(100, Math.round(totalCoverage * 1.5));
        coverageValue.textContent = game.coveragePercent + '%';
    }

    // ============================================================
    // ОТРИСОВКА
    // ============================================================
    function render() {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        ctx.clearRect(0, 0, w, h);

        // Звёзды
        const tSec = performance.now() / 1000;
        for (let i = 0; i < 150; i++) {
            const st = { x: Math.random(), y: Math.random() }; // Для оптимизации просто статичные
            // ... (здесь можно оставить генерацию звезд)
        }

        // Земля
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1a6fb0';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.stroke();

        // Тень Земли (полупрозрачный сектор)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        // Сектор с левой стороны
        ctx.arc(cx, cy, game.earthRadius + 200, Math.PI * 0.75, Math.PI * 1.25);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        // Отрисовка спутников
        game.satellites.forEach(sat => {
            // Применяем наклон (визуально сжимаем по Y)
            const tiltFactor = Math.cos(sat.inclination) * 0.5 + 0.5;
            
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius * PERSPECTIVE_TILT * tiltFactor;

            // Зона покрытия (Камера)
            ctx.beginPath();
            ctx.arc(x, y, sat.camRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fill();

            // Спутник
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            
            // Цвет: если в тени - темный, если энергии нет - красный
            if (sat.battery <= 0) ctx.fillStyle = '#ff4444';
            else if (sat.inShadow) ctx.fillStyle = '#555555';
            else ctx.fillStyle = '#ffffff';
            
            ctx.fill();

            // Батарея (маленькая полоска над спутником)
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(x - 8, y - 12, 16 * (sat.battery / 100), 2);
        });
    }

    // ============================================================
    // УПРАВЛЕНИЕ И КОРРЕКЦИЯ
    // ============================================================
    function correctSelected() {
        if (!game.selectedSatellite) return;
        const sat = game.selectedSatellite;

        // Проверки
        if (sat.battery <= 0) {
            showBanner('Нет энергии (в тени)!');
            return;
        }

        // Трата в зависимости от двигателя
        const fuelCost = sat.engineType === 'chem' ? 20 : 2;
        const speedGain = sat.engineType === 'chem' ? 0.2 : 0.02;

        if (sat.fuel < fuelCost) {
            showBanner('Нет топлива!');
            return;
        }

        sat.fuel -= fuelCost;
        sat.speedMultiplier = Math.min(3.0, sat.speedMultiplier + speedGain);
        
        // Обновляем телеметрию
        selectedValue.textContent = `SAT-${sat.id} | Топл: ${Math.round(sat.fuel)} | Батарея: ${Math.round(sat.battery)}% | Скор: ${Math.round(sat.speedMultiplier*100)}%`;
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (БАННЕР, ИНИЦИАЛИЗАЦИЯ И Т.Д.)
    // ============================================================
    function showBanner(text) {
        const b = document.getElementById('event-banner');
        document.getElementById('event-text').textContent = text;
        b.classList.remove('hidden');
        setTimeout(() => b.classList.add('hidden'), 2000);
    }

    // ... (Код старта, ресайза и кликов оставляем как в прошлой версии, 
    // добавляем только привязку новых кнопок меню)
    
    // Инициализация меню
    document.getElementById('guide-btn').onclick = () => { guideScreen.classList.remove('hidden'); sideMenu.classList.add('hidden'); };
    document.getElementById('close-guide-btn').onclick = () => guideScreen.classList.add('hidden');
    
    // Стартовая инициализация
    initQueue(3);
    resizeCanvas();
    requestAnimationFrame(function loop() {
        // Упрощенный игровой цикл для этого примера
        update(1/60);
        render();
        requestAnimationFrame(loop);
    });
})();
