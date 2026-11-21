// Free, open-source weather and geocoding services using Open-Meteo (No API key needed)

const SAVED_CITIES_KEY = 'giochat_weather_saved_cities';
const LAST_LOCATION_KEY = 'giochat_weather_last_loc';

export const WEATHER_UI_TRANSLATIONS = {
  en: {
    weather: 'Weather',
    weatherAndForecast: 'Weather & Forecast',
    weatherSubtitle: 'Live real-time weather & city forecasts',
    searchCityPlaceholder: 'Search city (e.g. Accra, London, Tokyo, New York)...',
    detectMyLocation: 'Detect My Location',
    detecting: 'Detecting...',
    myLocation: 'My Location',
    inMyCities: 'In My Cities',
    addToMyCities: 'Add to My Cities',
    feelsLike: 'Feels like',
    humidity: 'Humidity',
    wind: 'Wind',
    highLow: 'High / Low',
    rainChance: 'Rain Chance',
    myCities: 'My Cities',
    tapCityTip: 'Tap a city to view its forecast',
    noSavedCities: "You haven't added any cities yet. Search a city above and click 'Add to My Cities' to pin it!",
    sevenDayForecast: '7-Day Forecast',
    fiveDayWeather: '5-Day Weather',
    fullForecast: 'Full Forecast & City Search',
    sunnyDryDays: 'Sunny & dry for the next 5 days ☀️',
    rainExpectedOn: 'Rain expected on {days} 🌧️',
    loadingWeather: 'Loading live weather...',
    noMatchingCities: 'No matching cities found',
    searchingCities: 'Searching cities...',
    today: 'Today',
  },
  es: {
    weather: 'Clima',
    weatherAndForecast: 'Clima y Pronóstico',
    weatherSubtitle: 'Clima en vivo y pronósticos de ciudades en tiempo real',
    searchCityPlaceholder: 'Buscar ciudad (ej. Madrid, Londres, Tokio, Nueva York)...',
    detectMyLocation: 'Detectar mi ubicación',
    detecting: 'Detectando...',
    myLocation: 'Mi ubicación',
    inMyCities: 'En mis ciudades',
    addToMyCities: 'Añadir a mis ciudades',
    feelsLike: 'Sensación térmica',
    humidity: 'Humedad',
    wind: 'Viento',
    highLow: 'Máx / Mín',
    rainChance: 'Prob. de lluvia',
    myCities: 'Mis ciudades',
    tapCityTip: 'Toca una ciudad para ver su pronóstico',
    noSavedCities: "Aún no has añadido ninguna ciudad. ¡Busca una ciudad arriba y pulsa 'Añadir a mis ciudades'!",
    sevenDayForecast: 'Pronóstico de 7 días',
    fiveDayWeather: 'Clima de 5 días',
    fullForecast: 'Pronóstico completo y búsqueda de ciudades',
    sunnyDryDays: 'Soleado y seco durante los próximos 5 días ☀️',
    rainExpectedOn: 'Lluvia esperada el {days} 🌧️',
    loadingWeather: 'Cargando clima en vivo...',
    noMatchingCities: 'No se encontraron ciudades',
    searchingCities: 'Buscando ciudades...',
    today: 'Hoy',
  },
  fr: {
    weather: 'Météo',
    weatherAndForecast: 'Météo et Prévisions',
    weatherSubtitle: 'Météo en direct et prévisions par ville',
    searchCityPlaceholder: 'Rechercher une ville (ex. Paris, Londres, Tokyo)...',
    detectMyLocation: 'Détecter ma position',
    detecting: 'Détection...',
    myLocation: 'Ma position',
    inMyCities: 'Dans mes villes',
    addToMyCities: 'Ajouter à mes villes',
    feelsLike: 'Ressenti',
    humidity: 'Humidité',
    wind: 'Vent',
    highLow: 'Max / Min',
    rainChance: 'Risque de pluie',
    myCities: 'Mes villes',
    tapCityTip: 'Appuyez sur une ville pour voir ses prévisions',
    noSavedCities: "Vous n'avez pas encore ajouté de ville. Recherchez une ville ci-dessus et cliquez sur 'Ajouter à mes villes' !",
    sevenDayForecast: 'Prévisions sur 7 jours',
    fiveDayWeather: 'Météo sur 5 jours',
    fullForecast: 'Prévisions complètes et recherche de villes',
    sunnyDryDays: 'Ensoleillé et sec pour les 5 prochains jours ☀️',
    rainExpectedOn: 'Pluie prévue {days} 🌧️',
    loadingWeather: 'Chargement de la météo...',
    noMatchingCities: 'Aucune ville trouvée',
    searchingCities: 'Recherche de villes...',
    today: "Aujourd'hui",
  },
  de: {
    weather: 'Wetter',
    weatherAndForecast: 'Wetter & Vorhersage',
    weatherSubtitle: 'Echtzeit-Wetter & Stadtvorhersagen',
    searchCityPlaceholder: 'Stadt suchen (z. B. Berlin, London, Tokio)...',
    detectMyLocation: 'Standort ermitteln',
    detecting: 'Ermittle...',
    myLocation: 'Mein Standort',
    inMyCities: 'In meinen Städten',
    addToMyCities: 'Zu meinen Städten',
    feelsLike: 'Gefühlt wie',
    humidity: 'Luftfeuchtigkeit',
    wind: 'Wind',
    highLow: 'Max / Min',
    rainChance: 'Regenrisiko',
    myCities: 'Meine Städte',
    tapCityTip: 'Tippe auf eine Stadt für die Vorhersage',
    noSavedCities: 'Du hast noch keine Städte hinzugefügt. Suche oben eine Stadt und klicke auf "Zu meinen Städten"!',
    sevenDayForecast: '7-Tage-Vorhersage',
    fiveDayWeather: '5-Tage-Wetter',
    fullForecast: 'Vollständige Vorhersage & Städtesuche',
    sunnyDryDays: 'Sonnig und trocken für die nächsten 5 Tage ☀️',
    rainExpectedOn: 'Regen erwartet am {days} 🌧️',
    loadingWeather: 'Live-Wetter wird geladen...',
    noMatchingCities: 'Keine passenden Städte gefunden',
    searchingCities: 'Städte werden gesucht...',
    today: 'Heute',
  },
  nl: {
    weather: 'Weer',
    weatherAndForecast: 'Weer & Voorspelling',
    weatherSubtitle: 'Live weer & weersverwachting per stad',
    searchCityPlaceholder: 'Zoek stad (bijv. Amsterdam, Londen, Tokio)...',
    detectMyLocation: 'Mijn locatie bepalen',
    detecting: 'Detecteren...',
    myLocation: 'Mijn locatie',
    inMyCities: 'In mijn steden',
    addToMyCities: 'Aan mijn steden toevoegen',
    feelsLike: 'Voelt als',
    humidity: 'Luchtvochtigheid',
    wind: 'Wind',
    highLow: 'Hoog / Laag',
    rainChance: 'Kans op regen',
    myCities: 'Mijn steden',
    tapCityTip: 'Tik op een stad om de voorspelling te zien',
    noSavedCities: 'Je hebt nog geen steden toegevoegd. Zoek hierboven een stad en voeg deze toe!',
    sevenDayForecast: '7-daagse voorspelling',
    fiveDayWeather: '5-daags weer',
    fullForecast: 'Volledige voorspelling & steden zoeken',
    sunnyDryDays: 'Zonnig en droog voor de komende 5 dagen ☀️',
    rainExpectedOn: 'Regen verwacht op {days} 🌧️',
    loadingWeather: 'Weer laden...',
    noMatchingCities: 'Geen steden gevonden',
    searchingCities: 'Steden zoeken...',
    today: 'Vandaag',
  },
  pt: {
    weather: 'Clima',
    weatherAndForecast: 'Clima e Previsão',
    weatherSubtitle: 'Clima ao vivo e previsões em tempo real',
    searchCityPlaceholder: 'Buscar cidade (ex. Lisboa, Londres, Tóquio)...',
    detectMyLocation: 'Detectar minha localização',
    detecting: 'Detectando...',
    myLocation: 'Minha localização',
    inMyCities: 'Nas minhas cidades',
    addToMyCities: 'Adicionar às minhas cidades',
    feelsLike: 'Sensação de',
    humidity: 'Umidade',
    wind: 'Vento',
    highLow: 'Máx / Mín',
    rainChance: 'Chance de chuva',
    myCities: 'Minhas cidades',
    tapCityTip: 'Toque em uma cidade para ver a previsão',
    noSavedCities: "Você ainda não adicionou cidades. Busque uma cidade acima e clique em 'Adicionar às minhas cidades'!",
    sevenDayForecast: 'Previsão para 7 dias',
    fiveDayWeather: 'Clima de 5 dias',
    fullForecast: 'Previsão completa e busca de cidades',
    sunnyDryDays: 'Ensolarado e seco para os próximos 5 dias ☀️',
    rainExpectedOn: 'Chuva esperada em {days} 🌧️',
    loadingWeather: 'Carregando clima...',
    noMatchingCities: 'Nenhuma cidade encontrada',
    searchingCities: 'Buscando cidades...',
    today: 'Hoje',
  },
  tw: {
    weather: 'Wiem Tebea',
    weatherAndForecast: 'Wiem Tebea & Nkɔmhyɛ',
    weatherSubtitle: 'Wiem tebea ankasa a ɛrekɔ so mprempren',
    searchCityPlaceholder: 'Hwehwɛ kuropɔn (sɛ ebia Accra, Kumasi, London)...',
    detectMyLocation: 'Hwehwɛ baabi a mewɔ',
    detecting: 'Ɛrehwehwɛ...',
    myLocation: 'Baabi a mewɔ',
    inMyCities: 'Wɔ me nkuropɔn mu',
    addToMyCities: 'Fa ka me nkuropɔn ho',
    feelsLike: 'Sɛnea ɛte',
    humidity: 'Awɔ / Ewiem nsuo',
    wind: 'Mframa',
    highLow: 'Kɛseɛ / Ketewa',
    rainChance: 'Sɛ nsuo bɛtɔ',
    myCities: 'Me Nkuropɔn',
    tapCityTip: 'Mia kuropɔn biara so na hwɛ ne nkɔmhyɛ',
    noSavedCities: 'Womfaa kuropɔn biara nkaa ho ɛ. Hwehwɛ kuropɔn wɔ atifi na fa ka ho!',
    sevenDayForecast: 'Nnanson Wiem Tebea',
    fiveDayWeather: 'Nna 5 Wiem Tebea',
    fullForecast: 'Wiem tebea nyinaa ne Nkuropɔn hwehwɛ',
    sunnyDryDays: 'Owia bɛbɔ na ewiem bɛyɛ wesee nna 5 a ɛreba yi ☀️',
    rainExpectedOn: 'Nsuo bɛtɔ {days} 🌧️',
    loadingWeather: 'Ɛrelod wiem tebea...',
    noMatchingCities: 'Kuropɔn biara nni hɔ',
    searchingCities: 'Ɛrehwehwɛ nkuropɔn...',
    today: 'Ɛnnɛ',
  },
};

const WMO_TRANSLATIONS = {
  0: {
    day: { en: 'Sunny', es: 'Soleado', fr: 'Ensoleillé', de: 'Sonnig', nl: 'Zonnig', pt: 'Ensolarado', tw: 'Owia rebɔ' },
    night: { en: 'Clear Sky', es: 'Cielo despejado', fr: 'Ciel dégagé', de: 'Klarer Himmel', nl: 'Heldere hemel', pt: 'Céu limpo', tw: 'Ewiem ate' },
    icon: (isDay) => isDay ? 'fa-solid fa-sun' : 'fa-solid fa-moon',
    color: (isDay) => isDay ? '#f59e0b' : '#a5b4fc',
  },
  1: {
    day: { en: 'Mostly Sunny', es: 'Mayormente soleado', fr: 'Plutôt ensoleillé', de: 'Meist sonnig', nl: 'Meestal zonnig', pt: 'Predomínio de sol', tw: 'Owia pua pua' },
    night: { en: 'Partly Cloudy', es: 'Parcialmente nublado', fr: 'Partiellement nuageux', de: 'Teilweise bewölkt', nl: 'Gedeeltelijk bewolkt', pt: 'Parcialmente nublado', tw: 'Omununkum kakra' },
    icon: (isDay) => isDay ? 'fa-solid fa-cloud-sun' : 'fa-solid fa-cloud-moon',
    color: '#38bdf8',
  },
  2: {
    all: { en: 'Partly Cloudy', es: 'Parcialmente nublado', fr: 'Partiellement nuageux', de: 'Teilweise bewölkt', nl: 'Gedeeltelijk bewolkt', pt: 'Parcialmente nublado', tw: 'Omununkum kakra' },
    icon: (isDay) => isDay ? 'fa-solid fa-cloud-sun' : 'fa-solid fa-cloud-moon',
    color: '#38bdf8',
  },
  3: {
    all: { en: 'Overcast', es: 'Nublado', fr: 'Couvert', de: 'Bedeckt', nl: 'Geheel bewolkt', pt: 'Encoberto', tw: 'Ewiem ayɛ kusuu' },
    icon: 'fa-solid fa-cloud',
    color: '#94a3b8',
  },
  45: {
    all: { en: 'Foggy', es: 'Niebla', fr: 'Brumeux', de: 'Nebelig', nl: 'Mistig', pt: 'Nevoeiro', tw: 'Kusukuwe' },
    icon: 'fa-solid fa-smog',
    color: '#a1a1aa',
  },
  48: {
    all: { en: 'Depositing Rime Fog', es: 'Niebla con escarcha', fr: 'Brouillard givrant', de: 'Reifnebel', nl: 'Rijpnevel', pt: 'Nevoeiro com geada', tw: 'Kusukuwe a emu yɛ den' },
    icon: 'fa-solid fa-smog',
    color: '#a1a1aa',
  },
  51: {
    all: { en: 'Light Drizzle', es: 'Llovizna ligera', fr: 'Bruine légère', de: 'Leichter Nieselregen', nl: 'Lichte motregen', pt: 'Garoa leve', tw: 'Nsuo kete kete' },
    icon: 'fa-solid fa-cloud-rain',
    color: '#60a5fa',
  },
  53: {
    all: { en: 'Moderate Drizzle', es: 'Llovizna moderada', fr: 'Bruine modérée', de: 'Mäßiger Nieselregen', nl: 'Matige motregen', pt: 'Garoa moderada', tw: 'Nsuo kete kete' },
    icon: 'fa-solid fa-cloud-rain',
    color: '#60a5fa',
  },
  55: {
    all: { en: 'Dense Drizzle', es: 'Llovizna densa', fr: 'Bruine dense', de: 'Dichter Nieselregen', nl: 'Dichte motregen', pt: 'Garoa densa', tw: 'Nsuo kete kete pii' },
    icon: 'fa-solid fa-cloud-rain',
    color: '#60a5fa',
  },
  56: {
    all: { en: 'Light Freezing Drizzle', es: 'Llovizna helada ligera', fr: 'Bruine verglaçante légère', de: 'Leichter Gefrierniesel', nl: 'Lichte aanvriezende motregen', pt: 'Garoa congelante leve', tw: 'Nsuo nwunu kete' },
    icon: 'fa-solid fa-snowflake',
    color: '#93c5fd',
  },
  57: {
    all: { en: 'Dense Freezing Drizzle', es: 'Llovizna helada densa', fr: 'Bruine verglaçante dense', de: 'Dichter Gefrierniesel', nl: 'Dichte aanvriezende motregen', pt: 'Garoa congelante densa', tw: 'Nsuo nwunu kete pii' },
    icon: 'fa-solid fa-snowflake',
    color: '#93c5fd',
  },
  61: {
    all: { en: 'Slight Rain', es: 'Lluvia ligera', fr: 'Pluie faible', de: 'Leichter Regen', nl: 'Lichte regen', pt: 'Chuva leve', tw: 'Nsuo ketewa bi' },
    icon: 'fa-solid fa-cloud-rain',
    color: '#3b82f6',
  },
  63: {
    all: { en: 'Moderate Rain', es: 'Lluvia moderada', fr: 'Pluie modérée', de: 'Mäßiger Regen', nl: 'Matige regen', pt: 'Chuva moderada', tw: 'Nsuo retɔ' },
    icon: 'fa-solid fa-cloud-rain',
    color: '#3b82f6',
  },
  65: {
    all: { en: 'Heavy Rain', es: 'Lluvia fuerte', fr: 'Forte pluie', de: 'Starker Regen', nl: 'Zware regen', pt: 'Chuva forte', tw: 'Nsuo kɛseɛ retɔ' },
    icon: 'fa-solid fa-cloud-showers-heavy',
    color: '#3b82f6',
  },
  66: {
    all: { en: 'Light Freezing Rain', es: 'Lluvia helada ligera', fr: 'Pluie verglaçante légère', de: 'Leichter Eisregen', nl: 'Lichte ijzel', pt: 'Chuva congelante leve', tw: 'Nsuo nwunu ketewa' },
    icon: 'fa-solid fa-icicles',
    color: '#67e8f9',
  },
  67: {
    all: { en: 'Heavy Freezing Rain', es: 'Lluvia helada fuerte', fr: 'Pluie verglaçante forte', de: 'Starker Eisregen', nl: 'Zware ijzel', pt: 'Chuva congelante forte', tw: 'Nsuo nwunu kɛseɛ' },
    icon: 'fa-solid fa-icicles',
    color: '#67e8f9',
  },
  71: {
    all: { en: 'Slight Snow', es: 'Nieve ligera', fr: 'Neige faible', de: 'Leichter Schneefall', nl: 'Lichte sneeuwval', pt: 'Neve leve', tw: 'Sukyerɛma ketewa' },
    icon: 'fa-solid fa-snowflake',
    color: '#bfdbfe',
  },
  73: {
    all: { en: 'Moderate Snow', es: 'Nieve moderada', fr: 'Neige modérée', de: 'Mäßiger Schneefall', nl: 'Matige sneeuwval', pt: 'Neve moderada', tw: 'Sukyerɛma retɔ' },
    icon: 'fa-solid fa-snowflake',
    color: '#bfdbfe',
  },
  75: {
    all: { en: 'Heavy Snow', es: 'Nieve fuerte', fr: 'Forte neige', de: 'Starker Schneefall', nl: 'Zware sneeuwval', pt: 'Neve forte', tw: 'Sukyerɛma kɛseɛ' },
    icon: 'fa-solid fa-snowflake',
    color: '#bfdbfe',
  },
  77: {
    all: { en: 'Snow Grains', es: 'Granos de nieve', fr: 'Grains de neige', de: 'Schneegriesel', nl: 'Sneeuwkorrels', pt: 'Grãos de neve', tw: 'Sukyerɛma nketenkete' },
    icon: 'fa-solid fa-snowflake',
    color: '#bfdbfe',
  },
  80: {
    all: { en: 'Slight Showers', es: 'Chubascos ligeros', fr: 'Averses faibles', de: 'Leichte Schauer', nl: 'Lichte buien', pt: 'Pancadas fracas', tw: 'Nsuo tɔ ntɛm' },
    icon: 'fa-solid fa-cloud-sun-rain',
    color: '#0ea5e9',
  },
  81: {
    all: { en: 'Moderate Showers', es: 'Chubascos moderados', fr: 'Averses modérées', de: 'Mäßige Schauer', nl: 'Matige buien', pt: 'Pancadas moderadas', tw: 'Nsuo tɔ ntɛm' },
    icon: 'fa-solid fa-cloud-sun-rain',
    color: '#0ea5e9',
  },
  82: {
    all: { en: 'Violent Showers', es: 'Chubascos violentos', fr: 'Averses violentes', de: 'Heftige Schauer', nl: 'Hevige buien', pt: 'Pancadas violentas', tw: 'Nsuo kɛseɛ tɔ ntɛm' },
    icon: 'fa-solid fa-cloud-showers-heavy',
    color: '#0ea5e9',
  },
  85: {
    all: { en: 'Light Snow Showers', es: 'Chubascos de nieve ligeros', fr: 'Faibles averses de neige', de: 'Leichte Schneeschauer', nl: 'Lichte sneeuwbuien', pt: 'Pancadas de neve leves', tw: 'Sukyerɛma a ɛretɔ' },
    icon: 'fa-solid fa-snowflake',
    color: '#93c5fd',
  },
  86: {
    all: { en: 'Heavy Snow Showers', es: 'Chubascos de nieve fuertes', fr: 'Fortes averses de neige', de: 'Starke Schneeschauer', nl: 'Zware sneeuwbuien', pt: 'Pancadas de neve fortes', tw: 'Sukyerɛma kɛseɛ a ɛretɔ' },
    icon: 'fa-solid fa-snowflake',
    color: '#93c5fd',
  },
  95: {
    all: { en: 'Thunderstorm', es: 'Tormenta eléctrica', fr: 'Orage', de: 'Gewitter', nl: 'Onweersbui', pt: 'Tempestade', tw: 'Anyinam ne aprannaa' },
    icon: 'fa-solid fa-cloud-bolt',
    color: '#eab308',
  },
  96: {
    all: { en: 'Thunderstorm with Hail', es: 'Tormenta con granizo', fr: 'Orage avec grêle', de: 'Gewitter mit Hagel', nl: 'Onweer met hagel', pt: 'Tempestade com granizo', tw: 'Aprannaa a asukɔtwee wom' },
    icon: 'fa-solid fa-cloud-bolt',
    color: '#eab308',
  },
  99: {
    all: { en: 'Severe Thunderstorm', es: 'Tormenta severa con granizo', fr: 'Orage violent avec grêle', de: 'Schweres Gewitter mit Hagel', nl: 'Zwaar onweer met hagel', pt: 'Tempestade severa', tw: 'Aprannaa kɛseɛ' },
    icon: 'fa-solid fa-cloud-bolt',
    color: '#eab308',
  },
};

export function getWmoInfo(code, isDay = 1, lang = 'en') {
  const normLang = (lang || 'en').toLowerCase().slice(0, 2);
  const entry = WMO_TRANSLATIONS[code] || WMO_TRANSLATIONS[0];
  const isDaytime = isDay === 1 || isDay === true;

  let label = '';
  if (entry.day && entry.night) {
    const textDict = isDaytime ? entry.day : entry.night;
    label = textDict[normLang] || textDict.en || 'Sunny';
  } else if (entry.all) {
    label = entry.all[normLang] || entry.all.en || 'Partly Cloudy';
  }

  const icon = typeof entry.icon === 'function' ? entry.icon(isDaytime) : entry.icon;
  const color = typeof entry.color === 'function' ? entry.color(isDaytime) : entry.color;

  return { label, icon, color };
}

export function getLocalizedDayName(dateObj, isToday, lang = 'en') {
  const normLang = (lang || 'en').toLowerCase().slice(0, 2);
  if (isToday) {
    const todayDict = {
      en: 'Today',
      es: 'Hoy',
      fr: "Aujourd'hui",
      de: 'Heute',
      nl: 'Vandaag',
      pt: 'Hoje',
      tw: 'Ɛnnɛ',
    };
    return todayDict[normLang] || 'Today';
  }

  if (normLang === 'tw') {
    const twiDays = ['Kwesida', 'Ɛdwoada', 'Ɛbenada', 'Wukuada', 'Yawoada', 'Efiada', 'Memeneda'];
    return twiDays[dateObj.getDay()] || 'Kwesida';
  }

  try {
    const localeMap = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      nl: 'nl-NL',
      pt: 'pt-BR',
    };
    const loc = localeMap[normLang] || 'en-US';
    const dayStr = dateObj.toLocaleDateString(loc, { weekday: 'short' });
    return dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
  } catch {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[dateObj.getDay()];
  }
}

// Search cities worldwide using Open-Meteo Geocoding
export async function searchCities(query, lang = 'en') {
  if (!query || query.trim().length < 2) return [];
  try {
    const normLang = (lang || 'en').toLowerCase().slice(0, 2);
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=8&language=${normLang}&format=json`;
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
export async function fetchWeather(lat, lon, cityName = '', countryName = '', lang = 'en') {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service unavailable');
    const data = await res.json();

    const current = data.current || {};
    const daily = data.daily || {};
    const wmo = getWmoInfo(current.weather_code, current.is_day, lang);

    const forecast = (daily.time || []).map((dateStr, index) => {
      const dateObj = new Date(dateStr);
      const isToday = index === 0;
      const dayName = getLocalizedDayName(dateObj, isToday, lang);
      const code = daily.weather_code ? daily.weather_code[index] : 0;
      const dayWmo = getWmoInfo(code, 1, lang);
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
