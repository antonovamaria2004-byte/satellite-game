(function () {
    'use strict';

    // ============================================================
    // КАМПАНИЯ: список миссий
    // ============================================================
    const CAMPAIGN = [
        { count: 2, interval: 5, altitude: 300, title: 'Запустить 2 спутника' },
        { count: 3, interval: 4, altitude: 400, title: 'Запустить 3 спутника' },
        { count: 4, interval: 3, altitude: 450, title: 'Запустить 4 спутника' },
        { count: 5, interval: 2, altitude: 500, title: 'Запустить 5 спутников' },
        { count: 6, interval: 2, altitude: 550, title: 'Запустить 6 спутников' }
    ];

    // Параметры псевдо-3D
    const PERSPECTIVE_TILT = 0.45; // насколько сжимаем вертикаль (0 = плоско, 1 = сильно)
    const SHADOW_OFFSET_X = 3;
    const SHADOW_OFFSET_Y = 4;

    // --- Получение элементов DOM ---
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
    const correctBtn = document.getElementById('correct-btn');
    const resetBtn = document.getElementById('reset-btn');
    const resetCampaignBtn = document.getElementById('reset-campaign-btn');
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

    // --- Состояние игры ---
    const game = {
        running: false,
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
        currentLevel: 0
    };

    const DV_PER_CORRECTION = 10;

    // ============================================================
    // СОХРАНЕНИЕ ПРОГРЕССА
    // ============================================================
    function loadProgress() {
        try {
            const saved = localStorage.getItem('satellite_campaign_level');
            if (saved !== null) {
                const level = parseInt(saved, 10);
                if (level >= 0 && level < CAMPAIGN.length) {
                    game.currentLevel = level;
                }
            }
        } catch (e) {
            game.currentLevel = 0;
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem('satellite_campaign_level', game.currentLevel);
        } catch (e) {
        }
    }

    // ============================================================
    // ПРИМЕНЕНИЕ УРОВНЯ
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

        missionInfo.textContent =
            'Миссия ' + (game.currentLevel + 1) + ' / ' + CAMPAIGN.length +
            ' — ' + level.title;

        launchedValue.textContent = '0 / ' + level.count;
    }

    // ============================================================
    // ЗВЁЗДЫ
    // ============================================================
    function createStars() {
        const count = 150;
        game.stars = [];
        for (let i = 0; i < count; i++) {
            game.stars.push({
                x: Math.random(),
                y: Math.random(),
                radius: Math.random() * 1.5 + 0.3,
                phase: Math.random() * Math.PI * 2,
                speed: Math.random() * 2 + 1
            });
        }
    }

    // --- Размеры canvas ---
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        render();
    }
    window.addEventListener('resize', resizeCanvas);

    // ============================================================
    // ПСЕВДО-3D: преобразование координат
    // ============================================================
    // Превращаем обычные (x, y) на плоскости в «наклонённые» (screenX, screenY)
    function toScreen(x, y, cx, cy) {
        return {
            sx: cx + x,
            sy: cy + y * PERSPECTIVE_TILT
        };
    }

    // Отрисовка эллипса (орбиты) с наклоном
    function drawTiltedCircle(cx, cy, radius, strokeStyle, lineWidth, dashed) {
        ctx.beginPath();
        if (dashed) ctx.setLineDash([5, 5]);
        // ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle)
        ctx.ellipse(cx, cy, radius, radius * PERSPECTIVE_TILT, 0, 0, Math.PI * 2);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        if (dashed) ctx.setLineDash([]);
    }

    // --- Создание спутника ---
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
            highlighted: false,
            trail: []
        };
    }

    // --- Логика ---
    function update(dt) {
        if (!game.running || game.finished) return;

        game.time += dt;

        if (game.satellites.length < game.totalSatellites &&
            game.time - game.lastLaunchTime >= game.launchInterval) {
            const newSat = createSatellite(game.satellites.length);
            game.satellites.push(newSat);
            game.lastLaunchTime = game.time;
            launchedValue.textContent = game.satellites.length + ' / ' + game.totalSatellites;
        }

        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            const speed = sat.baseSpeed * sat.speedMultiplier;
            sat.angle += speed * dt;
            if (sat.angle > Math.PI * 2) sat.angle -= Math.PI * 2;

            const diff = sat.targetRadius - sat.radius;
            sat.radius += diff * 0.5 * dt;

            sat.trail.push({ angle: sat.angle, radius: sat.radius });
            if (sat.trail.length > 40) {
                sat.trail.shift();
            }
        }

        checkCollisions();
        updateSelectedInfo();

        timeValue.textContent = game.time.toFixed(1);
        dvValue.textContent = game.totalDV;

        if (game.satellites.length >= game.totalSatellites && game.time >= game.flightTimeLimit) {
            finishGame();
        }
    }

    // --- Информация о выбранном спутнике ---
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

    // --- Столкновения ---
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
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);

        // --- Звёздный фон ---
        const timeSec = performance.now() / 1000;
        for (let i = 0; i < game.stars.length; i++) {
            const star = game.stars[i];
            const sx = star.x * w;
            const sy = star.y * h;
            const twinkle = 0.5 + 0.5 * Math.sin(timeSec * star.speed + star.phase);
            ctx.globalAlpha = 0.3 + twinkle * 0.7;
            ctx.beginPath();
            ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // --- Тень Земли (под шаром) ---
        ctx.beginPath();
        ctx.ellipse(
            cx + SHADOW_OFFSET_X,
            cy + game.earthRadius * PERSPECTIVE_TILT + SHADOW_OFFSET_Y,
            game.earthRadius * 0.95,
            game.earthRadius * PERSPECTIVE_TILT * 0.6,
            0, 0, Math.PI * 2
        );
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // --- Земля: объёмный шар ---
        // Основной градиент (от светлого к тёмному — имитация сферы)
        const earthGrad = ctx.createRadialGradient(
            cx - game.earthRadius * 0.4,
            cy - game.earthRadius * 0.4,
            game.earthRadius * 0.1,
            cx,
            cy,
            game.earthRadius
        );
        earthGrad.addColorStop(0, '#4db8ff');   // блик
        earthGrad.addColorStop(0.4, '#1a6fb0'); // светлая часть
        earthGrad.addColorStop(1, '#06243d');   // тёмная сторона

        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = earthGrad;
        ctx.fill();

        // Контур
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Блик (маленькое светлое пятно в верхнем левом углу)
        const highlightGrad = ctx.createRadialGradient(
            cx - game.earthRadius * 0.45,
            cy - game.earthRadius * 0.45,
            0,
            cx - game.earthRadius * 0.45,
            cy - game.earthRadius * 0.45,
            game.earthRadius * 0.4
        );
        highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx - game.earthRadius * 0.45, cy - game.earthRadius * 0.45, game.earthRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = highlightGrad;
        ctx.fill();

        // Атмосферный ореол
        const haloGrad = ctx.createRadialGradient(cx, cy, game.earthRadius, cx, cy, game.earthRadius + 40);
        haloGrad.addColorStop(0, 'rgba(0, 255, 255, 0.2)');
        haloGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius + 40, 0, Math.PI * 2);
        ctx.fillStyle = haloGrad;
        ctx.fill();

        // --- Целевые орбиты (эллипсы) ---
        if (game.running && game.satellites.length > 0) {
            for (let i = 0; i < game.satellites.length; i++) {
                const targetR = game.satellites[i].targetRadius;
                drawTiltedCircle(cx, cy, targetR, 'rgba(0, 255, 255, 0.25)', 1, true);
            }
        }

        // --- Угловое расстояние (по эллипсу) ---
        if (game.satellites.length >= 2) {
            for (let i = 0; i < game.satellites.length; i++) {
                const s1 = game.satellites[i];
                const s2 = game.satellites[(i + 1) % game.satellites.length];

                let angleDiff = Math.abs(s1.angle - s2.angle);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

                const diffDeg = angleDiff * 180 / Math.PI;

                let arcColor = '#00ff00';
                if (diffDeg < 10) {
                    arcColor = '#ff4444';
                } else if (diffDeg < 30) {
                    arcColor = '#ffaa00';
                }

                const arcRadius = (s1.radius + s2.radius) / 2;

                // Рисуем дугу как эллипс
                ctx.beginPath();
                ctx.ellipse(cx, cy, arcRadius, arcRadius * PERSPECTIVE_TILT, 0, s1.angle, s2.angle);
                ctx.strokeStyle = arcColor;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Подпись
                let midAngle = (s1.angle + s2.angle) / 2;
                if (Math.abs(s1.angle - s2.angle) > Math.PI) {
                    midAngle = (s1.angle + s2.angle) / 2 + Math.PI;
                }

                // Позиция подписи на эллипсе
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

        // --- Следы (сужающиеся к дальнему краю) ---
        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            for (let t = 0; t < sat.trail.length; t++) {
                const point = sat.trail[t];
                const px = cx + Math.cos(point.angle) * point.radius;
                const py = cy + Math.sin(point.angle) * point.radius * PERSPECTIVE_TILT;
                const alpha = (t / sat.trail.length) * 0.5;
                const size = (1 + (t / sat.trail.length) * 3) * (1 + Math.sin(point.angle) * 0.3);

                ctx.beginPath();
                ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
                ctx.fillStyle = sat === game.selectedSatellite
                    ? 'rgba(255, 255, 255, ' + alpha + ')'
                    : 'rgba(0, 255, 255, ' + alpha + ')';
                ctx.fill();
            }
        }

        // --- Спутники с тенями и объёмом ---
        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];

            // Позиция спутника на эллипсе
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius * PERSPECTIVE_TILT;

            // Тень (овал под спутником)
            ctx.beginPath();
            ctx.ellipse(x + 2, y + 4, 7, 4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fill();

            // Цвет спутника
            let satColor = '#00ffff';
            if (sat.fuel <= 20) satColor = '#ffaa00';
            if (sat.fuel <= 0) satColor = '#ff4444';
            if (sat === game.selectedSatellite) satColor = '#ffffff';

            // Тень свечения
            ctx.shadowBlur = sat === game.selectedSatellite ? 25 : 15;
            ctx.shadowColor = satColor;

            // Основной круг спутника (объём через радиальный градиент)
            const satGrad = ctx.createRadialGradient(
                x - 3, y - 3, 1,
                x, y, 8
            );
            satGrad.addColorStop(0, '#ffffff');
            satGrad.addColorStop(0.5, satColor);
            satGrad.addColorStop(1, satColor);

            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = satGrad;
            ctx.fill();

            ctx.shadowBlur = 0;

            // Кольцо вокруг выбранного
            if (sat === game.selectedSatellite) {
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Подпись
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Courier New';
            ctx.fillText('SAT-' + sat.id, x + 10, y + 4);
        }
    }

    // --- Игровой цикл ---
    let lastTime = performance.now();
    function loop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        update(dt);
        render();

        requestAnimationFrame(loop);
    }

    // --- Клик по canvas (с учётом эллипса) ---
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
            if (dist < 20) {
                found = sat;
                break;
            }
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

    // --- Коррекция ---
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
        sat.speedMultiplier = Math.min(2.0, sat.speedMultiplier + 0.1);

        updateSelectedInfo();
    }

    // --- Завершение игры ---
    function finishGame() {
        game.running = false;
        game.finished = true;

        const success = game.collisions === 0 && game.satellites.length === game.totalSatellites;

        let altitudeBonus = 0;
        if (game.satellites.length === game.totalSatellites) {
            const altitudes = game.satellites.map(s => Math.round(s.radius));
            const uniqueAltitudes = new Set(altitudes).size;
            if (uniqueAltitudes === game.totalSatellites) {
                altitudeBonus = 50;
            }
        }

        const fuelBonus = Math.max(0, 100 - game.totalDV);

        const score = (game.satellites.length * 100)
                    - (game.collisions * 200)
                    + altitudeBonus
                    + fuelBonus;

        let message = '';
        if (success && altitudeBonus > 0) {
            message = 'Все спутники выведены на разные орбиты без столкновений!';
        } else if (success) {
            message = 'Все спутники успешно выведены на орбиту без столкновений!';
        } else if (game.collisions > 0) {
            message = 'Зафиксировано столкновений: ' + game.collisions + '.';
        } else {
            message = 'Не все спутники выведены.';
        }

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

        const hasNext = game.currentLevel < CAMPAIGN.length - 1;
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
        clearSelection();
    }

    // --- Старт миссии ---
    function startGame() {
        if (game.running) return;

        game.running = true;
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

        resultScreen.classList.add('hidden');
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        dvValue.textContent = '0';
        launchedValue.textContent = '0 / ' + game.totalSatellites;
        startBtn.disabled = true;
        clearSelection();

        lastTime = performance.now();
    }

    // --- Сброс миссии ---
    function resetGame() {
        game.running = false;
        game.finished = false;
        game.time = 0;
        game.lastLaunchTime = 0;
        game.satellites = [];
        game.collisions = 0;
        game.totalDV = 0;

        resultScreen.classList.add('hidden');
        timeValue.textContent = '0.0';
        launchedValue.textContent = '0 / ' + parseInt(countSlider.value, 10);
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        dvValue.textContent = '0';
        startBtn.disabled = false;
        clearSelection();

        render();
    }

    // --- Следующая миссия ---
    function nextMission() {
        resultScreen.classList.add('hidden');
        applyLevel();
        resetGame();
    }

    // --- Сброс кампании ---
    function resetCampaign() {
        if (!confirm('Начать кампанию с первого уровня?')) return;
        game.currentLevel = 0;
        saveProgress();
        applyLevel();
        resetGame();
    }

    // --- Обработчики ---
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
    correctBtn.addEventListener('click', correctSelected);
    resetBtn.addEventListener('click', resetGame);
    resetCampaignBtn.addEventListener('click', resetCampaign);
    resultResetBtn.addEventListener('click', resetGame);
    resultNextBtn.addEventListener('click', nextMission);

    // --- Клик и тап ---
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handleCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }, { passive: true });

    // --- Клавиатура ---
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
        } else if (e.key === ' ' || e.key === 'Enter') {
            if (!game.running) startGame();
            e.preventDefault();
        } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
            resetGame();
            e.preventDefault();
        } else if (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
            correctSelected();
            e.preventDefault();
        }
    });

    // --- Инициализация ---
    createStars();
    loadProgress();
    applyLevel();
    resizeCanvas();
    requestAnimationFrame(loop);
})();
