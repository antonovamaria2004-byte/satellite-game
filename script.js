(function () {
    'use strict';

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
    const timeValue = document.getElementById('time-value');
    const launchedValue = document.getElementById('launched-value');
    const collisionValue = document.getElementById('collision-value');
    const selectedInfo = document.getElementById('selected-info');
    const selectedValue = document.getElementById('selected-value');
    const resultScreen = document.getElementById('result-screen');
    const resultTitle = document.getElementById('result-title');
    const resultText = document.getElementById('result-text');
    const resultResetBtn = document.getElementById('result-reset-btn');

    // --- Состояние игры ---
    const game = {
        running: false,
        finished: false,
        time: 0,
        flightTimeLimit: 30,
        targetAltitude: 400,
        impulse: 50,
        totalSatellites: 3,
        launchInterval: 4,
        lastLaunchTime: 0,
        satellites: [],
        collisions: 0,
        earthRadius: 60,
        selectedSatellite: null,
        stars: []
    };

    // --- Создание звёзд ---
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

    // --- Настройка размеров canvas ---
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        render();
    }
    window.addEventListener('resize', resizeCanvas);

    // --- Создание спутника ---
    function createSatellite(index) {
        const impulseFactor = game.impulse / 100;
        const startRadius = 40 + impulseFactor * 60;
        const startAngle = (Math.PI * 2 / game.totalSatellites) * index;
        return {
            id: index + 1,
            angle: startAngle,
            radius: startRadius,
            targetRadius: game.earthRadius + game.targetAltitude / 10,
            baseSpeed: 0.8 + impulseFactor * 1.2,
            speedMultiplier: 1.0,
            highlighted: false,
            trail: []
        };
    }

    // --- Обновление логики ---
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

            // Записываем точку в след
            sat.trail.push({ angle: sat.angle, radius: sat.radius });
            if (sat.trail.length > 40) {
                sat.trail.shift();
            }
        }

        checkCollisions();
        updateSelectedInfo();

        timeValue.textContent = game.time.toFixed(1);

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
            'SAT-' + sat.id + ' | Высота: ' + altitudeKm + ' км | Скорость: ' + speedPercent + '%';
        selectedInfo.classList.remove('hidden');
    }

    // --- Проверка столкновений ---
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

    // --- Отрисовка ---
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

        // Земля
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1a4d80';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Свечение атмосферы
        const grad = ctx.createRadialGradient(cx, cy, game.earthRadius, cx, cy, game.earthRadius + 40);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius + 40, 0, Math.PI * 2);
        ctx.fill();

        // Целевая орбита (пунктир)
        if (game.running && game.satellites.length > 0) {
            const targetR = game.satellites[0].targetRadius;
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.arc(cx, cy, targetR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- Угловое расстояние между соседними спутниками ---
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

                ctx.beginPath();
                ctx.arc(cx, cy, arcRadius, s1.angle, s2.angle);
                ctx.strokeStyle = arcColor;
                ctx.lineWidth = 2;
                ctx.stroke();

                let midAngle = (s1.angle + s2.angle) / 2;
                if (Math.abs(s1.angle - s2.angle) > Math.PI) {
                    midAngle = (s1.angle + s2.angle) / 2 + Math.PI;
                }
                const tx = cx + Math.cos(midAngle) * arcRadius;
                const ty = cy + Math.sin(midAngle) * arcRadius;

                ctx.fillStyle = arcColor;
                ctx.font = 'bold 11px Courier New';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(diffDeg.toFixed(0) + '°', tx, ty);

                ctx.textAlign = 'start';
                ctx.textBaseline = 'alphabetic';
            }
        }

        // --- Следы спутников ---
        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            for (let t = 0; t < sat.trail.length; t++) {
                const point = sat.trail[t];
                const px = cx + Math.cos(point.angle) * point.radius;
                const py = cy + Math.sin(point.angle) * point.radius;
                const alpha = (t / sat.trail.length) * 0.5;
                const size = 1 + (t / sat.trail.length) * 3;

                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fillStyle = sat === game.selectedSatellite
                    ? 'rgba(255, 255, 255, ' + alpha + ')'
                    : 'rgba(0, 255, 255, ' + alpha + ')';
                ctx.fill();
            }
        }

        // --- Спутники ---
        for (let i = 0; i < game.satellites.length; i++) {
            const sat = game.satellites[i];
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius;

            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = sat === game.selectedSatellite ? '#ffffff' : '#00ffff';
            ctx.shadowBlur = sat === game.selectedSatellite ? 25 : 15;
            ctx.shadowColor = sat === game.selectedSatellite ? '#ffffff' : '#00ffff';
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

    // --- Игровой цикл ---
    let lastTime = performance.now();
    function loop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        update(dt);
        render();

        requestAnimationFrame(loop);
    }

    // --- Клик по canvas ---
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
            const y = cy + Math.sin(sat.angle) * sat.radius;
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

    // --- Очистка выбора ---
    function clearSelection() {
        game.selectedSatellite = null;
        correctBtn.disabled = true;
        selectedInfo.classList.add('hidden');
    }

    // --- Коррекция скорости ---
    function correctSelected() {
        if (!game.selectedSatellite) return;
        game.selectedSatellite.speedMultiplier = Math.min(
            2.0,
            game.selectedSatellite.speedMultiplier + 0.1
        );
        updateSelectedInfo();
    }

    // --- Завершение игры ---
    function finishGame() {
        game.running = false;
        game.finished = true;

        const success = game.collisions === 0 && game.satellites.length === game.totalSatellites;
        const score = (game.satellites.length * 100) - (game.collisions * 200);

        let message = '';
        if (success) {
            message = 'Все ' + game.totalSatellites + ' спутников успешно выведены на орбиту без столкновений!';
        } else if (game.collisions > 0) {
            message = 'Зафиксировано столкновений: ' + game.collisions + '. Требуется корректировка интервалов.';
        } else {
            message = 'Не все спутники выведены. Увеличьте время полёта или уменьшите интервал.';
        }

        resultTitle.textContent = success ? 'УСПЕХ' : 'НЕУДАЧА';
        resultTitle.style.color = success ? '#00ff00' : '#ff4444';
        resultText.innerHTML =
            message + '<br><br>' +
            '<strong>Итоговый балл:</strong> ' + score + '<br>' +
            'Время миссии: ' + game.time.toFixed(1) + ' с<br>' +
            'Запущено спутников: ' + game.satellites.length + ' / ' + game.totalSatellites + '<br>' +
            'Столкновений: ' + game.collisions;

        resultScreen.classList.remove('hidden');
        startBtn.disabled = true;
        clearSelection();
    }

    // --- Запуск миссии ---
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

        resultScreen.classList.add('hidden');
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        launchedValue.textContent = '0 / ' + game.totalSatellites;
        startBtn.disabled = true;
        clearSelection();

        lastTime = performance.now();
    }

    // --- Сброс ---
    function resetGame() {
        game.running = false;
        game.finished = false;
        game.time = 0;
        game.lastLaunchTime = 0;
        game.satellites = [];
        game.collisions = 0;

        resultScreen.classList.add('hidden');
        timeValue.textContent = '0.0';
        launchedValue.textContent = '0 / ' + parseInt(countSlider.value, 10);
        collisionValue.textContent = '0';
        collisionValue.style.color = '#00ffff';
        startBtn.disabled = false;
        clearSelection();

        render();
    }

    // --- Обработчики UI ---
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
    resultResetBtn.addEventListener('click', resetGame);

    // --- Клик и тап по canvas ---
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handleCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }, { passive: true });

    // --- Управление с клавиатуры ---
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
    resizeCanvas();
    requestAnimationFrame(loop);
})();
