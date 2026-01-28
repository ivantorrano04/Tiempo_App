import * as weather from './weatherService.js';
import { WeatherEffects } from './weatherEffects.js';

const CONFIG = {
    OPENWEATHER: '8d4dca1650918771f55e7eb028ceccc3',
    WEATHERAPI: '2e31d0cf7d8747138ab161501262801'
};

const $ = sel => document.querySelector(sel);
const effects = new WeatherEffects('weatherCanvas');

// --- STATE ---
let favorites = JSON.parse(localStorage.getItem('weatherFavorites') || '[]');
let currentData = null; // To handle "add to fav" logic
let currentPageIndex = 0; // 0 = Home (GPS), 1..N = Favorites
let currentLocation = null; // Store initial GPS

// --- FAVORITES LOGIC ---
function saveFavorite() {
    if (!currentData) return;

    // Check if duplicate
    const idx = favorites.findIndex(f => f.name === currentData.locationName);

    if (idx >= 0) {
        // Remove
        favorites.splice(idx, 1);
        // If we were viewing a favorite that got removed, fallback to home
        if (currentPageIndex > 0) currentPageIndex = 0;
    } else {
        // Add
        favorites.push({
            name: currentData.locationName,
            lat: currentData.lat,
            lon: currentData.lon
        });
        // Jump to new favorite? Or stay. Stay is fine.
    }

    localStorage.setItem('weatherFavorites', JSON.stringify(favorites));
    updateFavUI();
}

function updateFavUI() {
    const btn = $('#favBtn');
    const dots = $('#favDots');
    if (!btn || !dots) return;

    // 1. Star Icon
    const isFav = currentData && favorites.some(f => f.name === currentData.locationName);
    if (isFav) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="ph-fill ph-star"></i>';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="ph ph-star"></i>';
    }

    // 2. Dots
    dots.innerHTML = '';
    // Home Dot (GPS)
    const homeDot = document.createElement('div');
    homeDot.className = `dot ${currentPageIndex === 0 ? 'active' : ''}`;
    homeDot.onclick = () => loadPage(0);
    dots.appendChild(homeDot);

    // Favorite Dots
    favorites.forEach((fav, i) => {
        const d = document.createElement('div');
        d.className = `dot ${currentPageIndex === i + 1 ? 'active' : ''}`;
        d.onclick = () => loadPage(i + 1);
        dots.appendChild(d);
    });
}

function loadPage(index) {
    if (index === 0) {
        // GPS
        if (currentLocation) {
            renderWeather(currentLocation.lat, currentLocation.lon);
            currentPageIndex = 0;
        } else {
            // Retry GPS
            navigator.geolocation.getCurrentPosition(pos => {
                currentLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                renderWeather(pos.coords.latitude, pos.coords.longitude);
                currentPageIndex = 0;
            });
        }
    } else {
        // Favorite
        const fav = favorites[index - 1];
        if (fav) {
            renderWeather(fav.lat, fav.lon);
            currentPageIndex = index;
        }
    }
}

// --- LÓGICA DE SWIPE PARA CAMBIO DE CIUDADES ---
let touchStartX = 0;
let touchStartY = 0;
let isDragging = false;
let currentTranslate = 0;
const SWIPE_THRESHOLD = 80;

function handleSwipeEnd(diffX) {
    const totalPages = favorites.length + 1;
    if (totalPages <= 1) {
        resetContentPosition();
        return;
    }

    if (Math.abs(diffX) > SWIPE_THRESHOLD) {
        if (diffX < 0) {
            // Siguiente (Hacia la izquierda)
            const nextIndex = (currentPageIndex + 1) % totalPages;
            animatePageChange(nextIndex, 1);
        } else {
            // Anterior (Hacia la derecha)
            const prevIndex = (currentPageIndex - 1 + totalPages) % totalPages;
            animatePageChange(prevIndex, -1);
        }
    } else {
        resetContentPosition();
    }
}

function resetContentPosition() {
    const main = $('.main-content');
    main.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    main.style.transform = 'translateX(0)';
    main.style.opacity = '1';
    setTimeout(() => {
        main.style.transition = '';
    }, 400);
}

function animatePageChange(index, direction) {
    const main = $('.main-content');
    // Animar hacia fuera
    main.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in';
    main.style.transform = `translateX(${-direction * 100}px)`;
    main.style.opacity = '0';

    setTimeout(() => {
        loadPage(index);
        // La animación de entrada la maneja renderWeather
    }, 300);
}

// Eventos de puntero
window.addEventListener('pointerdown', e => {
    // Evitar swipe si estamos en scroll horizontal o modal
    if (e.target.closest('.hourly-scroll') || $('.modal-overlay.open')) return;

    touchStartX = e.clientX;
    touchStartY = e.clientY;
    isDragging = true;
    currentTranslate = 0;

    const main = $('.main-content');
    main.style.transition = 'none';
});

window.addEventListener('pointermove', e => {
    if (!isDragging) return;

    const diffX = e.clientX - touchStartX;
    const diffY = e.clientY - touchStartY;

    // Si el movimiento es más vertical que horizontal, cancelar swipe
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
        isDragging = false;
        resetContentPosition();
        return;
    }

    // Mover el contenido
    currentTranslate = diffX;
    const main = $('.main-content');
    main.style.transform = `translateX(${currentTranslate}px)`;
    // Efecto de desvanecimiento sutil
    main.style.opacity = 1 - (Math.abs(currentTranslate) / 1000);
});

window.addEventListener('pointerup', e => {
    if (!isDragging) return;
    isDragging = false;
    handleSwipeEnd(currentTranslate);
});

window.addEventListener('pointercancel', () => {
    if (!isDragging) return;
    isDragging = false;
    resetContentPosition();
});

// Button Listener (Wait for DOM or bind later? Bind now using selector which might exist)
// Better to bind inside an init or at bottom. I'll bind at bottom or use event delegation.
document.addEventListener('click', e => {
    if (e.target.closest('#favBtn')) saveFavorite();
});

// Diccionario de temas actualizado para soportar español e inglés
const THEMES = {
    DAY: {
        'despejado': 'linear-gradient(180deg, #2980B9 0%, #6DD5FA 100%)',
        'clear': 'linear-gradient(180deg, #1c3b70 0%, #6DD5FA 100%)',
        'soleado': 'linear-gradient(180deg, #2980B9 0%, #6DD5FA 100%)',
        'parcialmente nublado': 'linear-gradient(180deg, #546E7A 0%, #90A4AE 100%)',
        'nublado': 'linear-gradient(180deg, #546E7A 0%, #CFD8DC 100%)',
        'cubierto': 'linear-gradient(180deg, #37474F 0%, #546E7A 100%)',
        'lluvia': 'linear-gradient(180deg, #203A43 0%, #2C5364 100%)',
        'lluvia moderada': 'linear-gradient(180deg, #203A43 0%, #2C5364 100%)',
        'nieve': 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)',
        'tormenta': 'linear-gradient(180deg, #0F2027 0%, #203A43 100%)'
    },
    NIGHT: {
        'despejado': 'linear-gradient(180deg, #0F2027 0%, #203A43 100%)', // Midnight
        'clear': 'linear-gradient(180deg, #0F2027 0%, #203A43 100%)',
        'soleado': 'linear-gradient(180deg, #0F2027 0%, #203A43 100%)', // Should not happen but fallback
        'parcialmente nublado': 'linear-gradient(180deg, #232526 0%, #414345 100%)', // Dark grey
        'nublado': 'linear-gradient(180deg, #232526 0%, #414345 100%)',
        'cubierto': 'linear-gradient(180deg, #232526 0%, #414345 100%)',
        'lluvia': 'linear-gradient(180deg, #000000 0%, #434343 100%)', // Very dark grey/black
        'lluvia moderada': 'linear-gradient(180deg, #000000 0%, #434343 100%)',
        'nieve': 'linear-gradient(180deg, #1e3c72 0%, #2a5298 100%)', // Dark cool blue
        'tormenta': 'linear-gradient(180deg, #000000 0%, #29323c 100%)'
    }
};

function setBackground(condition, isDay) {
    const text = condition.toLowerCase();
    const mode = isDay ? 'DAY' : 'NIGHT';
    let bg = THEMES[mode]['despejado']; // Default fallback

    if (text.includes('despejado') || text.includes('soleado') || text.includes('clear') || text.includes('sol')) {
        bg = THEMES[mode]['despejado'];
    } else if (text.includes('nublado') || text.includes('nubes') || text.includes('cubierto')) {
        bg = THEMES[mode]['nublado'];
    } else if (text.includes('lluvia') || text.includes('llovizna') || text.includes('chubascos')) {
        bg = THEMES[mode]['lluvia'];
    } else if (text.includes('nieve')) {
        bg = THEMES[mode]['nieve'];
    } else if (text.includes('tormenta') || text.includes('eléctrica')) {
        bg = THEMES[mode]['tormenta'];
    }

    $('#bgLayer').style.background = bg;
}

// Helper: Calculate position of min/max relative to the week's range
function getBarStyles(dayMin, dayMax, weekMin, weekMax) {
    const range = weekMax - weekMin;
    if (range === 0) return { left: '0%', width: '100%' }; // edge case

    // Add some padding to the range so bar isn't 0px or touching edges too hard
    const cleanMin = Math.max(dayMin, weekMin);
    const cleanMax = Math.min(dayMax, weekMax);

    const left = ((cleanMin - weekMin) / range) * 100;
    const width = ((cleanMax - cleanMin) / range) * 100;

    return { left: `${left}%`, width: `${width}%` };
}

async function renderWeather(lat, lon) {
    const main = $('.main-content');

    // Preparar animación de entrada
    if (main) {
        main.style.transition = 'none';
        main.style.transform = 'translateY(10px)';
        main.style.opacity = '0';
        // Force reflow
        main.offsetHeight;
        main.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease-out';
        main.style.transform = 'translateY(0)';
        main.style.opacity = '1';
    }

    $('#loader').classList.add('visible');
    try {
        const [meteoTemp, owTemp, details, forecast, aqi] = await Promise.all([
            weather.fetchOpenMeteo(lat, lon).catch(() => null),
            weather.fetchOpenWeatherTemp(lat, lon, CONFIG.OPENWEATHER).catch(() => null),
            weather.fetchWeatherDetails(lat, lon, CONFIG.WEATHERAPI),
            weather.fetchWeatherForecast(lat, lon, CONFIG.WEATHERAPI, 5),
            weather.fetchAirQuality(lat, lon, CONFIG.OPENWEATHER).catch(() => null)
        ]);

        if (main) main.classList.remove('transitioning');

        // --- State Update ---
        details.lat = lat; details.lon = lon;
        currentData = details;
        if (!currentLocation && currentPageIndex === 0) {
            currentLocation = { lat, lon };
        }
        updateFavUI();

        // --- 1. Header & Hero ---
        $('#cityName').textContent = details.locationName;
        // $('#currentDate').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        $('#weatherDesc').textContent = details.condition;

        // Temperature Consensus
        const temps = [meteoTemp, owTemp, details.temp].filter(t => t !== null);
        const avg = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);

        $('#avgTemp').textContent = avg;
        $('#maxTemp').innerText = Math.round(details.maxTemp);
        $('#minTemp').innerText = Math.round(details.minTemp);

        // Background Theme
        setBackground(details.condition, details.isDay);

        // Canvas Effects (Rain/Snow/Clouds)
        effects.setWeather(details.condition, details.isDay);

        // --- 2. Hourly Scroll ---
        const hourlyContainer = $('#hourlyScroll');
        hourlyContainer.innerHTML = '';
        if (details.hourly) {
            const now = new Date();
            const nowTime = now.getTime();

            // Find the index of the current hour in the massive 48h array
            let startIndex = details.hourly.findIndex(h => {
                const hTime = new Date(h.time).getTime();
                // Match the hour (ignore minutes/seconds for matching)
                return hTime >= nowTime - (30 * 60 * 1000);
            });

            if (startIndex === -1) startIndex = 0; // Fallback

            // Slice next 24 hours
            const next24Hours = details.hourly.slice(startIndex, startIndex + 24);

            next24Hours.forEach((h, index) => {
                const timeStr = h.time.split(' ')[1]; // "14:00"
                const isNow = index === 0;

                const div = document.createElement('div');
                div.className = 'hour-item';
                div.innerHTML = `
                    <div class="hour-time">${isNow ? 'Ahora' : timeStr}</div>
                    <img src="${h.condition.icon}" class="hour-icon">
                    <div class="hour-temp">${Math.round(h.temp_c)}°</div>
                `;
                hourlyContainer.appendChild(div);
            });
        }

        // --- 3. Daily Forecast (Vertical List) ---
        const forecastList = $('#forecastList');
        forecastList.innerHTML = '';

        // Calculate Week Range for bars
        let weekMin = 100, weekMax = -100;
        forecast.forEach(d => {
            if (d.mintemp_c < weekMin) weekMin = d.mintemp_c;
            if (d.maxtemp_c > weekMax) weekMax = d.maxtemp_c;
        });

        forecast.forEach(day => {
            const dateObj = new Date(day.date);
            const today = new Date();
            let dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });
            if (dateObj.getDate() === today.getDate()) dayName = 'Hoy';

            // Bar Calculation
            const { left, width } = getBarStyles(day.mintemp_c, day.maxtemp_c, weekMin, weekMax);

            const row = document.createElement('div');
            row.className = 'daily-row';
            row.style.cursor = 'pointer';
            row.onclick = () => openModal(day); // Logic added below

            row.innerHTML = `
                <div class="day-name">${dayName}</div>
                <div class="day-icon"><img src="${day.conditionIcon}"></div>
                
                <div class="temp-bar-container">
                    <div class="temp-num low">${Math.round(day.mintemp_c)}°</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="margin-left: ${left}; width: ${width};"></div>
                    </div>
                    <div class="temp-num">${Math.round(day.maxtemp_c)}°</div>
                </div>
            `;
            forecastList.appendChild(row);
        });

        // --- 4. Grid Stats ---

        // AQI Logic
        if (aqi) {
            $('#val-aqi').textContent = aqi;
            const aqiTexts = ['Bueno', 'Razonable', 'Moderado', 'Pobre', 'Muy Pobre'];
            const aqiColors = ['#00e400', '#ffff00', '#ff7e00', '#ff0000', '#7e0023'];

            $('#aqi-desc').textContent = aqiTexts[aqi - 1] || 'Unknown';
            $('#aqi-bar').style.width = (aqi / 5 * 100) + '%';
            $('#aqi-bar').style.background = aqiColors[aqi - 1] || '#ccc';
        } else {
            $('#val-aqi').textContent = '--';
        }

        $('#val-uv').textContent = details.uv;
        const uvText = details.uv <= 2 ? 'Bajo' : details.uv <= 5 ? 'Moderado' : 'Alto';
        $('#uv-advice').textContent = uvText;

        $('#val-wind').textContent = details.windKph;
        $('#val-gusts').textContent = details.gustsKph;
        $('#wind-dir-text').textContent = "Dir: " + (details.windDegree || '') + "°";

        $('#val-sunrise').textContent = details.sunrise;
        $('#val-sunset').textContent = details.sunset;

        // Translation hack for moon phase if needed, or just use English from API
        const moonMap = {
            'New Moon': 'Luna Nueva', 'Waxing Crescent': 'Luna Creciente',
            'First Quarter': 'Cuarto Creciente', 'Waxing Gibbous': 'Gibosa Creciente',
            'Full Moon': 'Luna Llena', 'Waning Gibbous': 'Gibosa Menguante',
            'Last Quarter': 'Cuarto Menguante', 'Waning Crescent': 'Luna Menguante'
        };
        $('#val-moon').textContent = moonMap[details.moonPhase] || details.moonPhase;

        $('#val-humidity').textContent = details.humidity;
        $('#val-dew').textContent = Math.round(details.temp - ((100 - details.humidity) / 5)); // Aprox dew point

        $('#val-vis').textContent = details.visibility;
        $('#val-feels').textContent = Math.round(details.feelsLike);

        // --- 5. Footer Sources ---
        $('#source-1').textContent = meteoTemp ? Math.round(meteoTemp) : '--';
        $('#source-2').textContent = Math.round(details.temp);
        $('#source-3').textContent = owTemp ? Math.round(owTemp) : '--';

        // --- 6. Interactive Stats ---
        document.querySelectorAll('.stat-item[data-type]').forEach(item => {
            item.onclick = () => openStatModal(item.dataset.type, details);
        });

    } catch (err) {
        console.error("Error fetching data:", err);
        alert("Lo siento, hubo un error al cargar el clima. Verifica tu conexión.");
    } finally {
        $('#loader').classList.remove('visible');
    }
}

// Chart Instance
let statChartInstance = null;

function openStatModal(type, details) {
    const modal = $('#statModal');
    const title = $('#statTitle');
    const desc = $('#statDesc');
    const ctx = document.getElementById('statChart').getContext('2d');

    // Prepare Data (Next 24h)
    const labels = details.hourly.slice(0, 24).map(h => h.time.split(' ')[1]);
    let dataset = [];
    let label = '';
    let color = '#fff';

    // Config based on type
    if (type === 'uv') {
        title.textContent = 'Índice UV';
        desc.textContent = 'Pronóstico de radiación UV para las próximas 24h.';
        dataset = details.hourly.slice(0, 24).map(h => h.uv);
        label = 'Nivel UV';
        color = '#FFD700';
    } else if (type === 'wind') {
        title.textContent = 'Viento';
        desc.textContent = 'Velocidad del viento (km/h).';
        dataset = details.hourly.slice(0, 24).map(h => h.wind_kph);
        label = 'Viento (km/h)';
        color = '#4DD0E1';
    } else if (type === 'humidity') {
        title.textContent = 'Humedad';
        desc.textContent = 'Porcentaje de humedad relativa.';
        dataset = details.hourly.slice(0, 24).map(h => h.humidity);
        label = 'Humedad (%)';
        color = '#4FC3F7';
    } else if (type === 'pressure') { // mapped to visibility card if needed or create new
        title.textContent = 'Presión';
        desc.textContent = 'Presión atmosférica (mb).';
        dataset = details.hourly.slice(0, 24).map(h => h.pressure_mb);
        label = 'Presión (mb)';
        color = '#90A4AE';
    } else {
        // Fallback for types without hourly chart (Sunrise, etc)
        // Ideally show different content, but for now just title
        title.textContent = type.toUpperCase();
        desc.textContent = 'Información detallada no disponible en gráfico.';
        if (statChartInstance) statChartInstance.destroy();
        modal.classList.add('open');
        return;
    }

    modal.classList.add('open');

    // Destroy old
    if (statChartInstance) statChartInstance.destroy();

    // Render Chart
    statChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: dataset,
                borderColor: color,
                backgroundColor: color + '33', // 20% opacity
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(30,30,45,0.9)',
                    titleColor: '#fff',
                    bodyColor: '#ccc'
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', maxTicksLimit: 6 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: 'rgba(255,255,255,0.5)' }
                }
            }
        }
    });
}

// Close Stat Modal
$('#closeStatModal').addEventListener('click', () => $('#statModal').classList.remove('open'));
window.addEventListener('click', (e) => {
    if (e.target === $('#statModal')) $('#statModal').classList.remove('open');
});

// Modal Logic
function openModal(day) {
    const d = new Date(day.date);
    const dateStr = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    $('#modalDate').textContent = dateStr;
    $('#modalCond').textContent = day.conditionText;
    // High res icon?
    $('#modalIcon').src = day.conditionIcon.replace('64x64', '128x128');

    $('#modalMax').textContent = Math.round(day.maxtemp_c) + '°';
    $('#modalMin').textContent = Math.round(day.mintemp_c) + '°';

    $('#modalRain').textContent = day.rainChance + '%';
    $('#modalWind').textContent = day.maxWind + ' km/h';
    $('#modalHum').textContent = day.humidity + '%';
    $('#modalUv').textContent = day.uv;
    $('#modalSunrise').textContent = day.sunrise;

    const moonMap = {
        'New Moon': 'Luna Nueva', 'Waxing Crescent': 'Luna Creciente', 'First Quarter': 'Cuarto Creciente',
        'Waxing Gibbous': 'Gibosa Creciente', 'Full Moon': 'Luna Llena', 'Waning Gibbous': 'Gibosa Menguante',
        'Last Quarter': 'Cuarto Menguante', 'Waning Crescent': 'Luna Menguante'
    };
    $('#modalMoon').textContent = moonMap[day.moonPhase] || day.moonPhase;

    $('#dayModal').classList.add('open');
}

// Close Modal
$('#closeModal').addEventListener('click', () => $('#dayModal').classList.remove('open'));
window.addEventListener('click', (e) => {
    if (e.target === $('#dayModal')) $('#dayModal').classList.remove('open');
});

// Event Listeners
// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const handleSearch = debounce(async (e) => {
    const query = e.target.value.trim();
    const suggestionsBox = $('#suggestions');

    if (query.length < 3) {
        suggestionsBox.classList.remove('visible');
        suggestionsBox.innerHTML = '';
        return;
    }

    try {
        const results = await weather.searchCitiesWithTemp(query, CONFIG.WEATHERAPI);

        suggestionsBox.innerHTML = '';
        if (results.length > 0) {
            results.forEach(city => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `
                    <div class="s-info">
                        <span class="s-name">${city.name}</span>
                        <span class="s-country">
                            ${city.state ? city.state + ', ' : ''}${city.country}
                        </span>
                    </div>
                    <div class="s-temp">${Math.round(city.temp)}°</div>
                `;
                item.onclick = () => {
                    renderWeather(city.lat, city.lon);
                    suggestionsBox.classList.remove('visible');
                    $('#cityInput').value = city.name;
                };
                suggestionsBox.appendChild(item);
            });
            suggestionsBox.classList.add('visible');
        } else {
            suggestionsBox.classList.remove('visible');
        }
    } catch (err) {
        // Silent fail for suggestions
    }
}, 300);

$('#cityInput').addEventListener('input', handleSearch);

// Close suggestions on click outside
window.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        $('#suggestions').classList.remove('visible');
    }
});

$('#cityInput').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        $('#suggestions').classList.remove('visible');
        const city = e.target.value.trim();
        if (!city) return;

        e.target.blur();
        try {
            const coords = await weather.getCoords(city, CONFIG.OPENWEATHER);
            renderWeather(coords.lat, coords.lon);
        } catch (error) {
            alert("No encontramos esa ciudad.");
        }
    }
});

// Geolocation Button
$('#geoBtn').addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
        pos => renderWeather(pos.coords.latitude, pos.coords.longitude),
        () => alert("No pudimos obtener tu ubicación.")
    );
});

// Initial Load
navigator.geolocation.getCurrentPosition(
    pos => renderWeather(pos.coords.latitude, pos.coords.longitude),
    () => renderWeather(40.4168, -3.7038) // Madrid Default
);