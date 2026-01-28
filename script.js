import * as weather from './weatherService.js';

const CONFIG = {
    OPENWEATHER: '8d4dca1650918771f55e7eb028ceccc3',
    WEATHERAPI: '2e31d0cf7d8747138ab161501262801'
};

const $ = sel => document.querySelector(sel);

async function renderWeather(lat, lon, name) {
    $('.loader-overlay').classList.add('visible');
    try {
        const [meteoTemp, owTemp, details, forecast] = await Promise.all([
            weather.fetchOpenMeteo(lat, lon).catch(() => null),
            weather.fetchOpenWeatherTemp(lat, lon, CONFIG.OPENWEATHER).catch(() => null),
            weather.fetchWeatherDetails(lat, lon, CONFIG.WEATHERAPI),
            weather.fetchWeatherForecast(lat, lon, CONFIG.WEATHERAPI, 5)
        ]);

        // 1. Datos principales
        $('#cityName').textContent = details.locationName;
        $('#weatherDesc').textContent = details.condition;
        $('#maxTemp').textContent = Math.round(details.maxTemp);
        $('#minTemp').textContent = Math.round(details.minTemp);
        
        // Icono Grande
        $('#weatherIconLarge').innerHTML = `<img src="${details.conditionIcon}" width="120" style="filter: drop-shadow(0 10px 20px rgba(0,0,0,0.2))">`;

        // 2. Consenso de temperatura
        const temps = [meteoTemp, owTemp, details.temp].filter(t => t !== null);
        const avg = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
        $('#avgTemp').textContent = avg;

        $('#source-1').textContent = meteoTemp ? `${Math.round(meteoTemp)}°` : '--';
        $('#source-2').textContent = `${Math.round(details.temp)}°`;
        $('#source-3').textContent = owTemp ? `${Math.round(owTemp)}°` : '--';

        // 3. Rellenar Widgets
        $('#val-wind').textContent = details.windKph;
        $('#val-gusts').textContent = details.gustsKph;
        $('#val-uv').textContent = details.uv;
        $('#val-feels').textContent = Math.round(details.feelsLike);
        $('#val-humidity').textContent = details.humidity;
        $('#val-vis').textContent = details.visibility;
        $('#val-pressure').textContent = details.pressure;
        $('#val-rain').textContent = details.precip;
        $('#val-sunrise').textContent = details.sunrise;
        $('#val-sunset').textContent = details.sunset;

        // Recomendación UV
        const uvText = details.uv <= 2 ? 'Bajo' : details.uv <= 5 ? 'Moderado' : 'Alto';
        $('#uv-advice').textContent = `Nivel ${uvText}`;

        // 4. Pronóstico
        const forecastContainer = $('#forecastCards');
        forecastContainer.innerHTML = '';
        forecast.forEach(day => {
            const date = new Date(day.date).toLocaleDateString('es-ES', { weekday: 'short' });
            const card = document.createElement('div');
            card.className = 'forecast-card';
            card.innerHTML = `
                <div class="day">${date}</div>
                <img src="${day.conditionIcon}">
                <div class="temp">${Math.round(day.avgtemp_c)}°</div>
                <div class="range">${Math.round(day.mintemp_c)}° / ${Math.round(day.maxtemp_c)}°</div>
            `;
            forecastContainer.appendChild(card);
        });

        // 5. Modo Noche/Día
        document.body.classList.toggle('night', !details.isDay);

    } catch (err) {
        console.error(err);
        alert("Error al cargar los datos.");
    } finally {
        $('.loader-overlay').classList.remove('visible');
    }
}

$('#searchBtn').addEventListener('click', async () => {
    const city = $('#cityInput').value.trim();
    if (!city) return;
    try {
        const coords = await weather.getCoords(city, CONFIG.OPENWEATHER);
        renderWeather(coords.lat, coords.lon, coords.name);
    } catch (e) { alert("Ciudad no encontrada"); }
});

// Tecla Enter
$('#cityInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') $('#searchBtn').click();
});

// Ubicación inicial
navigator.geolocation.getCurrentPosition(
    p => renderWeather(p.coords.latitude, p.coords.longitude, "Mi ubicación"),
    () => renderWeather(40.4168, -3.7038, "Madrid")
);