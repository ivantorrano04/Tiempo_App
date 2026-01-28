export class WeatherEffects {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.particles = [];
        this.clouds = [];
        this.stars = [];
        this.lightningTimer = 0;
        this.isLightning = false;

        this.animationFrame = null;
        this.type = 'clear';
        this.isDay = true;
        this.intensity = 1;
        this.lastIsDay = true; // Added to track changes in day/night

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initStars(); // Pre-calculate stars
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.initStars();
    }

    setWeather(condition, isDay) {
        const text = condition.toLowerCase();
        this.isDay = isDay === 1 || isDay === true; // API passes 1/0

        let newType = 'clear';
        let newIntensity = 0.5;

        // Smart Detection (Multilingual: ES + EN)
        if (text.includes('tormenta') || text.includes('thunder') || text.includes('rayos')) {
            newType = 'storm';
            newIntensity = 1.0;
        }
        else if (text.includes('lluvia') || text.includes('llovizna') || text.includes('rain') || text.includes('chubasco')) {
            newType = 'rain';
            newIntensity = (text.includes('fuerte') || text.includes('intensa') || text.includes('heavy')) ? 1.0 : 0.4;
        }
        else if (text.includes('nieve') || text.includes('snow') || text.includes('nevada')) {
            newType = 'snow';
            newIntensity = 0.6;
        }
        else if (text.includes('nublado') || text.includes('nubes') || text.includes('clouds') || text.includes('cubierto') || text.includes('fog') || text.includes('niebla')) {
            newType = 'clouds';
            // Si está muy nublado o cubierto, más intensidad de nubes
            newIntensity = (text.includes('cubierto') || text.includes('totalmente') || text.includes('overcast')) ? 0.9 : 0.5;
        }
        else if (text.includes('despejado') || text.includes('soleado') || text.includes('clear') || text.includes('sol')) {
            newType = 'clear';
        }

        // Reset if changing
        if (this.type !== newType || this.intensity !== newIntensity || this.lastIsDay !== this.isDay) {
            console.log(`Cambiando clima a: ${newType} (Intensidad: ${newIntensity}), Día: ${this.isDay}`);
            this.type = newType;
            this.intensity = newIntensity;
            this.lastIsDay = this.isDay;
            this.start();
        }
    }

    start() {
        this.particles = [];
        this.clouds = [];
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);

        if (this.type === 'rain' || this.type === 'storm') this.initRain();
        if (this.type === 'snow') this.initSnow();
        if (this.type === 'clouds' || this.type === 'rain' || this.type === 'storm') this.initClouds(); // Clouds present in rain too
        // Clear/Sun doesn't need init particles, just draw loop

        this.animate();
    }

    // --- STARS (Static background for night) ---
    initStars() {
        this.stars = [];
        const count = 200;
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                r: Math.random() * 1.5,
                o: Math.random()
            });
        }
    }

    drawStars() {
        if (this.isDay) return; // No stars during day
        // Opacity depends on cloud cover? If very cloudy, dim stars
        const cloudCover = (this.type === 'clouds' || this.type === 'rain' || this.type === 'storm') ? this.intensity : 0;
        const visibility = 1 - Math.min(cloudCover * 1.2, 1); // 1.2 to hide fully if cover > 0.8

        if (visibility <= 0.05) return;

        this.ctx.fillStyle = `rgba(255, 255, 255, ${visibility})`;
        this.ctx.beginPath();
        for (let s of this.stars) {
            // Twinkle
            if (Math.random() > 0.99) s.o = Math.random();
            this.ctx.globalAlpha = s.o * visibility;
            this.ctx.moveTo(s.x, s.y);
            this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        }
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
    }

    // --- MOON (Static / Glow) ---
    drawMoon() {
        if (this.isDay) return;
        // Don't draw if full overcast/storm
        if (this.type === 'storm' || (this.type === 'clouds' && this.intensity > 0.7) || (this.type === 'rain' && this.intensity > 0.5)) return;

        const x = this.width * 0.8;
        const y = this.height * 0.15;
        const r = 40;

        // Glow
        const g = this.ctx.createRadialGradient(x, y, r, x, y, r * 4);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r * 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Moon Body
        this.ctx.fillStyle = '#EEE';
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fill();

        // Craters (Simple)
        this.ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(x - 10, y + 5, 8, 0, Math.PI * 2);
        this.ctx.arc(x + 15, y - 10, 5, 0, Math.PI * 2);
        this.ctx.arc(x + 5, y + 15, 6, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // --- RAIN V2 (Depth & Splashes) ---
    initRain() {
        // Multi-layered rain
        const count = Math.floor(200 + (this.intensity * 800));
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                z: Math.random() * 2 + 0.5, // Depth 0.5 to 2.5
                l: Math.random() * 20 + 10,
                v: 0 // Velocity calculated in draw based on Z
            });
        }
    }

    drawRain() {
        this.ctx.lineWidth = 1;

        for (let p of this.particles) {
            // Physics based on Z (depth)
            // Closer drops (higher Z) are faster, longer, thicker, more opaque
            const speed = (p.z * 10) + 15;
            const length = p.l * p.z;
            const opacity = 0.1 * p.z;

            // At night, rain catches light differently? Just dimmer/white
            this.ctx.strokeStyle = this.isDay ? `rgba(180, 200, 230, ${opacity})` : `rgba(200, 200, 255, ${opacity * 0.5})`;

            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x + (speed * 0.1), p.y + length); // Slant
            this.ctx.stroke();

            p.y += speed;
            p.x += speed * 0.1;

            if (p.y > this.height) {
                p.y = -length;
                p.x = Math.random() * this.width;
            }
        }

        // Lightning Flash
        if (this.type === 'storm') {
            this.flashLightning();
        }
    }

    // --- SNOW V2 (Soft Flakes & Sway) ---
    initSnow() {
        const count = 150 + (this.intensity * 200);
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                r: Math.random() * 4 + 1, // radius
                d: Math.random() * Math.PI, // density/angle for sway
                v: Math.random() * 2 + 1, // speed
                o: Math.random() * 0.5 + 0.3 // opacity
            });
        }
    }

    drawSnow() {
        for (let p of this.particles) {
            // Soft Radial Gradient for fluffiness
            const g = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, `rgba(255, 255, 255, ${p.o})`);
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');

            this.ctx.fillStyle = g;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fill();

            p.y += p.v;
            p.x += Math.sin(p.d) * 0.5; // Gentle sway
            p.d += 0.02;

            if (p.y > this.height) {
                p.y = -10;
                p.x = Math.random() * this.width;
            }
        }
    }

    // --- CLOUDS V2 (Smoke-like Fog Layers - Adapted for Night) ---
    initClouds() {
        // We create large "Smoke" particles that drift
        const count = 20 + Math.floor(this.intensity * 10);
        for (let i = 0; i < count; i++) {
            this.clouds.push({
                x: Math.random() * this.width,
                y: Math.random() * (this.height * 0.6), // Upper 60%
                r: 200 + Math.random() * 400, // Very large
                s: 0.2 + Math.random() * 0.3, // Speed
                o: 0.1 + Math.random() * 0.15 // Very transparent
            });
        }
    }

    drawClouds() {
        for (let p of this.clouds) {
            const g = this.ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r);

            // Night clouds are darker, Day clouds are white
            if (this.isDay) {
                g.addColorStop(0, `rgba(245, 245, 255, ${p.o})`);
                g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            } else {
                // Night: Dark slate/blueish grey
                const opacity = p.o * 0.6;
                g.addColorStop(0, `rgba(180, 190, 200, ${opacity})`);
                g.addColorStop(1, 'rgba(100, 100, 110, 0)');
            }

            this.ctx.fillStyle = g;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fill();

            p.x += p.s;
            if (p.x - p.r > this.width) {
                p.x = -p.r;
                p.y = Math.random() * (this.height * 0.6);
            }
        }
    }

    flashLightning() {
        if (this.isLightning) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
            if (Math.random() > 0.8) this.isLightning = false;
        } else {
            if (Math.random() > 0.995) this.isLightning = true;
        }
    }

    // --- SUN V2 (God Rays) ---
    drawSun() {
        if (!this.isDay) return; // No sun at night

        // Draw Sun Top Right usually, or dynamic based on time? 
        // Let's do a glowing corner effect
        const sunX = this.width * 0.8;
        const sunY = this.height * 0.1;

        // Inner Core
        const g = this.ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 300);
        g.addColorStop(0, 'rgba(255, 255, 200, 0.4)'); // Light warm center
        g.addColorStop(0.2, 'rgba(255, 220, 100, 0.1)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');

        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.arc(sunX, sunY, 400, 0, Math.PI * 2);
        this.ctx.fill();

        // Rays (Rotating)
        if (!this.rayAngle) this.rayAngle = 0;
        this.rayAngle += 0.002;

        this.ctx.save();
        this.ctx.translate(sunX, sunY);
        this.ctx.rotate(this.rayAngle);

        for (let i = 0; i < 8; i++) {
            this.ctx.rotate(Math.PI / 4);
            // Draw faint ray
            const gr = this.ctx.createLinearGradient(0, 0, 800, 0);
            gr.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
            gr.addColorStop(1, 'rgba(255, 255, 255, 0)');

            this.ctx.fillStyle = gr;
            this.ctx.fillRect(0, -20, 800, 40); // Long strip
        }
        this.ctx.restore();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Order: Stars -> Moon/Sun -> Clouds -> Rain/Snow
        if (!this.isDay) {
            this.drawStars();
            this.drawMoon();
        } else {
            this.drawSun();
        }

        if (this.type === 'clouds' || this.type === 'rain' || this.type === 'storm') this.drawClouds();
        if (this.type === 'rain' || this.type === 'storm') this.drawRain();
        if (this.type === 'snow') this.drawSnow();

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
}
