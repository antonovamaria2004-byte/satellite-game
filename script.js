(function () {
    'use strict';

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
    const queueContainer = document.getElementById('satellite-queue');
    
    const setupPanel = document.getElementById('setup-panel');
    const setupId = document.getElementById('setup-id');
    const setupAlt = document.getElementById('setup-alt');
    const setupAltVal = document.getElementById('setup-alt-val');
    const setupEngineBtn = document.getElementById('setup-engine');

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
        bestScore: 0,
        launchQueue: [],
        selectedQueueIndex: -1
    };

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

    function initQueue(count) {
        game.launchQueue = [];
        const missionAlt = CAMPAIGN[game.currentLevel]?.altitude || 400;
        
        for (let i = 0; i < count; i++) {
            game.launchQueue.push({ 
                altitude: missionAlt + (i * 30),
                engine: 'chem' 
            });
        }
        game.selectedQueueIndex = -1;
        setupPanel.classList.add('hidden');
        renderQueue();
    }

    function renderQueue() {
        queueContainer.innerHTML = '';
        for (let i = 0; i < game.totalSatellites; i++) {
            const btn = document.createElement('button');
            btn.className = `queue-btn`;
            btn.textContent = i + 1;
            
            if (i === game.selectedQueueIndex) btn.classList.add('selected-for-setup');
            
            if (i < game.satellites.length && game.running) {
                btn.disabled = true;
            } else if (!game.running) {
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
        setupEngineBtn.textContent = item.engine === 'chem' ? 'Двигатель: Хим (мощный)' : 'Двигатель: Ион (эконом)';
    }

    setupAlt.addEventListener('input', function() {
        game.launchQueue[game.selectedQueueIndex].altitude = parseInt(this.value);
        setupAltVal.textContent = this.value;
        if (!game.running) render();
    });

    setupEngineBtn.addEventListener('click', function() {
        const item = game.launchQueue[game.selectedQueueIndex];
        item.engine = item.engine === 'chem' ? 'ion' : 'chem';
        updateSetupPanel();
    });

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
            hintBar.textContent = 'Настройте спутники и нажмите «Запуск».';
            startBtn.classList.add('glow');
            return;
        }
        startBtn.classList.remove('glow');

        if (game.selectedSatellite) {
            hintBar.textContent = 'Спутник выбран. Нажмите «Коррекция» (C).';
        } else {
            hintBar.textContent = 'Тапните по спутнику, чтобы выбрать его.';
        }
    }

    let bannerTimer = null;
    function showBanner(text) {
        eventText.textContent = text;
        eventBanner.classList.remove('hidden');
        if (bannerTimer) clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => {
            eventBanner.classList.add('hidden');
        }, 2500);
    }

    function applyLevel() {
        const level = CAMPAIGN[game.currentLevel];
        if (!level) return;

        countSlider.value = level.count;
        countValue.textContent = level.count;
        intervalSlider.value = level.interval;
        intervalValue.textContent = level.interval;

        game.totalSatellites = level.count;
        game.targetAltitude = level.altitude;
        game.launchInterval = level.interval;

        missionInfo.textContent = 'Миссия ' + (game.currentLevel + 1) + ' / ' + CAMPAIGN.length + ' — ' + level.title;
        launchedValue.textContent = '0 / ' + level.count;
        
        initQueue(level.count);
        updateHint();
    }

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

    function createSatellite(index) {
        const impulseFactor = game.impulse / 100;
        const startRadius = 40 + impulseFactor * 60;
        const startAngle = (Math.PI * 2 / game.totalSatellites) * index;
        const queueItem = game.launchQueue[index];

        return {
            id: index + 1,
            angle: startAngle,
            radius: startRadius,
            targetRadius: game.earthRadius + queueItem.altitude / 10,
            engineType: queueItem.engine,
            baseSpeed: (0.8 + impulseFactor * 1.2),
            speedMultiplier: 1.0,
            maxFuel: 150,
            fuel: 150,
            trail: []
        };
    }

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
            renderQueue();
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
        const engName = sat.engineType === 'chem' ? 'Хим' : 'Ион';
        selectedValue.textContent = 
            `SAT-${sat.id} (${engName}) | Выс: ${altitudeKm}км | Скор: ${speedPercent}% | Топл: ${Math.round(sat.fuel)}`;
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

    function render() {
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        ctx.clearRect(0, 0, w, h);

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

        const haloGrad = ctx.createRadialGradient(cx, cy, game.earthRadius, cx, cy, game.earthRadius + 30);
        haloGrad.addColorStop(0, 'rgba(0, 255, 255, 0.25)');
        haloGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius + 30, 0, Math.PI * 2);
        ctx.fillStyle = haloGrad;
        ctx.fill();

        for (let i = 0; i < game.launchQueue.length; i++) {
            if (i < game.satellites.length && game.running) continue; 
            const item = game.launchQueue[i];
            if (!item) continue;
            const targetR = game.earthRadius + item.altitude / 10;
            
            const isSelected = (i === game.selectedQueueIndex && !game.running);
            
            ctx.beginPath();
            ctx.setLineDash(isSelected ? [10, 5] : [5, 5]);
            ctx.ellipse(cx, cy, targetR, targetR * PERSPECTIVE_TILT, 0, 0, Math.PI * 2);
            ctx.strokeStyle = isSelected ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 255, 255, 0.15)';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (game.satellites.length >= 2) {
            for (let i = 0; i < game.satellites.length; i++) {
                const s1 = game.satellites[i];
                const s2 = game.satellites[(i + 1) % game.satellites.length];
                let angleDiff = Math.abs(s1.angle - s2.angle);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                const diffDeg = angleDiff * 180 / Math.PI;
                
                if (diffDeg < 30) {
                    let arcColor = diffDeg < 10 ? '#ff4444' : '#ffaa00';
                    const arcRadius = (s1.radius + s2.radius) / 2;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, arcRadius, arcRadius * PERSPECTIVE_TILT, 0, s1.angle, s2.angle);
                    ctx.strokeStyle = arcColor;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
        }

        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            for (let t = 0; t < sat.trail.length; t++) {
                const p = sat.trail[t];
                const px = cx + Math.cos(p.angle) * p.radius;
                const py = cy + Math.sin(p.angle) * p.radius * PERSPECTIVE_TILT;
                const alpha = (t / sat.trail.length) * 0.4;
                ctx.beginPath();
                ctx.arc(px, py, 1 + (t / sat.trail.length) * 2, 0, Math.PI * 2);
                ctx.fillStyle = sat === game.selectedSatellite ? `rgba(255,255,255,${alpha})` : `rgba(0,255,255,${alpha})`;
                ctx.fill();
            }
        }

        for (let i = 0; i < game.debris.length; i++) {
            const d = game.debris[i];
            const x = cx + Math.cos(d.angle) * d.radius;
            const y = cy + Math.sin(d.angle) * d.radius * PERSPECTIVE_TILT;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(d.angle * 3);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-4, -1, 8, 2);
            ctx.fillRect(-1, -4, 2, 8);
            ctx.restore();
        }

        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius * PERSPECTIVE_TILT;

            let satColor = '#00ffff';
            if (sat.engineType === 'ion') satColor = '#ffaa00'; 
            if (sat.fuel <= 20) satColor = '#ff4444';
            if (sat === game.selectedSatellite) satColor = '#ffffff';

            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = satColor;
            ctx.shadowBlur = sat === game.selectedSatellite ? 15 : 8;
            ctx.shadowColor = satColor;
            ctx.fill();
            ctx.shadowBlur = 0;

            if (sat === game.selectedSatellite) {
                ctx.beginPath();
                ctx.arc(x, y, 10, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }

    let lastTime = performance.now();
    function loop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        update(dt);
        render();
        requestAnimationFrame(loop);
    }

    function handleCanvasClick(event) {
        if (!game.running || game.finished) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        let found = null;
        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius * PERSPECTIVE_TILT;
            if (Math.hypot(clickX - x, clickY - y) < 25) { found = sat; break; }
        }

        if (found) {
            if (game.selectedSatellite === found) clearSelection();
            else {
                game.selectedSatellite = found;
            }
        } else {
            clearSelection();
        }
        updateSelectedInfo();
        updateHint();
    }

    function clearSelection() {
        game.selectedSatellite = null;
        selectedInfo.classList.add('hidden');
    }

    function correctSelected() {
        if (!game.selectedSatellite) return;
        const sat = game.selectedSatellite;
        
        const fuelCost = sat.engineType === 'chem' ? 20 : 2;
        const speedGain = sat.engineType === 'chem' ? 0.2 : 0.02;

        if (sat.fuel < fuelCost) {
            showBanner('Нет топлива!');
            return;
        }
        
        sat.fuel -= fuelCost;
        game.totalDV += fuelCost;
        game.correctionsMade = true;
        sat.speedMultiplier = Math.min(3.0, sat.speedMultiplier + speedGain);
        updateSelectedInfo();
    }

    function finishGame() {
        game.running = false;
        game.finished = true;

        const success = game.collisions === 0 && game.satellites.length === game.totalSatellites;
        let altitudeBonus = 0;
        if (game.satellites.length === game.totalSatellites) {
            const altitudes = game.satellites.map(s => Math.round(s.radius));
            if (new Set(altitudes).size === game.totalSatellites) altitudeBonus = 50;
        }
        const fuelBonus = Math.max(0, 100 - game.totalDV);
        const score = (game.satellites.length * 100) - (game.collisions * 200) + altitudeBonus + fuelBonus;
        const isNewRecord = saveBestScore(score);

        let message = success ? 'Миссия выполнена!' : (game.collisions > 0 ? 'Столкновения!' : 'Не все выведены.');
        
        if (success && game.collisions === 0) unlockAchievement('no_collisions');
        if (success && !game.correctionsMade) unlockAchievement('no_corrections');
        if (game.satellites.length >= 5) unlockAchievement('many_satellites');

        const hasNext = game.currentLevel < CAMPAIGN.length - 1;
        if (success && !hasNext) unlockAchievement('campaign_done');

        resultTitle.textContent = success ? 'УСПЕХ' : 'НЕУДАЧА';
        resultTitle.style.color = success ? '#00ff00' : '#ff4444';
        
        let resultHTML = `${message}<br><br><strong>Балл:</strong> ${score}<br>
            Время: ${game.time.toFixed(1)} с<br>
            Столкновений: ${game.collisions}<br>ΔV: ${game.totalDV}<br>
            Бонус за высоты: ${altitudeBonus}<br>Бонус за экономию: ${fuelBonus}`;
            
        if (isNewRecord) resultHTML += '<br><div class="record-text">🏆 НОВЫЙ РЕКОРД!</div>';
        
        resultText.innerHTML = resultHTML;

        if (success && hasNext) resultNextBtn.classList.remove('hidden');
        else resultNextBtn.classList.add('hidden');

        if (success && hasNext) {
            game.currentLevel++;
            saveProgress();
        }

        resultScreen.classList.remove('hidden');
        startBtn.disabled = true;
        pauseBtn.disabled = true;
        clearSelection();
        updateHint();
    }

    function startGame() {
        if (game.running) return;

        game.running = true;
        game.paused = false;
        game.finished = false;
        game.time = 0;
        game.lastLaunchTime = 0;
        game.impulse = parseInt(impulseSlider.value, 10);
        game.launchInterval = parseInt(intervalSlider.value, 10);
        
        const sliderCount = parseInt(countSlider.value, 10);
        if (sliderCount !== game.totalSatellites) {
             game.totalSatellites = sliderCount;
             initQueue(sliderCount);
        }

        game.satellites = [];
        game.collisions = 0;
        game.totalDV = 0;
        game.debris = [];
        game.debrisSpawned = false;
        game.correctionsMade = false;
        game.selectedQueueIndex = -1;

        resultScreen.classList.add('hidden');
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        dvValue.textContent = '0';
        launchedValue.textContent = '0 / ' + game.totalSatellites;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        pauseBtn.textContent = 'ПАУЗА';
        clearSelection();
        updateHint();
        renderQueue();
        setupPanel.classList.add('hidden');

        lastTime = performance.now();
    }

    function togglePause() {
        if (!game.running || game.finished) return;
        game.paused = !game.paused;
        pauseBtn.textContent = game.paused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА';
        updateHint();
    }

    function resetGame() {
        game.running = false;
        game.paused = false;
        game.finished = false;
        game.time = 0;
        game.satellites = [];
        game.collisions = 0;
        game.totalDV = 0;
        game.debris = [];
        game.debrisSpawned = false;
        game.correctionsMade = false;
        game.selectedQueueIndex = -1;

        resultScreen.classList.add('hidden');
        timeValue.textContent = '0.0';
        launchedValue.textContent = '0 / ' + parseInt(countSlider.value, 10);
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        dvValue.textContent = '0';
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        pauseBtn.textContent = 'ПАУЗА';
        clearSelection();
        updateHint();
        renderQueue();
        setupPanel.classList.add('hidden');
        render();
    }

    function nextMission() {
        resultScreen.classList.add('hidden');
        applyLevel();
        resetGame();
    }

    function resetCampaign() {
        if (!confirm('Начать кампанию с 1-го уровня?')) return;
        game.currentLevel = 0;
        saveProgress();
        applyLevel();
        resetGame();
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => alert("Ошибка fullscreen"));
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }

    impulseSlider.addEventListener('input', function () { impulseValue.textContent = this.value; });
    countSlider.addEventListener('input', function () {
        countValue.textContent = this.value;
        launchedValue.textContent = '0 / ' + this.value;
        game.totalSatellites = parseInt(this.value, 10);
        initQueue(game.totalSatellites); 
    });
    intervalSlider.addEventListener('input', function () { intervalValue.textContent = this.value; });

    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    resetBtn.addEventListener('click', resetGame);
    resultResetBtn.addEventListener('click', resetGame);
    resultNextBtn.addEventListener('click', nextMission);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    menuBtn.addEventListener('click', () => sideMenu.classList.toggle('hidden'));
    closeMenuBtn.addEventListener('click', () => sideMenu.classList.add('hidden'));
    
    achievementsBtn.addEventListener('click', function () {
        renderAchievements();
        achievementsScreen.classList.remove('hidden');
        sideMenu.classList.add('hidden');
    });
    closeAchievementsBtn.addEventListener('click', function () {
        achievementsScreen.classList.add('hidden');
    });
    resetCampaignBtn.addEventListener('click', resetCampaign);
    resetAllBtn.addEventListener('click', resetAllData);

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            handleCanvasClick({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        }
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { impulseSlider.value = Math.min(100, parseInt(impulseSlider.value, 10) + 5); impulseValue.textContent = impulseSlider.value; e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { impulseSlider.value = Math.max(10, parseInt(impulseSlider.value, 10) - 5); impulseValue.textContent = impulseSlider.value; e.preventDefault(); }
        else if (e.key === ' ') { if (!game.running) startGame(); else togglePause(); e.preventDefault(); }
        else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') { resetGame(); e.preventDefault(); }
        else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') { correctSelected(); e.preventDefault(); }
    });

    createStars();
    createClouds();
    loadData();
    applyLevel();
    resizeCanvas();
    requestAnimationFrame(loop);
})();
