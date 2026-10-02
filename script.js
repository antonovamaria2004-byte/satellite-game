(function () {
    'use strict';


    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const altitudeSlider = document.getElementById('altitude');
    const altitudeValue = document.getElementById('altitude-value');
    const impulseSlider = document.getElementById('impulse');
    const impulseValue = document.getElementById('impulse-value');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const timeValue = document.getElementById('time-value');
    const statusValue = document.getElementById('status-value');
    const resultScreen = document.getElementById('result-screen');
    const resultTitle = document.getElementById('result-title');
    const resultText = document.getElementById('result-text');
    const resultResetBtn = document.getElementById('result-reset-btn');


    const game = {
        running: false,
        finished: false,
        time: 0,
        flightTimeLimit: 10,   
        targetAltitude: 400,   
        impulse: 50,           
        satellite: null,
        earthRadius: 60        
    };


    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        render();
    }
    window.addEventListener('resize', resizeCanvas);


    function createSatellite() {
        const impulseFactor = game.impulse / 100;
        // Чем выше импульс — тем ближе к целевой орбите (упрощённо)
        const startRadius = 40 + impulseFactor * 60;
        return {
            angle: 0,
            radius: startRadius,
            targetRadius: game.earthRadius + game.targetAltitude / 10,
            speed: 0.8 + impulseFactor * 1.2
        };
    }

    function update(dt) {
        if (!game.running || game.finished || !game.satellite) return;

        game.time += dt;

        const sat = game.satellite;
        sat.angle += sat.speed * dt;
        if (sat.angle > Math.PI * 2) sat.angle -= Math.PI * 2;


        const diff = sat.targetRadius - sat.radius;
        sat.radius += diff * 0.5 * dt;


        timeValue.textContent = game.time.toFixed(1);

   
        if (game.time >= game.flightTimeLimit) {
            finishGame();
        }
    }


    function render() {
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);


        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1a4d80';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();


        const grad = ctx.createRadialGradient(cx, cy, game.earthRadius, cx, cy, game.earthRadius + 40);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, game.earthRadius + 40, 0, Math.PI * 2);
        ctx.fill();

        
        if (game.running && game.satellite) {
            const targetR = game.satellite.targetRadius;
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.arc(cx, cy, targetR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        
        if (game.satellite) {
            const sat = game.satellite;
            const x = cx + Math.cos(sat.angle) * sat.radius;
            const y = cy + Math.sin(sat.angle) * sat.radius;

            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#00ffff';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ffff';
            ctx.fill();
            ctx.shadowBlur = 0;
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


    function finishGame() {
        game.running = false;
        game.finished = true;

        const sat = game.satellite;
        const finalRadius = sat.radius;
        const targetRadius = sat.targetRadius;
        const diff = Math.abs(finalRadius - targetRadius);

        let success = false;
        let message = '';

        if (diff < 15) {
            success = true;
            message = 'Аппарат успешно вышел на заданную орбиту!';
        } else if (finalRadius < targetRadius) {
            message = 'Аппарат не набрал высоту. Импульс слишком слабый.';
        } else {
            message = 'Аппарат ушёл выше целевой орбиты. Импульс слишком сильный.';
        }

        resultTitle.textContent = success ? 'УСПЕХ' : 'НЕУДАЧА';
        resultTitle.style.color = success ? '#00ff00' : '#ff4444';
        resultText.textContent = message + ' Итоговое время: ' + game.time.toFixed(1) + ' с.';
        resultScreen.classList.remove('hidden');

        statusValue.textContent = success ? 'Успех' : 'Неудача';
        startBtn.disabled = true;
    }

    function startGame() {
        if (game.running) return;

        game.running = true;
        game.finished = false;
        game.time = 0;
        game.targetAltitude = parseInt(altitudeSlider.value, 10);
        game.impulse = parseInt(impulseSlider.value, 10);
        game.satellite = createSatellite();

        resultScreen.classList.add('hidden');
        statusValue.textContent = 'Полёт';
        startBtn.disabled = true;

        lastTime = performance.now();
    }


    function resetGame() {
        game.running = false;
        game.finished = false;
        game.time = 0;
        game.satellite = null;

        resultScreen.classList.add('hidden');
        statusValue.textContent = 'Ожидание';
        timeValue.textContent = '0.0';
        startBtn.disabled = false;

        render();
    }


    altitudeSlider.addEventListener('input', function () {
        altitudeValue.textContent = this.value;
    });

    impulseSlider.addEventListener('input', function () {
        impulseValue.textContent = this.value;
    });

    startBtn.addEventListener('click', startGame);
    resetBtn.addEventListener('click', resetGame);
    resultResetBtn.addEventListener('click', resetGame);


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
        }
    });

    resizeCanvas();
    requestAnimationFrame(loop);
})();