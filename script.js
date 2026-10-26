(function () {
    'use strict';

    // ============================================================
    // КАМПАНИЯ
    // ============================================================
    const CAMPAIGN = [
        { count: 2, interval: 5, altitude: 300, title: 'Запустить 2 спутника' },
        { count: 3, interval: 4, altitude: 400, title: 'Запустить 3 спутника' },
        { count: 4, interval: 3, altitude: 450, title: 'Запустить 4 спутника' },
        { count: 5, interval: 2, altitude: 500, title: 'Запустить 5 спутников' },
        { count: 6, interval: 2, altitude: 550, title: 'Запустить 6 спутников' }
    ];

    const ACHIEVEMENTS = [
        { id: 'first_launch', name: 'Первый запуск', desc: 'Запустить первую миссию' },
        { id: 'no_collisions', name: 'Чистое небо', desc: 'Пройти миссию без столкновений' },
        { id: 'no_corrections', name: 'Экономист', desc: 'Пройти миссию без коррекций' },
        { id: 'many_satellites', name: 'Плотная группировка', desc: 'Запустить 5+ спутников' },
        { id: 'campaign_done', name: 'Покоритель орбит', desc: 'Пройти всю кампанию' },
        { id: 'dodger', name: 'Уклонист', desc: 'Пережить космический мусор' }
    ];

    const PERSPECTIVE_TILT = 0.45;
    const DV_PER_CORRECTION = 10;
    const DEBRIS_SPAWN_CHANCE = 0.008;

    // --- DOM ---
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const altitudeSlider = document.getElementById('altitude');
    const altitudeValue = document.getElementById('altitude-value');
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
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const achievementsBtn = document.getElementById('achievements-btn');
    const closeAchievementsBtn = document.getElementById('close-achievements-btn');
    const resetCampaignBtn = document.getElementById('reset-campaign-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');
    
    const achievementsScreen = document.getElementById('achievements-screen');
    const achievementsList = document.getElementById('achievements-list');
    const eventBanner = document.getElementById('event-banner');
    const eventText = document.getElementById('event-text');
    const hintBar = document.getElementById('hint-bar');
    const missionInfo = document.getElementById('mission-info');
    const timeValue = document.getElementById('time-value');
    const launchedValue = document.getElementById('launched-value');
    const collisionValue = document.getElementById('collision-value');
    const dvValue = document.getElementById('dv-value');
    const selectedInfo = document.getElementById('selected-info');
    const selectedValue = document.getElementById('selected-value');
    const resultScreen = document.getElementById('result-screen');
    const resultTitle = document.getElementById('result-title');
    const resultText = document.getElementById('result-text');
    const resultNextBtn = document.getElementById('result-next-btn');
    const resultResetBtn = document.getElementById('result-reset-btn');

    // --- Состояние ---
    const game = {
        running: false,
        paused: false,
        finished: false,
        time: 0,
        flightTimeLimit: 30,
        targetAltitude: 300,
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
        totalDV: 0,
        currentLevel: 0,
        debris: [],
        debrisSpawned: false,
        unlockedAchievements: {},
        correctionsMade: false,
        bestScore: 0
    };

    // ============================================================
    // СОХРАНЕНИЕ
    // ============================================================
    function loadData() {
        try {
            const savedAch = localStorage.getItem('satellite_achievements');
            if (savedAch) game.unlockedAchievements = JSON.parse(savedAch);
            
            const savedBest = localStorage.getItem('satellite_best_score');
            if (savedBest) game.bestScore = parseInt(savedBest, 10) || 0;

            const savedLevel = localStorage.getItem('satellite_campaign_level');
            if (savedLevel !== null) {
                const level = parseInt(savedLevel, 10);
                if (level >= 0 && level < CAMPAIGN.length) game.currentLevel = level;
            }
        } catch (e) {}
    }

    function saveAchievements() {
        try { localStorage.setItem('satellite_achievements', JSON.stringify(game.unlockedAchievements)); } catch (e) {}
    }
    
    function saveBestScore(score) {
        if (score > game.bestScore) {
            game.bestScore = score;
            try { localStorage.setItem('satellite_best_score', game.bestScore); } catch (e) {}
            return true;
        }
        return false;
    }

    function saveProgress() {
        try { localStorage.setItem('satellite_campaign_level', game.currentLevel); } catch (e) {}
    }

    // ============================================================
    // ДОСТИЖЕНИЯ И МЕНЮ
    // ============================================================
    function unlockAchievement(id) {
        if (game.unlockedAchievements[id]) return;
        game.unlockedAchievements[id] = true;
        saveAchievements();
        showBanner('🏆 Достижение: ' + ACHIEVEMENTS.find(a => a.id === id).name);
    }

    function renderAchievements() {
        achievementsList.innerHTML = '';
        for (const ach of ACHIEVEMENTS) {
            const li = document.createElement('li');
            const unlocked = game.unlockedAchievements[ach.id];
            li.className = unlocked ? 'unlocked' : 'locked';
            li.textContent = (unlocked ? '✅ ' : '🔒 ') + ach.name + ' — ' + ach.desc;
            achievementsList.appendChild(li);
        }
    }

    function resetAllData() {
        if (!confirm('Удалить ВСЕ достижения и прогресс?')) return;
        localStorage.clear();
        game.unlockedAchievements = {};
        game.bestScore = 0;
        game.currentLevel = 0;
        achievementsScreen.classList.add('hidden');
        applyLevel();
        resetGame();
        showBanner('Все данные сброшены');
    }

    // ============================================================
    // UX ПОДСКАЗКИ
    // ============================================================
    function updateHint() {
        if (game.finished) {
            hintBar.textContent = 'Миссия завершена.';
            return;
        }
        if (game.paused) {
            hintBar.textContent = 'ПАУЗА. Нажмите «Продолжить».';
            return;
        }
        if (!game.running) {
            hintBar.textContent = 'Настройте параметры и нажмите «Запуск».';
            startBtn.classList.add('glow');
            return;
        }
        startBtn.classList.remove('glow');

        if (game.selectedSatellite) {
            hintBar.textContent = 'Нажмите «Коррекция» для ускорения (тратит топливо).';
        } else {
            hintBar.textContent = 'Тапните по спутнику на орбите, чтобы выбрать его.';
        }
    }

    // ============================================================
    // БАННЕР
    // ============================================================
    let bannerTimer = null;
    function showBanner(text) {
        eventText.textContent = text;
        eventBanner.classList.remove('hidden');
        if (bannerTimer) clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => {
            eventBanner.classList.add('hidden');
        }, 2500);
    }

    // ============================================================
    // УРОВНИ
    // ============================================================
    function applyLevel() {
        const level = CAMPAIGN[game.currentLevel];
        if (!level) return;

        altitudeSlider.value = level.altitude;
        altitudeValue.textContent = level.altitude;
        countSlider.value = level.count;
        countValue.textContent = level.count;
        intervalSlider.value = level.interval;
        intervalValue.textContent = level.interval;

        game.totalSatellites = level.count;
        game.targetAltitude = level.altitude;
        game.launchInterval = level.interval;

        missionInfo.textContent = 'Миссия ' + (game.currentLevel + 1) + ' / ' + CAMPAIGN.length + ' — ' + level.title;
        launchedValue.textContent = '0 / ' + level.count;
        updateHint();
    }

    // ============================================================
    // ЗВЁЗДЫ И ОБЛАКА
    // ============================================================
    function createStars() {
        game.stars = [];
        for (let i = 0; i < 150; i++) {
            game.stars.push({
                x: Math.random(), y: Math.random(),
                radius: Math.random() * 1.5 + 0.3,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 2 + 1
            });
        }
    }

    function createClouds() {
        game.clouds = [];
        for (let i = 0; i < 6; i++) {
            game.clouds.push({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * 0.5 + 0.1,
                size: Math.random() * 15 + 10,
                speed: (Math.random() * 0.2 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
                opacity: Math.random() * 0.3 + 0.1
            });
        }
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        render();
    }
    window.addEventListener('resize', resizeCanvas);

    // ============================================================
    // СПУТНИКИ
    // ============================================================
    function createSatellite(index) {
        const impulseFactor = game.impulse / 100;
        const startRadius = 40 + impulseFactor * 60;
        const startAngle = (Math.PI * 2 / game.totalSatellites) * index;
        const heightStep = game.totalSatellites > 4 ? 20 : 30;
        const altitudeOffset = index * heightStep;

        return {
            id: index + 1,
            angle: startAngle,
            radius: startRadius,
            targetRadius: game.earthRadius + (game.targetAltitude + altitudeOffset) / 10,
            altitudeOffset: altitudeOffset,
            baseSpeed: 0.8 + impulseFactor * 1.2,
            speedMultiplier: 1.0,
            maxFuel: 100,
            fuel: 100,
            spentDV: 0,
            trail: []
        };
    }

    // ============================================================
    // МУСОР
    // ============================================================
    function spawnDebris() {
        const angle = Math.random() * Math.PI * 2;
        const radius = 150 + Math.random() * 200;
        game.debris.push({
            angle: angle, radius: radius, speed: 0.4 + Math.random() * 0.6, life: 15
        });
        game.debrisSpawned = true;
        showBanner('⚠ Внимание! Космический мусор!');
    }

    function updateDebris(dt) {
        for (let i = game.debris.length - 1; i >= 0; i--) {
            const d = game.debris[i];
            d.life -= dt;
            d.angle += d.speed * dt;
            if (d.angle > Math.PI * 2) d.angle -= Math.PI * 2;
            if (d.life <= 0) {
                game.debris.splice(i, 1);
                unlockAchievement('dodger');
            }
        }
    }

    // ============================================================
    // ЛОГИКА
    // ============================================================
    function update(dt) {
        if (!game.running || game.finished || game.paused) return;

        game.time += dt;

        for (let c of game.clouds) {
            c.angle += c.speed * dt;
        }

        if (game.satellites.length < game.totalSatellites &&
            game.time - game.lastLaunchTime >= game.launchInterval) {
            const newSat = createSatellite(game.satellites.length);
            game.satellites.push(newSat);
            game.lastLaunchTime = game.time;
            launchedValue.textContent = game.satellites.length + ' / ' + game.totalSatellites;
            if (game.satellites.length === 1) unlockAchievement('first_launch');
        }

        if (!game.debrisSpawned && Math.random() < DEBRIS_SPAWN_CHANCE) {
            spawnDebris();
        }
        updateDebris(dt);

        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            const speed = sat.baseSpeed * sat.speedMultiplier;
            sat.angle += speed * dt;
            if (sat.angle > Math.PI * 2) sat.angle -= Math.PI * 2;

            const diff = sat.targetRadius - sat.radius;
            sat.radius += diff * 0.5 * dt;

            sat.trail.push({ angle: sat.angle, radius: sat.radius });
            if (sat.trail.length > 40) sat.trail.shift();
        }

        checkCollisions();
        updateSelectedInfo();
        updateHint();

        timeValue.textContent = game.time.toFixed(1);
        dvValue.textContent = game.totalDV;

        if (game.satellites.length >= game.totalSatellites && game.time >= game.flightTimeLimit) {
            finishGame();
        }
    }

    function updateSelectedInfo() {
        if (!game.selectedSatellite) {
            selectedInfo.classList.add('hidden');
            return;
        }
        const sat = game.selectedSatellite;
        if (game.satellites.indexOf(sat) === -1) {
            clearSelection();
            return;
        }
        const altitudeKm = Math.round((sat.radius - game.earthRadius) * 10);
        const speedPercent = Math.round(sat.speedMultiplier * 100);
        const fuelPercent = Math.round(sat.fuel);
        selectedValue.textContent = `SAT-${sat.id} | Выс: ${altitudeKm}км | Скор: ${speedPercent}% | Топл: ${fuelPercent}`;
        selectedInfo.classList.remove('hidden');
    }

    function checkCollisions() {
        for (let i = 0; i < game.satellites.length; i++) {
            for (let j = i + 1; j < game.satellites.length; j++) {
                const s1 = game.satellites[i];
                const s2 = game.satellites[j];
                if (Math.abs(s1.radius - s2.radius) < 15) {
                    let angleDiff = Math.abs(s1.angle - s2.angle);
                    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                    if (angleDiff < 0.15) {
                        game.collisions++;
                        collisionValue.textContent = game.collisions;
                        collisionValue.style.color = '#ff4444';
                        s2.angle += 0.3;
                    }
                }
            }
        }
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
        for (let i = 0; i < game.stars.length; i++) {
            const st = game.stars[i];
            const tw = 0.5 + 0.5 * Math.sin(tSec * st.speed + st.phase);
            ctx.globalAlpha = 0.3 + tw * 0.7;
            ctx.beginPath();
            ctx.arc(st.x * w, st.y * h, st.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Земля
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 6, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();

        const earthGrad = ctx.createRadialGradient(
            cx - game.earthRadius * 0.4, cy - game.earthRadius * 0.4, game.earthRadius * 0.1,
            cx, cy, game.earthRadius
        );
        earthGrad.addColorStop(0, '#4db8ff');
        earthGrad.addColorStop(0.5, '#1a6fb0');
        earthGrad.addColorStop(1, '#021a2e');
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = earthGrad;
        ctx.fill();

        // Континенты
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(40, 160, 80, 0.6)';
        ctx.beginPath();
        ctx.ellipse(cx - 20, cy - 15, 25, 15, 0.5, 0, Math.PI * 2);
        ctx.ellipse(cx + 15, cy + 10, 30, 20, -0.3, 0, Math.PI * 2);
        ctx.ellipse(cx - 5, cy + 30, 15, 10, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Облака
        ctx.fillStyle = '#ffffff';
        for (let c of game.clouds) {
            const dx = Math.cos(c.angle) * game.earthRadius * c.dist;
            const dy = Math.sin(c.angle) * game.earthRadius * c.dist;
            ctx.globalAlpha = c.opacity;
            ctx.beginPath();
            ctx.ellipse(cx + dx, cy + dy, c.size, c.size * 0.6, c.angle, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // Блик
        const highlightGrad = ctx.createRadialGradient(
            cx - game.earthRadius * 0.45, cy - game.earthRadius * 0.45, 0,
            cx - game.earthRadius * 0.45, cy - game.earthRadius * 0.45, game.earthRadius * 0.5
        );
        highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx - game.earthRadius * 0.45, cy - game.earthRadius * 0.45, game.earthRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = highlightGrad;
        ctx.fill();

        // Атмосфера
        const haloGrad = ctx.createRadialGradient(cx, cy, game.earthRadius, cx, cy, game.earthRadius + 30);
        haloGrad.addColorStop(0, 'rgba(0, 255, 255, 0.25)');
        haloGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius + 30, 0, Math.PI * 2);
        ctx.fillStyle = haloGrad;
        ctx.fill();

        // Орбиты
        if (game.running && game.satellites.length > 0) {
            for (let i = 0; i < game.satellites.length; i++) {
                const targetR = game.satellites[i].targetRadius;
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.ellipse(cx, cy, targetR, targetR * PERSPECTIVE_TILT, 0, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 255,
