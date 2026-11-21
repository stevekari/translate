import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from './LanguageContext';
import {
  fetchWeather,
  getUserCoordinates,
  reverseGeocode,
  detectCurrentLivingCity,
  loadSavedCities,
  saveCityToStorage,
  removeCityFromStorage,
  loadLastLocation,
  saveLastLocation,
  searchCities,
  getWmoInfo,
  getLocalizedDayName,
  WEATHER_UI_TRANSLATIONS,
} from '../services/weatherService';

const WeatherContext = createContext();

export function WeatherProvider({ children }) {
  const { language } = useLanguage();
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

  // Translation helper for Weather UI
  const tWeather = useCallback(
    (key, params = {}) => {
      const normLang = (language || 'en').toLowerCase().slice(0, 2);
      const dict = WEATHER_UI_TRANSLATIONS[normLang] || WEATHER_UI_TRANSLATIONS.en;
      let text = dict[key] || WEATHER_UI_TRANSLATIONS.en[key] || key;
      if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        });
      }
      return text;
    },
    [language]
  );

  // Dynamically localize active weather condition and forecast day names when language changes
  const localizedWeather = useMemo(() => {
    if (!weather) return null;
    const normLang = (language || 'en').toLowerCase().slice(0, 2);
    const wmo = getWmoInfo(weather.weatherCode, weather.isDay ? 1 : 0, normLang);
    const forecast = (weather.forecast || []).map((day, idx) => {
      const isToday = idx === 0 || day.date === new Date().toISOString().split('T')[0];
      const dateObj = new Date(day.date);
      const dayWmo = getWmoInfo(day.weatherCode, 1, normLang);
      return {
        ...day,
        dayName: getLocalizedDayName(dateObj, isToday, normLang),
        label: dayWmo.label,
        icon: dayWmo.icon,
        color: dayWmo.color,
      };
    });

    return {
      ...weather,
      conditionText: wmo.label,
      conditionIcon: wmo.icon,
      conditionColor: wmo.color,
      forecast,
    };
  }, [weather, language]);

  // Dynamically localize condition labels of saved cities
  const localizedSavedCities = useMemo(() => {
    const normLang = (language || 'en').toLowerCase().slice(0, 2);
    return savedCities.map((c) => {
      if (c.weatherCode != null) {
        const wmo = getWmoInfo(c.weatherCode, 1, normLang);
        return {
          ...c,
          conditionText: wmo.label,
          conditionIcon: wmo.icon,
        };
      }
      return c;
    });
  }, [savedCities, language]);

  // Fetch weather for a coordinate and city name
  const loadWeatherForCoords = useCallback(
    async (lat, lon, cityName, countryName, isDetected = false) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchWeather(lat, lon, cityName, countryName, language);
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
    },
    [language]
  );

  // Search cities wrapped with current language
  const handleSearchCities = useCallback(
    (query) => {
      return searchCities(query, language);
    },
    [language]
  );

  // Detect location using GPS or instant IP location
  const detectLocation = useCallback(async () => {
    setIsDetecting(true);
    setError(null);
    try {
      const detected = await detectCurrentLivingCity();
      if (detected) {
        const res = await loadWeatherForCoords(
          detected.latitude,
          detected.longitude,
          detected.cityName,
          detected.country,
          true
        );
        return res;
      }
    } catch (err) {
      console.warn('Geolocation detection failed:', err);
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
  // Automatically detects and defaults to the user's current city living!
  useEffect(() => {
    let isMounted = true;

    async function initWeather() {
      // First, if there's a previously detected location, load it quickly
      const last = loadLastLocation();
      if (last && last.latitude && last.longitude && last.isDetected) {
        await loadWeatherForCoords(last.latitude, last.longitude, last.cityName, last.country, true);
      }

      // Automatically detect and update to user's current city living
      try {
        const currentLiving = await detectCurrentLivingCity();
        if (isMounted && currentLiving) {
          await loadWeatherForCoords(
            currentLiving.latitude,
            currentLiving.longitude,
            currentLiving.cityName,
            currentLiving.country,
            true
          );
        }
      } catch (e) {
        console.warn('Could not auto-detect living city on mount:', e);
      }
    }

    initWeather();

    return () => {
      isMounted = false;
    };
  }, [loadWeatherForCoords]);

  return (
    <WeatherContext.Provider
      value={{
        weather: localizedWeather || weather,
        loading,
        error,
        unit,
        toggleUnit,
        formatTemp,
        detectLocation,
        isDetecting,
        selectCity,
        searchCities: handleSearchCities,
        savedCities: localizedSavedCities,
        isCitySaved,
        toggleSaveCurrentCity,
        removeCity,
        showWeatherModal,
        setShowWeatherModal,
        openWeatherModal: () => setShowWeatherModal(true),
        closeWeatherModal: () => setShowWeatherModal(false),
        tWeather,
        language,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export const useWeather = () => useContext(WeatherContext);
