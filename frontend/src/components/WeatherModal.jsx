import { useState, useEffect, useRef } from 'react';
import { useWeather } from '../contexts/WeatherContext';

export default function WeatherModal() {
  const {
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
    closeWeatherModal,
    tWeather,
  } = useWeather();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchCities(query);
        setSearchResults(results);
        setShowDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchCities]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Esc to close modal
  useEffect(() => {
    if (!showWeatherModal) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        closeWeatherModal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWeatherModal, closeWeatherModal]);

  if (!showWeatherModal) return null;

  const handleSelectSearchResult = (city) => {
    selectCity(city);
    setQuery('');
    setShowDropdown(false);
  };

  const isCurrentSaved = weather ? isCitySaved(weather.cityName) : false;

  return (
    <div className="weather-modal-overlay" role="dialog" aria-modal="true" aria-label="Weather Forecast">
      <div className="weather-modal-backdrop" onClick={closeWeatherModal}></div>

      <div className="weather-modal-card">
        {/* Top Header */}
        <div className="weather-modal-header">
          <div className="weather-modal-title">
            <i className="fa-solid fa-cloud-sun weather-header-icon"></i>
            <div>
              <h3>{tWeather('weatherAndForecast')}</h3>
              <span className="weather-header-subtitle">{tWeather('weatherSubtitle')}</span>
            </div>
          </div>

          <div className="weather-header-actions">
            {/* Unit Toggle */}
            <button
              type="button"
              className="weather-unit-toggle"
              onClick={toggleUnit}
              title={`Switch to °${unit === 'C' ? 'F' : 'C'}`}
              aria-label="Toggle temperature unit"
            >
              <span className={`unit-pill ${unit === 'C' ? 'active' : ''}`}>°C</span>
              <span className={`unit-pill ${unit === 'F' ? 'active' : ''}`}>°F</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              className="weather-close-btn"
              onClick={closeWeatherModal}
              title="Close (Esc)"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Search & Location Detection Toolbar */}
        <div className="weather-search-toolbar">
          <div className="weather-search-wrapper" ref={searchRef}>
            <i className="fa-solid fa-magnifying-glass weather-search-icon"></i>
            <input
              type="text"
              className="weather-search-input"
              placeholder={tWeather('searchCityPlaceholder')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              aria-label="Search city"
            />
            {query && (
              <button
                type="button"
                className="weather-search-clear"
                onClick={() => {
                  setQuery('');
                  setSearchResults([]);
                }}
                aria-label="Clear search"
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}

            {/* Autocomplete Dropdown */}
            {showDropdown && (
              <div className="weather-search-dropdown">
                {isSearching && (
                  <div className="weather-search-loading">
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>{tWeather('searchingCities')}</span>
                  </div>
                )}
                {!isSearching && searchResults.length === 0 && query.trim().length >= 2 && (
                  <div className="weather-search-empty">
                    <span>{tWeather('noMatchingCities')}</span>
                  </div>
                )}
                {!isSearching &&
                  searchResults.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      className="weather-search-item"
                      onClick={() => handleSelectSearchResult(city)}
                    >
                      <i className="fa-solid fa-location-dot"></i>
                      <div className="weather-search-item-info">
                        <strong>{city.name}</strong>
                        <span>
                          {city.admin1 ? `${city.admin1}, ` : ''}
                          {city.country}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Detect Location Button */}
          <button
            type="button"
            className="weather-detect-btn"
            onClick={detectLocation}
            disabled={isDetecting}
            title={tWeather('detectMyLocation')}
            aria-label={tWeather('detectMyLocation')}
          >
            <i className={`fa-solid ${isDetecting ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
            <span>{isDetecting ? tWeather('detecting') : tWeather('detectMyLocation')}</span>
          </button>
        </div>

        {error && (
          <div className="weather-alert-banner">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        {loading && !weather && (
          <div className="weather-loading-card">
            <i className="fa-solid fa-cloud-sun fa-bounce"></i>
            <p>{tWeather('loadingWeather')}</p>
          </div>
        )}

        {/* Current Active Weather Hero */}
        {weather && (
          <div className="weather-hero-card">
            <div className="weather-hero-top">
              <div className="weather-location-details">
                <div className="weather-city-heading">
                  <h2>{weather.cityName}</h2>
                  {weather.isDetected && (
                    <span className="weather-badge-gps" title="Detected via GPS location">
                      <i className="fa-solid fa-location-arrow"></i> {tWeather('myLocation')}
                    </span>
                  )}
                </div>
                <p className="weather-country-name">
                  {weather.country ? weather.country : 'Current Region'}
                </p>
              </div>

              {/* Add / Save to My Cities Button */}
              <button
                type="button"
                className={`weather-save-city-btn ${isCurrentSaved ? 'saved' : ''}`}
                onClick={toggleSaveCurrentCity}
                title={isCurrentSaved ? tWeather('inMyCities') : tWeather('addToMyCities')}
                aria-label={isCurrentSaved ? tWeather('inMyCities') : tWeather('addToMyCities')}
              >
                <i className={`fa-${isCurrentSaved ? 'solid' : 'regular'} fa-star`}></i>
                <span>{isCurrentSaved ? tWeather('inMyCities') : tWeather('addToMyCities')}</span>
              </button>
            </div>

            <div className="weather-hero-main">
              <div className="weather-temp-group">
                <span className="weather-big-temp">{formatTemp(weather.temperature)}</span>
                <div className="weather-condition-desc">
                  <span className="weather-condition-text">{weather.conditionText}</span>
                  <span className="weather-feels-like">
                    {tWeather('feelsLike')} {formatTemp(weather.apparentTemperature)}
                  </span>
                </div>
              </div>

              <div className="weather-big-icon-wrap" style={{ color: weather.conditionColor }}>
                <i className={`${weather.conditionIcon} weather-hero-icon`}></i>
              </div>
            </div>

            {/* Quick Metrics (Humidity, Wind, High/Low) */}
            <div className="weather-metrics-grid">
              <div className="weather-metric-item">
                <i className="fa-solid fa-droplet metric-icon humidity"></i>
                <div className="metric-text">
                  <span className="metric-label">{tWeather('humidity')}</span>
                  <strong className="metric-value">{weather.humidity}%</strong>
                </div>
              </div>

              <div className="weather-metric-item">
                <i className="fa-solid fa-wind metric-icon wind"></i>
                <div className="metric-text">
                  <span className="metric-label">{tWeather('wind')}</span>
                  <strong className="metric-value">{weather.windSpeed} km/h</strong>
                </div>
              </div>

              <div className="weather-metric-item">
                <i className="fa-solid fa-temperature-arrow-up metric-icon temp-high"></i>
                <div className="metric-text">
                  <span className="metric-label">{tWeather('highLow')}</span>
                  <strong className="metric-value">
                    {weather.forecast?.[0]
                      ? `${formatTemp(weather.forecast[0].maxTemp)} / ${formatTemp(weather.forecast[0].minTemp)}`
                      : '--'}
                  </strong>
                </div>
              </div>

              <div className="weather-metric-item">
                <i className="fa-solid fa-cloud-rain metric-icon rain"></i>
                <div className="metric-text">
                  <span className="metric-label">{tWeather('rainChance')}</span>
                  <strong className="metric-value">
                    {weather.forecast?.[0]?.precipitationProb ?? 0}%
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* My Saved Cities Carousel / Section */}
        <div className="weather-saved-section">
          <div className="weather-saved-header">
            <h4>
              <i className="fa-solid fa-city"></i> {tWeather('myCities')} ({savedCities.length})
            </h4>
            <span className="weather-saved-tip">{tWeather('tapCityTip')}</span>
          </div>

          {savedCities.length === 0 ? (
            <div className="weather-no-saved-cities">
              <p>{tWeather('noSavedCities')}</p>
            </div>
          ) : (
            <div className="weather-saved-chips-scroll">
              {savedCities.map((city) => {
                const isActive = weather && weather.cityName.toLowerCase() === city.name.toLowerCase();
                return (
                  <div
                    key={city.id || city.name}
                    className={`weather-city-chip ${isActive ? 'active' : ''}`}
                    onClick={() => selectCity(city)}
                  >
                    <i className={city.conditionIcon || 'fa-solid fa-cloud-sun'}></i>
                    <div className="weather-chip-info">
                      <span className="weather-chip-name">{city.name}</span>
                      {city.temp != null && (
                        <span className="weather-chip-temp">{formatTemp(city.temp)}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="weather-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCity(city.name);
                      }}
                      title={`Remove ${city.name}`}
                      aria-label={`Remove ${city.name}`}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 7-Day Forecast */}
        {weather?.forecast && weather.forecast.length > 0 && (
          <div className="weather-forecast-section">
            <div className="weather-forecast-header">
              <h4>
                <i className="fa-solid fa-calendar-days"></i> {tWeather('sevenDayForecast')}
              </h4>
            </div>

            <div className="weather-forecast-grid">
              {weather.forecast.map((day) => (
                <div key={day.date} className={`weather-forecast-day-card ${day.date === new Date().toISOString().split('T')[0] ? 'is-today' : ''}`}>
                  <span className="forecast-day-name">{day.dayName}</span>
                  <i className={`${day.icon} forecast-day-icon`} style={{ color: day.color }}></i>
                  <span className="forecast-day-label">{day.label}</span>

                  {day.precipitationProb > 0 && (
                    <span className="forecast-rain-prob">
                      <i className="fa-solid fa-droplet"></i> {day.precipitationProb}%
                    </span>
                  )}

                  <div className="forecast-temps">
                    <span className="forecast-temp-max">{formatTemp(day.maxTemp)}</span>
                    <span className="forecast-temp-min">{formatTemp(day.minTemp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
