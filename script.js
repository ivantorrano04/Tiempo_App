import * as weather from './weatherService.js';

const CONFIG = {
    OPENWEATHER: '8d4dca1650918771f55e7eb028ceccc3',
    WEATHERAPI: '2e31d0cf7d8747138ab161501262801'
};

const $ = sel => document.querySelector(sel);

// Dynamic Theme Map (Condition Text -> Gradient)
// Using deeper, richer colors for iOS feel
const THEMES = {
    'Sunny': 'linear-gradient(180deg, #2980B9 0%, #6DD5FA 100%)', // Generic Blue/Clear
    'Clear': 'linear-gradient(180deg, #1c3b70 0%, #6DD5FA 100%)', // Night/Clear
    'Partly cloudy': 'linear-gradient(180deg, #546E7A 0%, #90A4AE 100%)', // Greyish Blue
    'Cloudy': 'linear-gradient(180deg, #546E7A 0%, #CFD8DC 100%)',
    'Overcast': 'linear-gradient(180deg, #37474F 0%, #546E7A 100%)',
    'Mist': 'linear-gradient(180deg, #455A64 0%, #90A4AE 100%)',
    'Patchy rain possible': 'linear-gradient(180deg, #2c3e50 0%, #4ca1af 100%)',
    'Rain': 'linear-gradient(180deg, #1F1C2C 0%, #2c3e50 100%)', // Dark storm
    'Moderate rain': 'linear-gradient(180deg, #1F1C2C 0%, #2c3e50 100%)',
    'Heavy rain': 'linear-gradient(180deg, #141E30 0%, #243B55 100%)',
    'Thunderstorm': 'linear-gradient(180deg, #0f0c29 0%, #302b63 100%)', /* Deep purple */
    'Snow': 'linear-gradient(180deg, #83a4d4 0%, #b6fbff 100%)'
};

function setBackground(condition, isDay) {
    let bg = 'linear-gradient(180deg, #2E335A 0%, #1C1B33 100%)'; // default dark

    // Normalize string
    const text = condition.toLowerCase();

    if (text.includes('sun') || text.includes('soleado')) {
        bg = 'linear-gradient(180deg, #2980B9 0%, #6DD5FA 100%)';
    }
    else if (text.includes('rain') || text.includes('llubia')) {
        bg = 'linear-gradient(180deg, #203A43 0%, #2C5364 100%)';
    }
    else if (text.includes('cloud') || text.includes('nublado')) {
        bg = 'linear-gradient(180deg, #4da0b0 0%, #d39d38 100%)';
    }

    // Simple override for Night if Clear
    if (!isDay && (text.includes('clear') || text.includes('despejado'))) {
        bg = 'linear-gradient(180deg, #0F2027 0%, #203A43 100%)';
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
    $('#loader').classList.add('visible');
    try {
        const [meteoTemp, owTemp, details, forecast] = await Promise.all([
            weather.fetchOpenMeteo(lat, lon).catch(() => null),
            weather.fetchOpenWeatherTemp(lat, lon, CONFIG.OPENWEATHER).catch(() => null),
            weather.fetchWeatherDetails(lat, lon, CONFIG.WEATHERAPI),
            weather.fetchWeatherForecast(lat, lon, CONFIG.WEATHERAPI, 5)
        ]);

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

        // --- 2. Hourly Scroll ---
        const hourlyContainer = $('#hourlyScroll');
        hourlyContainer.innerHTML = '';
        if (details.hourly) {
            // Take next 24 hours
            const nowHour = new Date().getHours();
            // Filter starting from now (roughly, since API returns 00:00 to 23:00 for the day)
            // WeatherAPI "hourly" is usually just the 24h of the request day. 
            // Better to just show what we have or concat if we had 2 days. 
            // Let's just show all returned hours for now, maybe filtered by index > nowHour?
            // Actually WeatherAPI `hour` array is 0..23.

            let hoursToShow = details.hourly;

            // Allow scrolling to current hour
            hoursToShow.forEach(h => {
                const timeStr = h.time.split(' ')[1]; // "14:00"
                const hVal = parseInt(timeStr.split(':')[0]);

                // Only show current and future hours roughly (or all if user wants context)
                // iOS shows "Now" then future. Let's show all for simplicity

                const div = document.createElement('div');
                div.className = 'hour-item';
                div.innerHTML = `
                    <div class="hour-time">${hVal === nowHour ? 'Ahora' : timeStr}</div>
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
        $('#val-uv').textContent = details.uv;
        const uvText = details.uv <= 2 ? 'Bajo' : details.uv <= 5 ? 'Moderado' : 'Alto';
        $('#uv-advice').textContent = uvText;

        $('#val-wind').textContent = details.windKph;
        $('#val-gusts').textContent = details.gustsKph;
        $('#wind-dir-text').textContent = "Dir: " + (details.windDegree || '') + "°";

        $('#val-sunrise').textContent = details.sunrise;
        $('#val-sunset').textContent = details.sunset;

        $('#val-humidity').textContent = details.humidity;
        $('#val-dew').textContent = Math.round(details.temp - ((100 - details.humidity) / 5)); // Aprox dew point

        $('#val-vis').textContent = details.visibility;
        $('#val-feels').textContent = Math.round(details.feelsLike);

        // --- 5. Footer Sources ---
        $('#source-1').textContent = meteoTemp ? Math.round(meteoTemp) : '--';
        $('#source-2').textContent = Math.round(details.temp);
        $('#source-3').textContent = owTemp ? Math.round(owTemp) : '--';

    } catch (err) {
        console.error("Error fetching data:", err);
        alert("Lo siento, hubo un error al cargar el clima. Verifica tu conexión.");
    } finally {
        $('#loader').classList.remove('visible');
    }
}

// Event Listeners
$('#cityInput').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const city = e.target.value.trim();
        if (!city) return;

        // Remove focus to hide keyboard on mobile
        e.target.blur();

        try {
            const coords = await weather.getCoords(city, CONFIG.OPENWEATHER);
            renderWeather(coords.lat, coords.lon);
        } catch (error) {
            alert("No encontramos esa ciudad.");
        }
    }
});

// Initial Load
navigator.geolocation.getCurrentPosition(
    pos => renderWeather(pos.coords.latitude, pos.coords.longitude),
    () => renderWeather(40.4168, -3.7038) // Madrid Default
);