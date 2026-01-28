// weatherService.js

export async function getCoords(city, apiKey) {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error en geolocalización");
    const data = await response.json();
    if (!data || data.length === 0) throw new Error("Ciudad no encontrada");
    return { lat: data[0].lat, lon: data[0].lon, name: data[0].name };
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

export async function fetchWeatherDetails(lat, lon, key) {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=1&lang=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Error al obtener detalles");
    const data = await res.json();

    const current = data.current;
    const astro = data.forecast.forecastday[0].astro;

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
        maxTemp: data.forecast.forecastday[0].day.maxtemp_c,
        minTemp: data.forecast.forecastday[0].day.mintemp_c,
        hourly: data.forecast.forecastday[0].hour
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
        conditionIcon: d.day.condition.icon
    }));
}