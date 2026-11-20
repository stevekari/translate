import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchWeather,
  getUserCoordinates,
  reverseGeocode,
  loadSavedCities,
  saveCityToStorage,
  removeCityFromStorage,
  loadLastLocation,
  saveLastLocation,
  searchCities,
} from '../services/weatherService';

const WeatherContext = createContext();

export function WeatherProvider({ children }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unit, setUnit] = useState(() => {
    try {
      return localStorage.getItem('giochat_weather_unit') || 'C';
    } catch {
      return 'C';
    }
  });
  const [savedCities, setSavedCities] = useState(() => loadSavedCities());
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  // Toggle °C / °F
  const toggleUnit = () => {
    setUnit((prev) => {
      const next = prev === 'C' ? 'F' : 'C';
      try {
        localStorage.setItem('giochat_weather_unit', next);
      } catch {}
      return next;
    });
  };

  const formatTemp = useCallback(
    (celsius) => {
      if (celsius == null) return '--';
      if (unit === 'F') {
        return `${Math.round((celsius * 9) / 5 + 32)}°F`;
      }
      return `${Math.round(celsius)}°C`;
    },
    [unit]
  );

  // Fetch weather for a coordinate and city name
  const loadWeatherForCoords = useCallback(async (lat, lon, cityName, countryName, isDetected = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWeather(lat, lon, cityName, countryName);
      result.isDetected = isDetected;
      setWeather(result);
      saveLastLocation({
        latitude: lat,
        longitude: lon,
        cityName: result.cityName,
        country: result.country,
        isDetected,
      });
      return result;
    } catch (err) {
      console.error('Failed to load weather:', err);
      setError('Unable to load weather forecast right now.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Detect location using browser Geolocation
  const detectLocation = useCallback(async () => {
    setIsDetecting(true);
    setError(null);
    try {
      const coords = await getUserCoordinates();
      const geo = await reverseGeocode(coords.latitude, coords.longitude);
      const res = await loadWeatherForCoords(
        coords.latitude,
        coords.longitude,
        geo.city,
        geo.country,
        true
      );
      return res;
    } catch (err) {
      console.warn('Geolocation failed or denied:', err);
      setError('Could not access your location. You can search for your city above.');
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, [loadWeatherForCoords]);

  // Select a city (from search result or saved list)
  const selectCity = useCallback(
    async (city) => {
      return await loadWeatherForCoords(
        city.latitude,
        city.longitude,
        city.name || city.cityName,
        city.country,
        false
      );
    },
    [loadWeatherForCoords]
  );

  // Check if active city is saved
  const isCitySaved = useCallback(
    (name) => {
      if (!name) return false;
      return savedCities.some((c) => c.name.toLowerCase() === name.toLowerCase());
    },
    [savedCities]
  );

  // Toggle save/unsave current weather city
  const toggleSaveCurrentCity = useCallback(() => {
    if (!weather) return;
    const name = weather.cityName;
    if (isCitySaved(name)) {
      const updated = removeCityFromStorage(name);
      setSavedCities(updated);
    } else {
      const updated = saveCityToStorage({
        name: weather.cityName,
        country: weather.country,
        latitude: weather.latitude,
        longitude: weather.longitude,
        temp: weather.temperature,
        weatherCode: weather.weatherCode,
        conditionIcon: weather.conditionIcon,
        conditionText: weather.conditionText,
      });
      setSavedCities(updated);
    }
  }, [weather, isCitySaved]);

  // Remove city from saved cities
  const removeCity = useCallback((cityName) => {
    const updated = removeCityFromStorage(cityName);
    setSavedCities(updated);
  }, []);

  // Initialize weather on first load:
  // 1. Check last location from localStorage
  // 2. Or try to auto-detect location
  // 3. Or default to a prominent city (e.g., London / Accra)
  useEffect(() => {
    const last = loadLastLocation();
    if (last && last.latitude && last.longitude) {
      loadWeatherForCoords(last.latitude, last.longitude, last.cityName, last.country, last.isDetected);
    } else {
      // Try soft detection, or fallback
      detectLocation().catch(() => {
        // Fallback default city (Accra / London)
        loadWeatherForCoords(5.6037, -0.187, 'Accra', 'Ghana', false);
      });
    }
  }, [loadWeatherForCoords, detectLocation]);

  return (
    <WeatherContext.Provider
      value={{
        weather,
        loading,
        error,
        unit,
        toggleUnit,
        formatTemp,
        detectLocation,
        isDetecting,
        selectCity,
        searchCities,
        savedCities,
        isCitySaved,
        toggleSaveCurrentCity,
        removeCity,
        showWeatherModal,
        setShowWeatherModal,
        openWeatherModal: () => setShowWeatherModal(true),
        closeWeatherModal: () => setShowWeatherModal(false),
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export const useWeather = () => useContext(WeatherContext);
