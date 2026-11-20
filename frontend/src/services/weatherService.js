// Free, open-source weather and geocoding services using Open-Meteo (No API key needed)

const SAVED_CITIES_KEY = 'giochat_weather_saved_cities';
const LAST_LOCATION_KEY = 'giochat_weather_last_loc';

export function getWmoInfo(code, isDay = 1) {
  const isDaytime = isDay === 1 || isDay === true;
  switch (code) {
    case 0:
      return {
        label: isDaytime ? 'Sunny' : 'Clear Sky',
        icon: isDaytime ? 'fa-solid fa-sun' : 'fa-solid fa-moon',
        color: isDaytime ? '#f59e0b' : '#a5b4fc',
      };
    case 1:
    case 2:
      return {
        label: isDaytime ? 'Mostly Sunny' : 'Partly Cloudy',
        icon: isDaytime ? 'fa-solid fa-cloud-sun' : 'fa-solid fa-cloud-moon',
        color: '#38bdf8',
      };
    case 3:
      return {
        label: 'Overcast',
        icon: 'fa-solid fa-cloud',
        color: '#94a3b8',
      };
    case 45:
    case 48:
      return {
        label: 'Foggy',
        icon: 'fa-solid fa-smog',
        color: '#a1a1aa',
      };
    case 51:
    case 53:
    case 55:
      return {
        label: 'Drizzle',
        icon: 'fa-solid fa-cloud-rain',
        color: '#60a5fa',
      };
    case 56:
    case 57:
      return {
        label: 'Freezing Drizzle',
        icon: 'fa-solid fa-snowflake',
        color: '#93c5fd',
      };
    case 61:
    case 63:
    case 65:
      return {
        label: code === 65 ? 'Heavy Rain' : 'Rainy',
        icon: 'fa-solid fa-cloud-showers-heavy',
        color: '#3b82f6',
      };
    case 66:
    case 67:
      return {
        label: 'Freezing Rain',
        icon: 'fa-solid fa-icicles',
        color: '#67e8f9',
      };
    case 71:
    case 73:
    case 75:
      return {
        label: 'Snowing',
        icon: 'fa-solid fa-snowflake',
        color: '#bfdbfe',
      };
    case 77:
      return {
        label: 'Snow Grains',
        icon: 'fa-solid fa-snowflake',
        color: '#bfdbfe',
      };
    case 80:
    case 81:
    case 82:
      return {
        label: 'Rain Showers',
        icon: 'fa-solid fa-cloud-sun-rain',
        color: '#0ea5e9',
      };
    case 85:
    case 86:
      return {
        label: 'Snow Showers',
        icon: 'fa-solid fa-snowflake',
        color: '#93c5fd',
      };
    case 95:
    case 96:
    case 99:
      return {
        label: 'Thunderstorm',
        icon: 'fa-solid fa-cloud-bolt',
        color: '#eab308',
      };
    default:
      return {
        label: 'Partly Cloudy',
        icon: 'fa-solid fa-cloud-sun',
        color: '#38bdf8',
      };
  }
}

// Search cities worldwide using Open-Meteo Geocoding
export async function searchCities(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=8&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding service unavailable');
    const data = await res.json();
    if (!data.results) return [];
    return data.results.map((item) => ({
      id: `${item.latitude}-${item.longitude}-${item.name}`,
      name: item.name,
      country: item.country || '',
      countryCode: item.country_code || '',
      admin1: item.admin1 || '',
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone,
    }));
  } catch (err) {
    console.error('searchCities error:', err);
    return [];
  }
}

// Reverse geocode latitude and longitude to get City and Country name
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || 'My Location';
      const country = data.countryName || '';
      return { city, country };
    }
  } catch (e) {
    console.warn('BigDataCloud reverse geocode failed, trying fallback:', e);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || 'My Location';
      const country = addr.country || '';
      return { city, country };
    }
  } catch (e) {
    console.warn('Nominatim reverse geocode failed:', e);
  }

  return { city: 'Current Location', country: '' };
}

// Fetch comprehensive weather forecast by coordinates
export async function fetchWeather(lat, lon, cityName = '', countryName = '') {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service unavailable');
    const data = await res.json();

    const current = data.current || {};
    const daily = data.daily || {};
    const wmo = getWmoInfo(current.weather_code, current.is_day);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const forecast = (daily.time || []).map((dateStr, index) => {
      const dateObj = new Date(dateStr);
      const isToday = index === 0;
      const dayName = isToday ? 'Today' : dayNames[dateObj.getDay()];
      const code = daily.weather_code ? daily.weather_code[index] : 0;
      const dayWmo = getWmoInfo(code, 1);
      return {
        date: dateStr,
        dayName,
        maxTemp: Math.round(daily.temperature_2m_max ? daily.temperature_2m_max[index] : 0),
        minTemp: Math.round(daily.temperature_2m_min ? daily.temperature_2m_min[index] : 0),
        precipitationProb: daily.precipitation_probability_max ? daily.precipitation_probability_max[index] : 0,
        weatherCode: code,
        label: dayWmo.label,
        icon: dayWmo.icon,
        color: dayWmo.color,
      };
    });

    return {
      cityName: cityName || 'Current Location',
      country: countryName || '',
      latitude: lat,
      longitude: lon,
      temperature: Math.round(current.temperature_2m ?? 20),
      apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 20),
      humidity: current.relative_humidity_2m ?? 0,
      windSpeed: Math.round(current.wind_speed_10m ?? 0),
      isDay: current.is_day === 1,
      weatherCode: current.weather_code ?? 0,
      conditionText: wmo.label,
      conditionIcon: wmo.icon,
      conditionColor: wmo.color,
      forecast: forecast.slice(0, 7),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('fetchWeather error:', err);
    throw err;
  }
}

// Request Browser Geolocation
export function getUserCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

// Automatically detect user's current city living via GPS or instant IP Geolocation
export async function detectCurrentLivingCity() {
  // Strategy 1: Browser GPS geolocation
  try {
    const coords = await getUserCoordinates();
    const geo = await reverseGeocode(coords.latitude, coords.longitude);
    if (geo.city && geo.city !== 'My Location') {
      return {
        cityName: geo.city,
        country: geo.country,
        latitude: coords.latitude,
        longitude: coords.longitude,
        isDetected: true,
      };
    }
  } catch (gpsError) {
    // GPS denied or timed out, seamlessly proceed to IP geolocation
  }

  // Strategy 2: BigDataCloud client IP geolocation (free, instant, no prompt needed)
  try {
    const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en');
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision;
      if (city && data.latitude && data.longitude) {
        return {
          cityName: city,
          country: data.countryName || '',
          latitude: data.latitude,
          longitude: data.longitude,
          isDetected: true,
        };
      }
    }
  } catch (e) {
    console.warn('BigDataCloud IP detection failed:', e);
  }

  // Strategy 3: FreeIPApi fallback
  try {
    const res = await fetch('https://freeipapi.com/api/json');
    if (res.ok) {
      const data = await res.json();
      if (data.cityName && data.latitude && data.longitude) {
        return {
          cityName: data.cityName,
          country: data.countryName || '',
          latitude: data.latitude,
          longitude: data.longitude,
          isDetected: true,
        };
      }
    }
  } catch (e) {
    console.warn('FreeIPApi fallback failed:', e);
  }

  // Strategy 4: ipapi.co fallback
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.city && data.latitude && data.longitude) {
        return {
          cityName: data.city,
          country: data.country_name || '',
          latitude: data.latitude,
          longitude: data.longitude,
          isDetected: true,
        };
      }
    }
  } catch (e) {
    console.warn('ipapi.co fallback failed:', e);
  }

  // Fallback if offline
  return {
    cityName: 'Accra',
    country: 'Ghana',
    latitude: 5.6037,
    longitude: -0.187,
    isDetected: false,
  };
}

// Manage Saved Cities in LocalStorage
export function loadSavedCities() {
  try {
    const raw = localStorage.getItem(SAVED_CITIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCityToStorage(city) {
  try {
    const list = loadSavedCities();
    // Check if city already exists (by name or coordinates)
    const exists = list.some(
      (c) => c.name.toLowerCase() === city.name.toLowerCase() && (!city.country || c.country === city.country)
    );
    if (!exists) {
      const updated = [
        ...list,
        {
          id: city.id || `${city.latitude}-${city.longitude}-${city.name}`,
          name: city.name,
          country: city.country || '',
          latitude: city.latitude,
          longitude: city.longitude,
          temp: city.temp ?? city.temperature,
          weatherCode: city.weatherCode,
          conditionIcon: city.conditionIcon,
          conditionText: city.conditionText,
        },
      ];
      localStorage.setItem(SAVED_CITIES_KEY, JSON.stringify(updated));
      return updated;
    }
    return list;
  } catch {
    return [];
  }
}

export function removeCityFromStorage(cityName) {
  try {
    const list = loadSavedCities();
    const updated = list.filter((c) => c.name.toLowerCase() !== cityName.toLowerCase());
    localStorage.setItem(SAVED_CITIES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function saveLastLocation(loc) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc));
  } catch {}
}

export function loadLastLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
