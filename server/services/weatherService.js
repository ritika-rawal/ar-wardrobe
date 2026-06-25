// Open-Meteo: free, no API key, no signup. https://open-meteo.com
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export async function geocodeCity(city) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  const place = data.results?.[0];
  if (!place) throw new Error(`Could not find location "${city}"`);
  return { lat: place.latitude, lon: place.longitude, label: `${place.name}, ${place.country}` };
}

export async function getCurrentWeather({ lat, lon }) {
  const url =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation,wind_speed_10m,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
  const data = await res.json();
  const c = data.current;

  return {
    tempC: c.temperature_2m,
    precipitationMm: c.precipitation,
    windKph: c.wind_speed_10m,
    condition: weatherCodeToCondition(c.weather_code),
    isRainy: c.precipitation > 0 || isRainyCode(c.weather_code),
    isWindy: c.wind_speed_10m >= 25,
  };
}

function isRainyCode(code) {
  // WMO weather codes: 51-67 drizzle/rain, 80-82 showers, 95-99 thunderstorm
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
}

function weatherCodeToCondition(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}
