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

    // Список достижений
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
    const DEBRIS_SPAWN_CHANCE = 0.008; // шанс появления мусора за кадр

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
    const resetCampaignBtn = document.getElementById('reset-campaign-btn');
    const achievementsBtn = document.getElementById('achievements-btn');
    const closeAchievementsBtn = document.getElementById('close-achievements-btn');
    const achievementsScreen = document.getElementById('achievements-screen');
    const achievementsList = document.getElementById('achievements-list');
    const eventBanner = document.getElementById('event-banner');
    const eventText = document.getElementById('event-text');
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
        earthRadius: 60,
        selectedSatellite: null,
        stars: [],
        totalDV: 0,
        currentLevel: 0,
        debris: [],
        debrisSpawned: false,
        unlockedAchievements: {},
        correctionsMade: false
    };

    // ============================================================
    // ДОСТИЖЕНИЯ
    // ============================================================
    function loadAchievements() {
        try {
            const saved = localStorage.getItem('satellite_achievements');
            if (saved) {
                game.unlockedAchievements = JSON.parse(saved);
            }
        } catch (e) {
            game.unlockedAchievements = {};
        }
    }

    function saveAchievements() {
        try {
            localStorage.setItem('satellite_achievements', JSON.stringify(game.unlockedAchievements));
        } catch (e) {}
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

    // ============================================================
    // БАННЕР СОБЫТИЙ
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
    // ПРОГРЕСС КАМПАНИИ
    // ============================================================
    function loadProgress() {
        try {
            const saved = localStorage.getItem('satellite_campaign_level');
            if (saved !== null) {
                const level = parseInt(saved, 10);
                if (level >= 0 && level < CAMPAIGN.length) game.currentLevel = level;
            }
        } catch (e) { game.currentLevel = 0; }
    }

    function saveProgress() {
        try { localStorage.setItem('satellite_campaign_level', game.currentLevel); }
        catch (e) {}
    }

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

        missionInfo.textContent =
            'Миссия ' + (game.currentLevel + 1) + ' / ' + CAMPAIGN.length + ' — ' + level.title;
        launchedValue.textContent = '0 / ' + level.count;
    }

    // ============================================================
    // ЗВЁЗДЫ
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
            fuel: 100,
            spentDV: 0,
            trail: []
        };
    }

    // ============================================================
    // КОСМИЧЕСКИЙ МУСОР
    // ============================================================
    function spawnDebris() {
        const angle = Math.random() * Math.PI * 2;
        const radius = 150 + Math.random() * 200;
        game.debris.push({
            angle: angle,
            radius: radius,
            speed: 0.4 + Math.random() * 0.6,
            life: 15 // живёт 15 секунд
        });
        game.debrisSpawned = true;
        showBanner('⚠ Внимание! Космический мусор!');
    }

    function updateDebris(dt) {
        // Удаляем старый мусор
        for (let i = game.debris.length - 1; i >= 0; i--) {
            const d = game.debris[i];
            d.life -= dt;
            d.angle += d.speed * dt;
            if (d.angle > Math.PI * 2) d.angle -= Math.PI * 2;
            if (d.life <= 0) {
                game.debris.splice(i, 1);
                // Игрок пережил мусор — даём ачивку
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

        if (game.satellites.length < game.totalSatellites &&
            game.time - game.lastLaunchTime >= game.launchInterval) {
            const newSat = createSatellite(game.satellites.length);
            game.satellites.push(newSat);
            game.lastLaunchTime = game.time;
            launchedValue.textContent = game.satellites.length + ' / ' + game.totalSatellites;
            if (game.satellites.length === 1) unlockAchievement('first_launch');
        }

        // Шанс появления мусора
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
        selectedValue.textContent =
            'SAT-' + sat.id +
            ' | Высота: ' + altitudeKm + ' км' +
            ' | Скорость: ' + speedPercent + '%' +
            ' | Топливо: ' + sat.fuel + ' ед.' +
            ' | ΔV: ' + sat.spentDV;
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
    // ОТРИСОВКА (псевдо-3D)
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
        const earthGrad = ctx.createRadialGradient(
            cx - game.earthRadius * 0.4, cy - game.earthRadius * 0.4, game.earthRadius * 0.1,
            cx, cy, game.earthRadius
        );
        earthGrad.addColorStop(0, '#4db8ff');
        earthGrad.addColorStop(0.4, '#1a6fb0');
        earthGrad.addColorStop(1, '#06243d');
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = earthGrad;
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const highlightGrad = ctx.createRadialGradient(
            cx - game.earthRadius * 0.45, cy - game.earthRadius * 0.45, 0,
            cx - game.earthRadius * 0.45, cy - game.earthRadius * 0.45, game.earthRadius * 0.4
        );
        highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx - game.earthRadius * 0.45, cy - game.earthRadius * 0.45, game.earthRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = highlightGrad;
        ctx.fill();

        const haloGrad = ctx.createRadialGradient(cx, cy, game.earthRadius, cx, cy, game.earthRadius + 40);
        haloGrad.addColorStop(0, 'rgba(0, 255, 255, 0.2)');
        haloGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius + 40, 0, Math.PI * 2);
        ctx.fillStyle = haloGrad;
        ctx.fill();

        // Целевые орбиты
        if (game.running && game.satellites.length > 0) {
            for (let i = 0; i < game.satellites.length; i++) {
                const targetR = game.satellites[i].targetRadius;
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.ellipse(cx, cy, targetR, targetR * PERSPECTIVE_TILT, 0, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Дуги углов
        if (game.satellites.length >= 2) {
            for (let i = 0; i < game.satellites.length; i++) {
                const s1 = game.satellites[i];
                const s2 = game.satellites[(i + 1) % game.satellites.length];
                let angleDiff = Math.abs(s1.angle - s2.angle);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                const diffDeg = angleDiff * 180 / Math.PI;
                let arcColor = '#00ff00';
                if (diffDeg < 10) arcColor = '#ff4444';
                else if (diffDeg < 30) arcColor = '#ffaa00';

                const arcRadius = (s1.radius + s2.radius) / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, arcRadius, arcRadius * PERSPECTIVE_TILT, 0, s1.angle, s2.angle);
                ctx.strokeStyle = arcColor;
                ctx.lineWidth = 2;
                ctx.stroke();

                let midAngle = (s1.angle + s2.angle) / 2;
                if (Math.abs(s1.angle - s2.angle) > Math.PI) midAngle = (s1.angle + s2.angle) / 2 + Math.PI;
                const tx = cx + Math.cos(midAngle) * arcRadius;
                const ty = cy + Math.sin(midAngle) * arcRadius * PERSPECTIVE_TILT;

                ctx.fillStyle = arcColor;
                ctx.font = 'bold 11px Courier New';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(diffDeg.toFixed(0) + '°', tx, ty);
                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
            }
        }

        // Следы
        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            for (let t = 0; t < sat.trail.length; t++) {
                const p = sat.trail[t];
                const px = cx + Math.cos(p.angle) * p.radius;
                const py = cy + Math.sin(p.angle) * p.radius * PERSPECTIVE_TILT;
                const alpha = (t / sat.trail.length) * 0.5;
                const size = (1 + (t / sat.trail.length) * 3) * (1 + Math.sin(p.angle) * 0.3);
                ctx.beginPath();
                ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
                ctx.fillStyle = sat === game.selectedSatellite
                    ? 'rgba(255, 255, 255, ' + alpha + ')'
                    : 'rgba(0, 255, 255, ' + alpha + ')';
                ctx.fill();
            }
        }

        // Космический мусор
        for (let i = 0; i < game.debris.length; i++) {
            const d = game.debris[i];
            const x = cx + Math.cos(d.angle) * d.radius;
            const y = cy + Math.sin(d.angle) * d.radius * PERSPECTIVE_TILT;
            // Вращающийся крестик
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(d.angle * 3);
            ctx.fillStyle = '#ff4444';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff0000';
            ctx.fillRect(-6, -2, 12, 4);
            ctx.fillRect(-2, -6, 4, 12);
            ctx.restore();
            ctx.shadowBlur = 0;
        }

        // Спутники
        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius * PERSPECTIVE_TILT;

            // Тень
            ctx.beginPath();
            ctx.ellipse(x + 2, y + 4, 7, 4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fill();

            let satColor = '#00ffff';
            if (sat.fuel <= 20) satColor = '#ffaa00';
            if (sat.fuel <= 0) satColor = '#ff4444';
            if (sat === game.selectedSatellite) satColor = '#ffffff';

            const satGrad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 8);
            satGrad.addColorStop(0, '#ffffff');
            satGrad.addColorStop(0.5, satColor);
            satGrad.addColorStop(1, satColor);

            ctx.shadowBlur = sat === game.selectedSatellite ? 25 : 15;
            ctx.shadowColor = satColor;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = satGrad;
            ctx.fill();
            ctx.shadowBlur = 0;

            if (sat === game.selectedSatellite) {
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Courier New';
            ctx.fillText('SAT-' + sat.id, x + 10, y + 4);
        }
    }

    // ============================================================
    // ИГРОВОЙ ЦИКЛ
    // ============================================================
    let lastTime = performance.now();
    function loop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        update(dt);
        render();
        requestAnimationFrame(loop);
    }

    // ============================================================
    // КЛИК
    // ============================================================
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
            const dist = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
            if (dist < 20) { found = sat; break; }
        }

        if (found) {
            if (game.selectedSatellite === found) {
                clearSelection();
            } else {
                game.selectedSatellite = found;
                correctBtn.disabled = false;
            }
        } else {
            clearSelection();
        }
        updateSelectedInfo();
    }

    function clearSelection() {
        game.selectedSatellite = null;
        correctBtn.disabled = true;
        selectedInfo.classList.add('hidden');
    }

    // ============================================================
    // КОРРЕКЦИЯ
    // ============================================================
    function correctSelected() {
        if (!game.selectedSatellite) return;
        const sat = game.selectedSatellite;
        if (sat.fuel < DV_PER_CORRECTION) {
            selectedValue.textContent = 'SAT-' + sat.id + ' | ТОПЛИВО ИСЧЕРПАНО!';
            return;
        }
        sat.fuel -= DV_PER_CORRECTION;
        sat.spentDV += DV_PER_CORRECTION;
        game.totalDV += DV_PER_CORRECTION;
        game.correctionsMade = true;
        sat.speedMultiplier = Math.min(2.0, sat.speedMultiplier + 0.1);
        updateSelectedInfo();
    }

    // ============================================================
    // ЗАВЕРШЕНИЕ
    // ============================================================
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

        let message = '';
        if (success && altitudeBonus > 0) message = 'Все спутники на разных орбитах без столкновений!';
        else if (success) message = 'Все спутники успешно выведены без столкновений!';
        else if (game.collisions > 0) message = 'Столкновений: ' + game.collisions;
        else message = 'Не все спутники выведены.';

        // Достижения
        if (success && game.collisions === 0) unlockAchievement('no_collisions');
        if (success && !game.correctionsMade) unlockAchievement('no_corrections');
        if (game.satellites.length >= 5) unlockAchievement('many_satellites');

        const hasNext = game.currentLevel < CAMPAIGN.length - 1;
        if (success && !hasNext) unlockAchievement('campaign_done');

        resultTitle.textContent = success ? 'УСПЕХ' : 'НЕУДАЧА';
        resultTitle.style.color = success ? '#00ff00' : '#ff4444';
        resultText.innerHTML =
            message + '<br><br>' +
            '<strong>Итоговый балл:</strong> ' + score + '<br>' +
            'Время миссии: ' + game.time.toFixed(1) + ' с<br>' +
            'Запущено: ' + game.satellites.length + ' / ' + game.totalSatellites + '<br>' +
            'Столкновений: ' + game.collisions + '<br>' +
            'Суммарный ΔV: ' + game.totalDV + '<br>' +
            'Бонус за высоты: ' + altitudeBonus + '<br>' +
            'Бонус за экономию: ' + fuelBonus;

        if (success && hasNext) {
            resultNextBtn.classList.remove('hidden');
        } else {
            resultNextBtn.classList.add('hidden');
        }

        if (success && hasNext) {
            game.currentLevel++;
            saveProgress();
        }

        resultScreen.classList.remove('hidden');
        startBtn.disabled = true;
        pauseBtn.disabled = true;
        clearSelection();
    }

    // ============================================================
    // СТАРТ / СБРОС
    // ============================================================
    function startGame() {
        if (game.running) return;

        game.running = true;
        game.paused = false;
        game.finished = false;
        game.time = 0;
        game.lastLaunchTime = 0;
        game.targetAltitude = parseInt(altitudeSlider.value, 10);
        game.impulse = parseInt(impulseSlider.value, 10);
        game.totalSatellites = parseInt(countSlider.value, 10);
        game.launchInterval = parseInt(intervalSlider.value, 10);
        game.satellites = [];
        game.collisions = 0;
        game.totalDV = 0;
        game.debris = [];
        game.debrisSpawned = false;
        game.correctionsMade = false;

        resultScreen.classList.add('hidden');
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        dvValue.textContent = '0';
        launchedValue.textContent = '0 / ' + game.totalSatellites;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        pauseBtn.textContent = 'Пауза';
        clearSelection();

        lastTime = performance.now();
    }

    function togglePause() {
        if (!game.running || game.finished) return;
        game.paused = !game.paused;
        pauseBtn.textContent = game.paused ? 'Продолжить' : 'Пауза';
    }

    function resetGame() {
        game.running = false;
        game.paused = false;
        game.finished = false;
        game.time = 0;
        game.lastLaunchTime = 0;
        game.satellites = [];
        game.collisions = 0;
        game.totalDV = 0;
        game.debris = [];
        game.debrisSpawned = false;
        game.correctionsMade = false;

        resultScreen.classList.add('hidden');
        timeValue.textContent = '0.0';
        launchedValue.textContent = '0 / ' + parseInt(countSlider.value, 10);
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        dvValue.textContent = '0';
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        pauseBtn.textContent = 'Пауза';
        clearSelection();
        render();
    }

    function nextMission() {
        resultScreen.classList.add('hidden');
        applyLevel();
        resetGame();
    }

    function resetCampaign() {
        if (!confirm('Начать кампанию с первого уровня?')) return;
        game.currentLevel = 0;
        saveProgress();
        applyLevel();
        resetGame();
    }

    // ============================================================
    // ОБРАБОТЧИКИ
    // ============================================================
    altitudeSlider.addEventListener('input', function () {
        altitudeValue.textContent = this.value;
    });
    impulseSlider.addEventListener('input', function () {
        impulseValue.textContent = this.value;
    });
    countSlider.addEventListener('input', function () {
        countValue.textContent = this.value;
        launchedValue.textContent = '0 / ' + this.value;
    });
    intervalSlider.addEventListener('input', function () {
        intervalValue.textContent = this.value;
    });

    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', togglePause);
    correctBtn.addEventListener('click', correctSelected);
    resetBtn.addEventListener('click', resetGame);
    resetCampaignBtn.addEventListener('click', resetCampaign);
    resultResetBtn.addEventListener('click', resetGame);
    resultNextBtn.addEventListener('click', nextMission);
    achievementsBtn.addEventListener('click', function () {
        renderAchievements();
        achievementsScreen.classList.remove('hidden');
    });
    closeAchievementsBtn.addEventListener('click', function () {
        achievementsScreen.classList.add('hidden');
    });

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handleCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }, { passive: true });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') {
            altitudeSlider.value = Math.min(800, parseInt(altitudeSlider.value, 10) + 10);
            altitudeValue.textContent = altitudeSlider.value;
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            altitudeSlider.value = Math.max(200, parseInt(altitudeSlider.value, 10) - 10);
            altitudeValue.textContent = altitudeSlider.value;
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            impulseSlider.value = Math.min(100, parseInt(impulseSlider.value, 10) + 5);
            impulseValue.textContent = impulseSlider.value;
            e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
            impulseSlider.value = Math.max(10, parseInt(impulseSlider.value, 10) - 5);
            impulseValue.textContent = impulseSlider.value;
            e.preventDefault();
        } else if (e.key === ' ') {
            if (!game.running) startGame();
            else togglePause();
            e.preventDefault();
        } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
            resetGame();
            e.preventDefault();
        } else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
            correctSelected();
            e.preventDefault();
        }
    });

    // ============================================================
    // СТАРТ
    // ============================================================
    createStars();
    loadProgress();
    loadAchievements();
    applyLevel();
    resizeCanvas();
    requestAnimationFrame(loop);
})();
