// weatherService.js

export async function getCoords(city, apiKey) {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error en geolocalización");
    const data = await response.json();
    if (!data || data.length === 0) throw new Error("Ciudad no encontrada");
    return { lat: data[0].lat, lon: data[0].lon, name: data[0].name };
}

export async function searchCitiesWithTemp(query, apiKey) {
    if (!query || query.length < 3) return [];

    // 1. Use WeatherAPI Search
    const searchUrl = `https://api.weatherapi.com/v1/search.json?key=${apiKey}&q=${encodeURIComponent(query)}`;

    try {
        const res = await fetch(searchUrl);
        if (!res.ok) return [];
        let locations = await res.json();

        if (!locations.length) return [];

        // 2. Prioritize User's Country (Context-aware sorting)
        try {
            // Get user's region code from browser (e.g., "es-ES" -> "ES")
            const userLocale = navigator.language || 'en-US';
            const regionCode = userLocale.split('-')[1];

            if (regionCode) {
                // Convert "ES" -> "Spain" (WeatherAPI uses English country names)
                const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
                const userCountry = regionNames.of(regionCode);

                if (userCountry) {
                    locations.sort((a, b) => {
                        const aIsCountry = a.country.includes(userCountry);
                        const bIsCountry = b.country.includes(userCountry);
                        if (aIsCountry && !bIsCountry) return -1; // a comes first
                        if (!aIsCountry && bIsCountry) return 1;  // b comes first
                        return 0; // maintain valid order (usually relevance)
                    });
                }
            }
        } catch (e) {
            // Fallback to default API sort if detection fails
        }

        // 3. Fetch temps in parallel for top 5 (sorted) results
        const promises = locations.slice(0, 5).map(async (loc) => {
            try {
                // Fetch basic current info
                const tempUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${loc.lat},${loc.lon}`;
                const tempRes = await fetch(tempUrl);
                const tempData = await tempRes.json();

                return {
                    name: loc.name,
                    state: loc.region, // WeatherAPI returns region usually as State/Province
                    country: loc.country,
                    lat: loc.lat,
                    lon: loc.lon,
                    temp: tempData.current.temp_c,
                    icon: tempData.current.condition.icon
                };
            } catch (err) {
                return null;
            }
        });

        const results = await Promise.all(promises);
        return results.filter(item => item !== null);

    } catch (e) {
        return [];
    }
}

export async function fetchOpenMeteo(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url);
    const data = await res.json();
    return data.current_weather.temperature;
}

export async function fetchOpenWeatherTemp(lat, lon, key) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.main.temp;
}

export async function fetchAirQuality(lat, lon, key) {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    // Returns AQI index 1-5 (1 = Good, 5 = Very Poor)
    return data.list[0].main.aqi;
}

export async function fetchWeatherDetails(lat, lon, key) {
    // Fetch 2 days to ensure we have next 24h hourly data
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=2&lang=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error al obtener detalles");
    const data = await res.json();

    const current = data.current;
    const todayForecast = data.forecast.forecastday[0];
    const tomorrowForecast = data.forecast.forecastday[1]; // Might be undefined if API fails but days=2 requested
    const astro = todayForecast.astro;

    // Concatenate hours: Today + Tomorrow
    let allHours = todayForecast.hour;
    if (tomorrowForecast) {
        allHours = allHours.concat(tomorrowForecast.hour);
    }

    return {
        temp: current.temp_c,
        condition: current.condition.text,
        conditionIcon: current.condition.icon,
        windKph: current.wind_kph,
        windDegree: current.wind_degree,
        gustsKph: current.gust_kph,
        humidity: current.humidity,
        precip: current.precip_mm,
        uv: current.uv,
        feelsLike: current.feelslike_c,
        visibility: current.vis_km,
        pressure: current.pressure_mb,
        isDay: current.is_day,
        locationName: data.location.name,
        sunrise: astro.sunrise,
        sunset: astro.sunset,
        maxTemp: todayForecast.day.maxtemp_c,
        minTemp: todayForecast.day.mintemp_c,
        hourly: allHours,
        moonPhase: astro.moon_phase
    };
}

export async function fetchWeatherForecast(lat, lon, key, days = 5) {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=${days}&lang=es`;
    const res = await fetch(url);
    const data = await res.json();

    return data.forecast.forecastday.map(d => ({
        date: d.date,
        maxtemp_c: d.day.maxtemp_c,
        mintemp_c: d.day.mintemp_c,
        avgtemp_c: d.day.avgtemp_c,
        conditionIcon: d.day.condition.icon,
        conditionText: d.day.condition.text,
        rainChance: d.day.daily_chance_of_rain,
        humidity: d.day.avghumidity,
        maxWind: d.day.maxwind_kph,
        uv: d.day.uv,
        sunrise: d.astro.sunrise,
        sunset: d.astro.sunset,
        moonPhase: d.astro.moon_phase
    }));
}