import { useState, useEffect, useRef } from 'react';
import { getLiveNews, FALLBACK_NEWS, NEWS_COUNTRIES, NEWS_CATEGORIES } from '../api/newsApi';
import '../styles/liveScoresAndNews.css';

// Extensive realistic database of 27 matches across major world leagues
const INITIAL_MATCHES = [
  // --- UEFA Champions League ---
  {
    id: 'ucl-1',
    league: 'UEFA Champions League',
    leagueFlag: '🏆',
    leagueCode: 'ucl',
    status: 'LIVE 78\'',
    minute: 78,
    isLive: true,
    homeTeam: 'Arsenal',
    homeCode: 'ARS',
    homeCrest: '🔴',
    homeScore: 2,
    awayTeam: 'Bayern Munich',
    awayCode: 'BAY',
    awayCrest: '⚪',
    awayScore: 1,
    scorers: [
      { player: 'Bukayo Saka', minute: "32'", team: 'home' },
      { player: 'Harry Kane (P)', minute: "45+2'", team: 'away' },
      { player: 'Declan Rice', minute: "74'", team: 'home' },
    ],
    stadium: 'Emirates Stadium, London',
    stats: {
      possession: [56, 44],
      shotsOnTarget: [7, 4],
      corners: [6, 3],
      fouls: [9, 11],
      yellowCards: [1, 2],
    },
    commentary: [
      { minute: "74'", text: '⚽ GOAL! Declan Rice scores a stunning curler from outside the penalty box!' },
      { minute: "68'", text: '🧤 Superb save by Raya denying Sané on the counter-attack.' },
      { minute: "45+2'", text: '⚽ GOAL! Harry Kane converts penalty into the bottom right corner.' },
      { minute: "32'", text: '⚽ GOAL! Bukayo Saka opens the scoring with a brilliant low strike!' },
    ],
  },
  {
    id: 'ucl-2',
    league: 'UEFA Champions League',
    leagueFlag: '🏆',
    leagueCode: 'ucl',
    status: 'LIVE 65\'',
    minute: 65,
    isLive: true,
    homeTeam: 'Real Madrid',
    homeCode: 'RMA',
    homeCrest: '👑',
    homeScore: 3,
    awayTeam: 'Manchester City',
    awayCode: 'MCI',
    awayCrest: '🩵',
    awayScore: 2,
    scorers: [
      { player: 'Bernardo Silva', minute: "2'", team: 'away' },
      { player: 'Camavinga', minute: "12'", team: 'home' },
      { player: 'Rodrygo', minute: "14'", team: 'home' },
      { player: 'Phil Foden', minute: "66'", team: 'away' },
      { player: 'Vinícius Jr', minute: "69'", team: 'home' },
    ],
    stadium: 'Santiago Bernabéu, Madrid',
    stats: {
      possession: [42, 58],
      shotsOnTarget: [8, 7],
      corners: [4, 8],
      fouls: [12, 8],
      yellowCards: [2, 1],
    },
    commentary: [
      { minute: "69'", text: '⚽ GOAL! Vinícius Jr restores Madrid’s lead after a blistering solo run!' },
      { minute: "66'", text: '⚽ GOAL! Phil Foden fires a thunderous rocket into the top corner!' },
      { minute: "14'", text: '⚽ GOAL! Rodrygo finishes a lightning-fast counter-attack!' },
      { minute: "12'", text: '⚽ GOAL! Camavinga shot deflects in for the equalizer!' },
      { minute: "2'", text: '⚽ GOAL! Bernardo Silva surprises the keeper with a clever free-kick!' },
    ],
  },
  {
    id: 'ucl-3',
    league: 'UEFA Champions League',
    leagueFlag: '🏆',
    leagueCode: 'ucl',
    status: 'LIVE 54\'',
    minute: 54,
    isLive: true,
    homeTeam: 'Paris Saint-Germain',
    homeCode: 'PSG',
    homeCrest: '🗼',
    homeScore: 2,
    awayTeam: 'Borussia Dortmund',
    awayCode: 'BVB',
    awayCrest: '🟡',
    awayScore: 0,
    scorers: [
      { player: 'Kylian Mbappé', minute: "22'", team: 'home' },
      { player: 'Ousmane Dembélé', minute: "49'", team: 'home' },
    ],
    stadium: 'Parc des Princes, Paris',
    stats: {
      possession: [61, 39],
      shotsOnTarget: [6, 2],
      corners: [7, 3],
      fouls: [8, 13],
      yellowCards: [1, 2],
    },
    commentary: [
      { minute: "49'", text: '⚽ GOAL! Dembélé cuts inside from the right and drills home into the roof of the net!' },
      { minute: "22'", text: '⚽ GOAL! Mbappé converts with a composed side-footed finish!' },
    ],
  },
  {
    id: 'ucl-4',
    league: 'UEFA Champions League',
    leagueFlag: '🏆',
    leagueCode: 'ucl',
    status: 'LIVE 82\'',
    minute: 82,
    isLive: true,
    homeTeam: 'Inter Milan',
    homeCode: 'INT',
    homeCrest: '⚫🔵',
    homeScore: 1,
    awayTeam: 'Atlético Madrid',
    awayCode: 'ATM',
    awayCrest: '🔴⚪',
    awayScore: 0,
    scorers: [
      { player: 'Lautaro Martínez', minute: "79'", team: 'home' },
    ],
    stadium: 'San Siro, Milan',
    stats: {
      possession: [53, 47],
      shotsOnTarget: [5, 3],
      corners: [5, 4],
      fouls: [11, 14],
      yellowCards: [2, 3],
    },
    commentary: [
      { minute: "79'", text: '⚽ GOAL! Lautaro pounces on the rebound after Oblak makes a heroic initial save!' },
    ],
  },
  {
    id: 'ucl-5',
    league: 'UEFA Champions League',
    leagueFlag: '🏆',
    leagueCode: 'ucl',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Barcelona',
    homeCode: 'BAR',
    homeCrest: '🔵🔴',
    homeScore: 3,
    awayTeam: 'Napoli',
    awayCode: 'NAP',
    awayCrest: '🔷',
    awayScore: 1,
    scorers: [
      { player: 'Fermín López', minute: "15'", team: 'home' },
      { player: 'João Cancelo', minute: "17'", team: 'home' },
      { player: 'Amir Rrahmani', minute: "30'", team: 'away' },
      { player: 'Robert Lewandowski', minute: "83'", team: 'home' },
    ],
    stadium: 'Estadi Olímpic Lluís Companys, Barcelona',
    stats: {
      possession: [58, 42],
      shotsOnTarget: [9, 4],
      corners: [6, 4],
      fouls: [7, 12],
      yellowCards: [1, 2],
    },
    commentary: [
      { minute: "90+4'", text: 'FULL TIME! Barcelona advance to the next round with authority!' },
      { minute: "83'", text: '⚽ GOAL! Lewandowski taps into the open net after a selfless pass from Sergi Roberto.' },
    ],
  },

  // --- Premier League ---
  {
    id: 'epl-1',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'LIVE 88\'',
    minute: 88,
    isLive: true,
    homeTeam: 'Liverpool',
    homeCode: 'LIV',
    homeCrest: '🔴',
    homeScore: 3,
    awayTeam: 'Chelsea',
    awayCode: 'CHE',
    awayCrest: '🔵',
    awayScore: 1,
    scorers: [
      { player: 'Mohamed Salah', minute: "18'", team: 'home' },
      { player: 'Luis Díaz', minute: "54'", team: 'home' },
      { player: 'Nicolas Jackson', minute: "68'", team: 'away' },
      { player: 'Dominik Szoboszlai', minute: "82'", team: 'home' },
    ],
    stadium: 'Anfield, Liverpool',
    stats: {
      possession: [59, 41],
      shotsOnTarget: [9, 3],
      corners: [7, 2],
      fouls: [8, 14],
      yellowCards: [1, 3],
    },
    commentary: [
      { minute: "82'", text: '⚽ GOAL! Szoboszlai seals the points with a diving header!' },
      { minute: "68'", text: '⚽ GOAL! Jackson pulls one back for Chelsea after a swift break.' },
      { minute: "54'", text: '⚽ GOAL! Luis Díaz pounces on a loose rebound in the box.' },
      { minute: "18'", text: '⚽ GOAL! Mohamed Salah chips the keeper with sublime composure.' },
    ],
  },
  {
    id: 'epl-2',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'LIVE 41\'',
    minute: 41,
    isLive: true,
    homeTeam: 'Manchester United',
    homeCode: 'MUN',
    homeCrest: '👹',
    homeScore: 2,
    awayTeam: 'Tottenham Hotspur',
    awayCode: 'TOT',
    awayCrest: '⚪',
    awayScore: 2,
    scorers: [
      { player: 'Rasmus Højlund', minute: "3'", team: 'home' },
      { player: 'Richarlison', minute: "19'", team: 'away' },
      { player: 'Marcus Rashford', minute: "40'", team: 'home' },
      { player: 'Rodrigo Bentancur', minute: "46'", team: 'away' },
    ],
    stadium: 'Old Trafford, Manchester',
    stats: {
      possession: [44, 56],
      shotsOnTarget: [5, 6],
      corners: [3, 7],
      fouls: [9, 8],
      yellowCards: [1, 1],
    },
    commentary: [
      { minute: "40'", text: '⚽ GOAL! Marcus Rashford slots a precise finish into the far corner!' },
      { minute: "19'", text: '⚽ GOAL! Richarlison heads home from a pinpoint corner kick!' },
      { minute: "3'", text: '⚽ GOAL! Højlund unleashes a missile with his left foot into the roof of the net!' },
    ],
  },
  {
    id: 'epl-3',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'LIVE 72\'',
    minute: 72,
    isLive: true,
    homeTeam: 'Newcastle United',
    homeCode: 'NEW',
    homeCrest: '⚫⚪',
    homeScore: 1,
    awayTeam: 'Aston Villa',
    awayCode: 'AVL',
    awayCrest: '🟣',
    awayScore: 0,
    scorers: [
      { player: 'Alexander Isak', minute: "51'", team: 'home' },
    ],
    stadium: 'St. James\' Park, Newcastle',
    stats: {
      possession: [48, 52],
      shotsOnTarget: [4, 3],
      corners: [5, 4],
      fouls: [10, 11],
      yellowCards: [2, 1],
    },
    commentary: [
      { minute: "51'", text: '⚽ GOAL! Isak speeds past the center back and chips Martinez!' },
    ],
  },
  {
    id: 'epl-4',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Brighton & Hove Albion',
    homeCode: 'BHA',
    homeCrest: '🌊',
    homeScore: 2,
    awayTeam: 'West Ham United',
    awayCode: 'WHU',
    awayCrest: '⚒️',
    awayScore: 1,
    scorers: [
      { player: 'Kaoru Mitoma', minute: "28'", team: 'home' },
      { player: 'Mohammed Kudus', minute: "63'", team: 'away' },
      { player: 'Evan Ferguson', minute: "84'", team: 'home' },
    ],
    stadium: 'Amex Stadium, Brighton',
    stats: {
      possession: [65, 35],
      shotsOnTarget: [8, 2],
      corners: [9, 3],
      fouls: [6, 12],
      yellowCards: [0, 3],
    },
    commentary: [
      { minute: "90+5'", text: 'FULL TIME! Brighton take all three points after an intense battle!' },
      { minute: "84'", text: '⚽ GOAL! Ferguson nods in from close range!' },
    ],
  },
  {
    id: 'epl-5',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Manchester City',
    homeCode: 'MCI',
    homeCrest: '🩵',
    homeScore: 4,
    awayTeam: 'Fulham',
    awayCode: 'FUL',
    awayCrest: '⚪',
    awayScore: 1,
    scorers: [
      { player: 'Julián Álvarez', minute: "31'", team: 'home' },
      { player: 'Tim Ream', minute: "33'", team: 'away' },
      { player: 'Erling Haaland', minute: "58'", team: 'home' },
      { player: 'Erling Haaland (P)', minute: "70'", team: 'home' },
      { player: 'Erling Haaland', minute: "90+5'", team: 'home' },
    ],
    stadium: 'Etihad Stadium, Manchester',
    stats: {
      possession: [71, 29],
      shotsOnTarget: [11, 2],
      corners: [10, 1],
      fouls: [5, 9],
      yellowCards: [1, 2],
    },
    commentary: [
      { minute: "90+5'", text: '⚽ HAT-TRICK! Haaland smashes home in stoppage time!' },
    ],
  },
  {
    id: 'epl-6',
    league: 'Premier League',
    leagueFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    leagueCode: 'epl',
    status: 'TODAY 20:45',
    minute: null,
    isLive: false,
    homeTeam: 'Wolverhampton',
    homeCode: 'WOL',
    homeCrest: '🐺',
    homeScore: 0,
    awayTeam: 'Everton',
    awayCode: 'EVE',
    awayCrest: '🔵',
    awayScore: 0,
    scorers: [],
    stadium: 'Molineux Stadium, Wolverhampton',
    stats: {
      possession: [50, 50],
      shotsOnTarget: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
    },
    commentary: [
      { minute: 'Pre-Match', text: 'Teams warming up under the floodlights at Molineux.' },
    ],
  },

  // --- La Liga ---
  {
    id: 'laliga-1',
    league: 'La Liga EA Sports',
    leagueFlag: '🇪🇸',
    leagueCode: 'laliga',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Barcelona',
    homeCode: 'BAR',
    homeCrest: '🔵🔴',
    homeScore: 2,
    awayTeam: 'Atlético Madrid',
    awayCode: 'ATM',
    awayCrest: '🔴⚪',
    awayScore: 1,
    scorers: [
      { player: 'Robert Lewandowski', minute: "24'", team: 'home' },
      { player: 'Álvaro Morata', minute: "52'", team: 'away' },
      { player: 'Lamine Yamal', minute: "88'", team: 'home' },
    ],
    stadium: 'Estadi Olímpic Lluís Companys, Barcelona',
    stats: {
      possession: [63, 37],
      shotsOnTarget: [6, 4],
      corners: [5, 4],
      fouls: [10, 16],
      yellowCards: [2, 4],
    },
    commentary: [
      { minute: "90+5'", text: 'FULL TIME! Barcelona hold on for a thrilling 2-1 victory!' },
      { minute: "88'", text: '⚽ GOAL! 16-year-old sensation Lamine Yamal curls home the winner!' },
    ],
  },
  {
    id: 'laliga-2',
    league: 'La Liga EA Sports',
    leagueFlag: '🇪🇸',
    leagueCode: 'laliga',
    status: 'LIVE 58\'',
    minute: 58,
    isLive: true,
    homeTeam: 'Real Sociedad',
    homeCode: 'RSO',
    homeCrest: '⚪🔵',
    homeScore: 1,
    awayTeam: 'Athletic Club',
    awayCode: 'ATH',
    awayCrest: '🔴⚪',
    awayScore: 1,
    scorers: [
      { player: 'Takefusa Kubo', minute: "30'", team: 'home' },
      { player: 'Nico Williams', minute: "44'", team: 'away' },
    ],
    stadium: 'Reale Arena, San Sebastián',
    stats: {
      possession: [51, 49],
      shotsOnTarget: [4, 4],
      corners: [4, 5],
      fouls: [14, 15],
      yellowCards: [3, 2],
    },
    commentary: [
      { minute: "44'", text: '⚽ GOAL! Nico Williams dazzles through the backline and fires home!' },
      { minute: "30'", text: '⚽ GOAL! Kubo with a clinical first-time finish into the bottom corner!' },
    ],
  },
  {
    id: 'laliga-3',
    league: 'La Liga EA Sports',
    leagueFlag: '🇪🇸',
    leagueCode: 'laliga',
    status: 'LIVE 36\'',
    minute: 36,
    isLive: true,
    homeTeam: 'Sevilla',
    homeCode: 'SEV',
    homeCrest: '⚪🔴',
    homeScore: 2,
    awayTeam: 'Real Betis',
    awayCode: 'BET',
    awayCrest: '🟢⚪',
    awayScore: 1,
    scorers: [
      { player: 'Youssef En-Nesyri', minute: "11'", team: 'home' },
      { player: 'Isco', minute: "24'", team: 'away' },
      { player: 'Lucas Ocampos', minute: "33'", team: 'home' },
    ],
    stadium: 'Ramón Sánchez-Pizjuán, Seville',
    stats: {
      possession: [46, 54],
      shotsOnTarget: [4, 3],
      corners: [3, 3],
      fouls: [12, 10],
      yellowCards: [2, 2],
    },
    commentary: [
      { minute: "33'", text: '⚽ GOAL! Lucas Ocampos hits an acrobatic volley in El Gran Derbi!' },
      { minute: "24'", text: '⚽ GOAL! Isco equalizes against his former club with pure magic!' },
    ],
  },
  {
    id: 'laliga-4',
    league: 'La Liga EA Sports',
    leagueFlag: '🇪🇸',
    leagueCode: 'laliga',
    status: 'TODAY 21:00',
    minute: null,
    isLive: false,
    homeTeam: 'Valencia',
    homeCode: 'VAL',
    homeCrest: '🦇',
    homeScore: 0,
    awayTeam: 'Villarreal',
    awayCode: 'VIL',
    awayCrest: '🟡',
    awayScore: 0,
    scorers: [],
    stadium: 'Mestalla, Valencia',
    stats: {
      possession: [50, 50],
      shotsOnTarget: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
    },
    commentary: [
      { minute: 'Pre-Match', text: 'Valencia derby ready for kickoff at Mestalla.' },
    ],
  },

  // --- Serie A ---
  {
    id: 'seriea-1',
    league: 'Serie A TIM',
    leagueFlag: '🇮🇹',
    leagueCode: 'seriea',
    status: 'LIVE 69\'',
    minute: 69,
    isLive: true,
    homeTeam: 'Juventus',
    homeCode: 'JUV',
    homeCrest: '⚪⚫',
    homeScore: 1,
    awayTeam: 'AC Milan',
    awayCode: 'MIL',
    awayCrest: '🔴⚫',
    awayScore: 1,
    scorers: [
      { player: 'Dušan Vlahović', minute: "38'", team: 'home' },
      { player: 'Rafael Leão', minute: "62'", team: 'away' },
    ],
    stadium: 'Allianz Stadium, Turin',
    stats: {
      possession: [47, 53],
      shotsOnTarget: [5, 4],
      corners: [5, 6],
      fouls: [11, 9],
      yellowCards: [2, 1],
    },
    commentary: [
      { minute: "62'", text: '⚽ GOAL! Rafael Leão sprints 50 yards and strokes it past Szczęsny!' },
      { minute: "38'", text: '⚽ GOAL! Vlahović powers home a header from Chiesa\'s cross.' },
    ],
  },
  {
    id: 'seriea-2',
    league: 'Serie A TIM',
    leagueFlag: '🇮🇹',
    leagueCode: 'seriea',
    status: 'LIVE 49\'',
    minute: 49,
    isLive: true,
    homeTeam: 'Napoli',
    homeCode: 'NAP',
    homeCrest: '🔷',
    homeScore: 2,
    awayTeam: 'AS Roma',
    awayCode: 'ROM',
    awayCrest: '🐺',
    awayScore: 1,
    scorers: [
      { player: 'Victor Osimhen', minute: "14'", team: 'home' },
      { player: 'Paulo Dybala (P)', minute: "35'", team: 'away' },
      { player: 'Khvicha Kvaratskhelia', minute: "47'", team: 'home' },
    ],
    stadium: 'Stadio Diego Armando Maradona, Naples',
    stats: {
      possession: [57, 43],
      shotsOnTarget: [6, 3],
      corners: [4, 3],
      fouls: [9, 13],
      yellowCards: [1, 3],
    },
    commentary: [
      { minute: "47'", text: '⚽ GOAL! Kvaradona cuts inside and blasts into the far upper corner!' },
    ],
  },
  {
    id: 'seriea-3',
    league: 'Serie A TIM',
    leagueFlag: '🇮🇹',
    leagueCode: 'seriea',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Lazio',
    homeCode: 'LAZ',
    homeCrest: '🦅',
    homeScore: 1,
    awayTeam: 'Fiorentina',
    awayCode: 'FIO',
    awayCrest: '🟣',
    awayScore: 1,
    scorers: [
      { player: 'Ciro Immobile', minute: "42'", team: 'home' },
      { player: 'Nicolás González', minute: "76'", team: 'away' },
    ],
    stadium: 'Stadio Olimpico, Rome',
    stats: {
      possession: [50, 50],
      shotsOnTarget: [4, 4],
      corners: [5, 5],
      fouls: [12, 11],
      yellowCards: [2, 2],
    },
    commentary: [
      { minute: "90+3'", text: 'FULL TIME! Points shared in a hard-fought battle in Rome.' },
    ],
  },

  // --- Bundesliga ---
  {
    id: 'bundes-1',
    league: 'Bundesliga',
    leagueFlag: '🇩🇪',
    leagueCode: 'bundesliga',
    status: 'LIVE 80\'',
    minute: 80,
    isLive: true,
    homeTeam: 'Bayer Leverkusen',
    homeCode: 'B04',
    homeCrest: '🔴⚫',
    homeScore: 3,
    awayTeam: 'RB Leipzig',
    awayCode: 'RBL',
    awayCrest: '⚪🔴',
    awayScore: 1,
    scorers: [
      { player: 'Florian Wirtz', minute: "19'", team: 'home' },
      { player: 'Jeremie Frimpong', minute: "35'", team: 'home' },
      { player: 'Loïs Openda', minute: "52'", team: 'away' },
      { player: 'Granit Xhaka', minute: "73'", team: 'home' },
    ],
    stadium: 'BayArena, Leverkusen',
    stats: {
      possession: [62, 38],
      shotsOnTarget: [8, 3],
      corners: [7, 4],
      fouls: [8, 10],
      yellowCards: [1, 2],
    },
    commentary: [
      { minute: "73'", text: '⚽ GOAL! Granit Xhaka rifles a 30-yard thunderbolt into the top corner!' },
    ],
  },
  {
    id: 'bundes-2',
    league: 'Bundesliga',
    leagueFlag: '🇩🇪',
    leagueCode: 'bundesliga',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Eintracht Frankfurt',
    homeCode: 'SGE',
    homeCrest: '🦅',
    homeScore: 3,
    awayTeam: 'VfB Stuttgart',
    awayCode: 'VFB',
    awayCrest: '⚪🔴',
    awayScore: 2,
    scorers: [
      { player: 'Omar Marmoush', minute: "17'", team: 'home' },
      { player: 'Serhou Guirassy', minute: "39'", team: 'away' },
      { player: 'Hugo Ekitike', minute: "61'", team: 'home' },
      { player: 'Deniz Undav', minute: "77'", team: 'away' },
      { player: 'Mario Götze', minute: "89'", team: 'home' },
    ],
    stadium: 'Deutsche Bank Park, Frankfurt',
    stats: {
      possession: [46, 54],
      shotsOnTarget: [7, 6],
      corners: [6, 8],
      fouls: [10, 8],
      yellowCards: [2, 1],
    },
    commentary: [
      { minute: "90+4'", text: 'FULL TIME! Thrilling 5-goal thriller ends in Frankfurt victory!' },
      { minute: "89'", text: '⚽ GOAL! Mario Götze chips the keeper in the 89th minute for the win!' },
    ],
  },

  // --- Ligue 1 ---
  {
    id: 'ligue1-1',
    league: 'Ligue 1 McDonald\'s',
    leagueFlag: '🇫🇷',
    leagueCode: 'ligue1',
    status: 'LIVE 62\'',
    minute: 62,
    isLive: true,
    homeTeam: 'Olympique Marseille',
    homeCode: 'OM',
    homeCrest: '⚪🔵',
    homeScore: 2,
    awayTeam: 'Olympique Lyonnais',
    awayCode: 'OL',
    awayCrest: '🔴🔵',
    awayScore: 1,
    scorers: [
      { player: 'Pierre-Emerick Aubameyang', minute: "21'", team: 'home' },
      { player: 'Alexandre Lacazette', minute: "38'", team: 'away' },
      { player: 'Mason Greenwood', minute: "55'", team: 'home' },
    ],
    stadium: 'Orange Vélodrome, Marseille',
    stats: {
      possession: [54, 46],
      shotsOnTarget: [6, 4],
      corners: [7, 5],
      fouls: [14, 15],
      yellowCards: [3, 4],
    },
    commentary: [
      { minute: "55'", text: '⚽ GOAL! Greenwood curls into the side netting in the Choc des Olympiques!' },
    ],
  },
  {
    id: 'ligue1-2',
    league: 'Ligue 1 McDonald\'s',
    leagueFlag: '🇫🇷',
    leagueCode: 'ligue1',
    status: 'TODAY 21:00',
    minute: null,
    isLive: false,
    homeTeam: 'AS Monaco',
    homeCode: 'ASM',
    homeCrest: '🔴⚪',
    homeScore: 0,
    awayTeam: 'Lille OSC',
    awayCode: 'LOSC',
    awayCrest: '🔴⚪',
    awayScore: 0,
    scorers: [],
    stadium: 'Stade Louis II, Monaco',
    stats: {
      possession: [50, 50],
      shotsOnTarget: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
    },
    commentary: [
      { minute: 'Pre-Match', text: 'Top 4 clash kickoff in Monaco shortly.' },
    ],
  },

  // --- International / World ---
  {
    id: 'intl-1',
    league: 'World Cup Qualifier',
    leagueFlag: '🌍',
    leagueCode: 'intl',
    status: 'LIVE 75\'',
    minute: 75,
    isLive: true,
    homeTeam: 'Brazil',
    homeCode: 'BRA',
    homeCrest: '🇧🇷',
    homeScore: 1,
    awayTeam: 'Argentina',
    awayCode: 'ARG',
    awayCrest: '🇦🇷',
    awayScore: 2,
    scorers: [
      { player: 'Lionel Messi', minute: "19'", team: 'away' },
      { player: 'Vinícius Jr', minute: "42'", team: 'home' },
      { player: 'Julián Álvarez', minute: "68'", team: 'away' },
    ],
    stadium: 'Maracanã, Rio de Janeiro',
    stats: {
      possession: [52, 48],
      shotsOnTarget: [6, 5],
      corners: [5, 4],
      fouls: [16, 18],
      yellowCards: [4, 4],
    },
    commentary: [
      { minute: "68'", text: '⚽ GOAL! Álvarez finishes a breathtaking one-touch team move at the Maracanã!' },
      { minute: "42'", text: '⚽ GOAL! Vinícius Jr equalizes with a blistering sprint and finish!' },
      { minute: "19'", text: '⚽ GOAL! Lionel Messi curls an exquisite 25-yard free-kick into the top corner!' },
    ],
  },
  {
    id: 'intl-2',
    league: 'African International Match',
    leagueFlag: '🌍',
    leagueCode: 'intl',
    status: 'LIVE 60\'',
    minute: 60,
    isLive: true,
    homeTeam: 'Ghana',
    homeCode: 'GHA',
    homeCrest: '🇬🇭',
    homeScore: 2,
    awayTeam: 'Nigeria',
    awayCode: 'NGA',
    awayCrest: '🇳🇬',
    awayScore: 1,
    scorers: [
      { player: 'Mohammed Kudus', minute: "26'", team: 'home' },
      { player: 'Victor Osimhen', minute: "43'", team: 'away' },
      { player: 'Jordan Ayew', minute: "57'", team: 'home' },
    ],
    stadium: 'Baba Yara Stadium, Kumasi',
    stats: {
      possession: [51, 49],
      shotsOnTarget: [5, 4],
      corners: [4, 4],
      fouls: [14, 16],
      yellowCards: [2, 3],
    },
    commentary: [
      { minute: "57'", text: '⚽ GOAL! Jordan Ayew slots home with composure to give the Black Stars the lead!' },
      { minute: "43'", text: '⚽ GOAL! Victor Osimhen leaps high above the defense to nod in the equalizer!' },
      { minute: "26'", text: '⚽ GOAL! Kudus fires a left-footed rocket into the top corner!' },
    ],
  },
  {
    id: 'intl-3',
    league: 'European Championship',
    leagueFlag: '🌍',
    leagueCode: 'intl',
    status: 'FT',
    minute: 90,
    isLive: false,
    homeTeam: 'Portugal',
    homeCode: 'POR',
    homeCrest: '🇵🇹',
    homeScore: 2,
    awayTeam: 'Spain',
    awayCode: 'ESP',
    awayCrest: '🇪🇸',
    awayScore: 2,
    scorers: [
      { player: 'Cristiano Ronaldo', minute: "16'", team: 'home' },
      { player: 'Álvaro Morata', minute: "34'", team: 'away' },
      { player: 'Bruno Fernandes', minute: "67'", team: 'home' },
      { player: 'Lamine Yamal', minute: "86'", team: 'away' },
    ],
    stadium: 'Estádio da Luz, Lisbon',
    stats: {
      possession: [45, 55],
      shotsOnTarget: [6, 7],
      corners: [5, 6],
      fouls: [11, 10],
      yellowCards: [2, 1],
    },
    commentary: [
      { minute: "90+4'", text: 'FULL TIME! An unforgettable 2-2 spectacle in the Iberian Derby!' },
      { minute: "86'", text: '⚽ GOAL! Lamine Yamal equalizes in the dying minutes with a wonder strike!' },
    ],
  },
];

export default function LiveFootballAndNews() {
  const [activeTab, setActiveTab] = useState('football'); // 'football' | 'news' | 'trends'
  const [matches, setMatches] = useState(INITIAL_MATCHES);
  const [newsList, setNewsList] = useState(FALLBACK_NEWS);
  const [newsLoading, setNewsLoading] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState('all'); // 'all' | 'live' | 'ucl' | 'epl' | 'laliga' | 'seriea' | 'bundesliga' | 'ligue1' | 'intl'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'live' | 'ft' | 'upcoming'
  const [matchSearch, setMatchSearch] = useState('');
  const [newsFilter, setNewsFilter] = useState('all'); // 'all' | 'Football' | 'Tech' | 'World'
  const [newsCountry, setNewsCountry] = useState(() => {
    const saved = localStorage.getItem('gio_news_country');
    if (!saved || saved === 'WORLD') return 'ALL';
    return saved;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Just now');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef(null);

  // Live match minute ticker (updates live matches realistically)
  useEffect(() => {
    const interval = setInterval(() => {
      setMatches((prevMatches) =>
        prevMatches.map((m) => {
          if (m.isLive && m.minute && m.minute < 90) {
            const nextMin = m.minute + 1;
            return {
              ...m,
              minute: nextMin,
              status: nextMin >= 90 ? 'FT' : `LIVE ${nextMin}'`,
              isLive: nextMin < 90,
            };
          }
          return m;
        })
      );
    }, 45000); // 45s tick

    return () => clearInterval(interval);
  }, []);

  // Fetch live breaking news whenever category or country changes
  useEffect(() => {
    let isMounted = true;
    const fetchNews = async () => {
      setNewsLoading(true);
      try {
        const data = await getLiveNews(newsFilter, newsCountry);
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setNewsList(data);
          setLastUpdated('Just now');
        }
      } catch (err) {
        console.warn('Live news fetch failed:', err);
      } finally {
        if (isMounted) setNewsLoading(false);
      }
    };

    fetchNews();

    return () => {
      isMounted = false;
    };
  }, [newsFilter, newsCountry]);

  // Handle scroll detection for Scroll-to-Top button
  const handleScroll = (e) => {
    if (e.target.scrollTop > 200) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCountryChange = (countryCode) => {
    setNewsCountry(countryCode);
    localStorage.setItem('gio_news_country', countryCode);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await getLiveNews(newsFilter, newsCountry, true);
      if (data && data.length > 0) {
        setNewsList(data);
      }
      setLastUpdated('Just now');
      // Increment live match minutes and refresh ticker
      setMatches((prev) =>
        prev.map((m) => {
          if (m.isLive && m.minute) {
            return {
              ...m,
              minute: Math.min(89, m.minute + 1),
              status: `LIVE ${Math.min(89, m.minute + 1)}'`,
            };
          }
          return m;
        })
      );
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter matches by League, Status, and Search Query
  const filteredMatches = matches.filter((m) => {
    // 1. League Filter
    if (leagueFilter === 'live' && !m.isLive) return false;
    if (leagueFilter !== 'all' && leagueFilter !== 'live' && m.leagueCode !== leagueFilter) {
      return false;
    }

    // 2. Status Filter
    if (statusFilter === 'live' && !m.isLive) return false;
    if (statusFilter === 'ft' && m.status !== 'FT') return false;
    if (statusFilter === 'upcoming' && (m.isLive || m.status === 'FT')) return false;

    // 3. Search Query Filter
    if (matchSearch.trim()) {
      const q = matchSearch.trim().toLowerCase();
      const matchText = `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.homeCode} ${m.awayCode} ${m.stadium}`.toLowerCase();
      const scorerText = m.scorers.map((s) => s.player).join(' ').toLowerCase();
      return matchText.includes(q) || scorerText.includes(q);
    }

    return true;
  });

  const liveMatchesCount = matches.filter((m) => m.isLive).length;
  const activeCountryObj = NEWS_COUNTRIES.find((c) => c.code === newsCountry) || NEWS_COUNTRIES[0];

  return (
    <div className="sidebar-card live-hub-card">
      {/* Segmented Top Tab Switcher */}
      <div className="live-hub-tabs-row">
        <button
          type="button"
          className={`live-hub-tab-btn ${activeTab === 'football' ? 'active' : ''}`}
          onClick={() => setActiveTab('football')}
        >
          <span>⚽ Live Scores</span>
          {liveMatchesCount > 0 && (
            <span className="live-tab-badge pulse-red">{liveMatchesCount} LIVE</span>
          )}
        </button>

        <button
          type="button"
          className={`live-hub-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          <span>🌍 World News</span>
        </button>

        <button
          type="button"
          className={`live-hub-tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          <span>🔥 Trends</span>
        </button>
      </div>

      {/* Subheader with Refresh Tool */}
      <div className="live-hub-subbar">
        <span className="live-hub-updated-text">
          <i className="fa-solid fa-clock"></i> {lastUpdated}
        </span>
        <button
          type="button"
          className="live-hub-refresh-btn"
          onClick={handleManualRefresh}
          title="Refresh Live Scores & News"
          aria-label="Refresh"
        >
          <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin' : ''}`}></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LIVE FOOTBALL SCORES & EXTENSIVE SCROLLABLE SCOREBOARD
          ========================================================================= */}
      {activeTab === 'football' && (
        <div className="football-feed-section">
          {/* Live Summary Banner */}
          <div className="football-summary-banner">
            <div className="football-live-count-pill">
              <span className="status-live-dot" />
              <span>{liveMatchesCount} Matches Currently Live</span>
            </div>
            <span className="football-total-badge">{matches.length} Total Matches</span>
          </div>

          {/* Quick Search Bar */}
          <div className="football-search-wrapper">
            <i className="fa-solid fa-magnifying-glass search-icon" />
            <input
              type="text"
              className="football-search-input"
              value={matchSearch}
              onChange={(e) => setMatchSearch(e.target.value)}
              placeholder="Search team, league or player..."
            />
            {matchSearch && (
              <button
                type="button"
                className="football-search-clear"
                onClick={() => setMatchSearch('')}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Status Quick Filter Buttons */}
          <div className="football-status-filter-row">
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({matches.length})
            </button>
            <button
              type="button"
              className={`status-pill-btn live ${statusFilter === 'live' ? 'active' : ''}`}
              onClick={() => setStatusFilter('live')}
            >
              🔴 Live ({liveMatchesCount})
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'ft' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ft')}
            >
              Finished ({matches.filter((m) => m.status === 'FT').length})
            </button>
            <button
              type="button"
              className={`status-pill-btn ${statusFilter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setStatusFilter('upcoming')}
            >
              Scheduled ({matches.filter((m) => !m.isLive && m.status !== 'FT').length})
            </button>
          </div>

          {/* League Filter Chips (Scrollable) */}
          <div className="football-chips-row">
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'all' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('all')}
            >
              All Leagues
            </button>
            <button
              type="button"
              className={`football-chip live-chip ${leagueFilter === 'live' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('live')}
            >
              🔴 Live Only
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'ucl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('ucl')}
            >
              🏆 Champions League
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'epl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('epl')}
            >
              🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'laliga' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('laliga')}
            >
              🇪🇸 La Liga
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'seriea' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('seriea')}
            >
              🇮🇹 Serie A
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'bundesliga' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('bundesliga')}
            >
              🇩🇪 Bundesliga
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'ligue1' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('ligue1')}
            >
              🇫🇷 Ligue 1
            </button>
            <button
              type="button"
              className={`football-chip ${leagueFilter === 'intl' ? 'active' : ''}`}
              onClick={() => setLeagueFilter('intl')}
            >
              🌍 International
            </button>
          </div>

          {/* Scrollable Matches Viewport Container */}
          <div
            className="football-matches-scroll-container"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            {filteredMatches.length === 0 ? (
              <div className="football-empty-state">
                <i className="fa-solid fa-futbol empty-icon" />
                <p>No matches found matching your filters</p>
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={() => {
                    setLeagueFilter('all');
                    setStatusFilter('all');
                    setMatchSearch('');
                  }}
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <div className="football-matches-list">
                {filteredMatches.map((m) => {
                  const homeLeading = m.homeScore > m.awayScore;
                  const awayLeading = m.awayScore > m.homeScore;

                  return (
                    <div
                      key={m.id}
                      className={`football-match-card ${m.isLive ? 'is-live-card' : ''}`}
                      onClick={() => setSelectedMatch(m)}
                      title="Click for full match stats, lineups & live commentary"
                    >
                      {/* Competition Bar */}
                      <div className="match-comp-row">
                        <span className="match-league-name">
                          {m.leagueFlag} {m.league}
                        </span>
                        <span
                          className={`match-status-badge ${
                            m.isLive ? 'live-badge' : m.status === 'FT' ? 'ft-badge' : 'upcoming-badge'
                          }`}
                        >
                          {m.isLive && <span className="status-live-dot" />}
                          {m.status}
                        </span>
                      </div>

                      {/* Teams & Live Score Row */}
                      <div className="match-score-board">
                        {/* Home Team */}
                        <div className={`team-col home-col ${homeLeading ? 'is-winner' : ''}`}>
                          <span className="team-crest">{m.homeCrest}</span>
                          <span className="team-name">{m.homeTeam}</span>
                        </div>

                        {/* Score Center */}
                        <div className="score-center-col">
                          {m.status.includes('TODAY') ? (
                            <span className="match-time-upcoming">{m.status.replace('TODAY ', '')}</span>
                          ) : (
                            <div className={`score-pill ${m.isLive ? 'live-score-pill' : ''}`}>
                              <span className={`score-num ${homeLeading ? 'winner-num' : ''}`}>
                                {m.homeScore}
                              </span>
                              <span className="score-divider">-</span>
                              <span className={`score-num ${awayLeading ? 'winner-num' : ''}`}>
                                {m.awayScore}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Away Team */}
                        <div className={`team-col away-col ${awayLeading ? 'is-winner' : ''}`}>
                          <span className="team-crest">{m.awayCrest}</span>
                          <span className="team-name">{m.awayTeam}</span>
                        </div>
                      </div>

                      {/* Scorers Summary Bar */}
                      {m.scorers.length > 0 && (
                        <div className="match-scorers-ticker">
                          <i className="fa-solid fa-futbol" />
                          <span className="scorers-text">
                            {m.scorers.map((s, idx) => (
                              <span key={idx} className="scorer-item">
                                {s.player} {s.minute}
                                {idx < m.scorers.length - 1 ? ' • ' : ''}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scroll to Top Floating Button */}
          {showScrollTop && (
            <button
              type="button"
              className="football-scroll-top-btn"
              onClick={scrollToTop}
              title="Scroll to top of scores"
              aria-label="Scroll to top"
            >
              <i className="fa-solid fa-arrow-up" />
            </button>
          )}

          {/* Footer count indicator */}
          <div className="football-footer-indicator">
            <span>Showing {filteredMatches.length} of {matches.length} matches • Tap match for live stats</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: REAL-WORLD BREAKING NEWS (X-STYLE FEED)
          ========================================================================= */}
      {activeTab === 'news' && (
        <div className="news-feed-section">
          {/* Country Selection & Live Status Subbar */}
          <div className="sidebar-news-country-row">
            <div className="news-country-select-wrap">
              <i className="fa-solid fa-location-dot country-pin-icon"></i>
              <select
                className="news-country-select"
                value={newsCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                title="Filter news by country"
              >
                {NEWS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={`live-hub-refresh-btn ${isRefreshing ? 'is-spinning' : ''}`}
              onClick={handleManualRefresh}
              title="Refresh live news"
              disabled={newsLoading || isRefreshing}
            >
              <i className={`fa-solid fa-arrows-rotate ${isRefreshing || newsLoading ? 'fa-spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
          </div>

          {/* News Category Filter Chips */}
          <div className="football-chips-row">
            {NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`football-chip ${newsFilter === cat.id ? 'active' : ''}`}
                onClick={() => setNewsFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Live Status indicator */}
          <div className="x-news-live-banner">
            <span className="x-news-live-dot"></span>
            <span>Live {activeCountryObj?.code === 'ALL' ? 'Mixed Countries' : (activeCountryObj?.name || 'Global')} Feed</span>
            <span className="x-news-source-hint">• Auto-updates</span>
          </div>

          {/* News Articles List */}
          {newsLoading ? (
            <div className="news-loading-spinner">
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <span>Fetching live headlines...</span>
            </div>
          ) : (
            <div className="x-news-feed-list">
              {newsList.map((article) => (
                <article
                  key={article.id}
                  className="x-post-card"
                  onClick={() => setSelectedArticle(article)}
                  title="Click to expand story preview"
                >
                  {/* Top row: Avatar + Outlet + Verified + Handle + Time */}
                  <div className="x-post-header">
                    <div className="x-post-avatar" title={article.source}>
                      {article.sourceLogo || '📰'}
                    </div>
                    <div className="x-post-user-info">
                      <span className="x-post-name">{article.source}</span>
                      {article.verified && (
                        <span className="x-post-verified" title="Verified News Outlet">
                          <i className="fa-solid fa-circle-check"></i>
                        </span>
                      )}
                      {article.country && article.country !== 'WORLD' && (
                        <span className="news-country-pill" title={`From ${article.country}`}>
                          {article.sourceLogo || '🌍'} {article.country}
                        </span>
                      )}
                      <span className="x-post-handle">{article.handle || '@news'}</span>
                      <span className="x-post-dot">·</span>
                      <span className="x-post-time">{article.timeAgo}</span>
                    </div>
                    <span className="x-post-cat-badge">{article.category}</span>
                  </div>

                  {/* X Post Content: Punchy Headline & Short Text */}
                  <div className="x-post-content">
                    <h4 className="x-post-headline">{article.title}</h4>
                    {article.summary && (
                      <p className="x-post-snippet">{article.summary}</p>
                    )}
                  </div>

                  {/* Optional Media Thumbnail */}
                  {article.imageUrl && (
                    <div className="x-post-media-wrap">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        className="x-post-media"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* X Post Action / Footer Row with Original Link */}
                  <div className="x-post-footer">
                    <div className="x-post-stats">
                      <span className="x-stat-item" title="Engagement">
                        <i className="fa-regular fa-heart"></i> {article.likes || 142}
                      </span>
                      <span className="x-stat-item" title="Reposts">
                        <i className="fa-solid fa-repeat"></i> {article.reposts || 38}
                      </span>
                    </div>

                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="x-post-link-btn"
                        title="Open original website article in new tab"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Read on {article.source?.split(' ')[0] || 'Web'}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: COMMUNITY TRENDING
          ========================================================================= */}
      {activeTab === 'trends' && (
        <div className="trending-list">
          <div className="trending-item">
            <span className="trending-category">Technology • Trending Worldwide</span>
            <strong>#AITranslation</strong>
            <span className="trending-count">34.2K posts • Real-time dialect translation</span>
          </div>
          <div className="trending-item">
            <span className="trending-category">Football & Sports • Trending</span>
            <strong>#ChampionsLeague</strong>
            <span className="trending-count">148.5K posts • Quarter-final drama</span>
          </div>
          <div className="trending-item">
            <span className="trending-category">Social • Trending</span>
            <strong>#GioVideoMoments</strong>
            <span className="trending-count">22.8K posts • Video note reactions</span>
          </div>
          <div className="trending-item">
            <span className="trending-category">Community • Trending</span>
            <strong>#GlobalFriends</strong>
            <span className="trending-count">19.5K posts • Cross-border conversations</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: MATCH STATS & COMMENTARY DETAILS MODAL
          ========================================================================= */}
      {selectedMatch && (
        <div className="match-modal-backdrop" onClick={() => setSelectedMatch(null)}>
          <div className="match-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="match-modal-header">
              <div className="match-modal-title-group">
                <span className="match-modal-league">
                  {selectedMatch.leagueFlag} {selectedMatch.league}
                </span>
                <span className="match-modal-stadium">
                  <i className="fa-solid fa-location-dot"></i> {selectedMatch.stadium}
                </span>
              </div>
              <button
                type="button"
                className="match-modal-close-btn"
                onClick={() => setSelectedMatch(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Big Match Score Board */}
            <div className="match-modal-scoreboard">
              <div className="modal-team-block">
                <span className="modal-team-crest">{selectedMatch.homeCrest}</span>
                <strong className="modal-team-name">{selectedMatch.homeTeam}</strong>
              </div>

              <div className="modal-score-block">
                <span className={`modal-status-badge ${selectedMatch.isLive ? 'live-badge' : 'ft-badge'}`}>
                  {selectedMatch.isLive && <span className="status-live-dot" />}
                  {selectedMatch.status}
                </span>
                <div className="modal-big-score">
                  <span>{selectedMatch.homeScore}</span>
                  <span className="modal-score-sep">-</span>
                  <span>{selectedMatch.awayScore}</span>
                </div>
              </div>

              <div className="modal-team-block">
                <span className="modal-team-crest">{selectedMatch.awayCrest}</span>
                <strong className="modal-team-name">{selectedMatch.awayTeam}</strong>
              </div>
            </div>

            {/* Scorers Timeline */}
            {selectedMatch.scorers.length > 0 && (
              <div className="match-modal-section">
                <span className="match-section-title">Match Goals & Scorers</span>
                <div className="modal-scorers-list">
                  {selectedMatch.scorers.map((s, idx) => (
                    <div key={idx} className={`modal-scorer-pill ${s.team}`}>
                      <i className="fa-solid fa-futbol"></i>
                      <span>{s.player}</span>
                      <strong>{s.minute}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Match Statistics Bars */}
            <div className="match-modal-section">
              <span className="match-section-title">Live Match Statistics</span>
              <div className="match-stats-table">
                {/* Possession */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.possession[0]}%</span>
                  <span className="stat-label">Ball Possession</span>
                  <span className="stat-val away">{selectedMatch.stats.possession[1]}%</span>
                </div>
                <div className="stat-bar-track">
                  <div className="stat-bar-fill home" style={{ width: `${selectedMatch.stats.possession[0]}%` }}></div>
                  <div className="stat-bar-fill away" style={{ width: `${selectedMatch.stats.possession[1]}%` }}></div>
                </div>

                {/* Shots on Target */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.shotsOnTarget[0]}</span>
                  <span className="stat-label">Shots on Target</span>
                  <span className="stat-val away">{selectedMatch.stats.shotsOnTarget[1]}</span>
                </div>

                {/* Corner Kicks */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.corners[0]}</span>
                  <span className="stat-label">Corner Kicks</span>
                  <span className="stat-val away">{selectedMatch.stats.corners[1]}</span>
                </div>

                {/* Fouls */}
                <div className="stat-row">
                  <span className="stat-val home">{selectedMatch.stats.fouls[0]}</span>
                  <span className="stat-label">Fouls</span>
                  <span className="stat-val away">{selectedMatch.stats.fouls[1]}</span>
                </div>
              </div>
            </div>

            {/* Live Key Commentary */}
            <div className="match-modal-section">
              <span className="match-section-title">Key Match Events</span>
              <div className="match-commentary-feed">
                {selectedMatch.commentary.map((c, idx) => (
                  <div key={idx} className="commentary-item">
                    <span className="comm-min">{c.minute}</span>
                    <span className="comm-text">{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: FULL REAL-WORLD NEWS STORY MODAL
          ========================================================================= */}
      {selectedArticle && (
        <div className="match-modal-backdrop" onClick={() => setSelectedArticle(null)}>
          <div className="match-modal-card news-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="match-modal-header">
              <div className="news-modal-source-row">
                <span className="news-source-tag">
                  <span>{selectedArticle.sourceLogo}</span>
                  <strong>{selectedArticle.source}</strong>
                  {selectedArticle.handle && <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>{selectedArticle.handle}</span>}
                </span>
                <span className="news-cat-pill">{selectedArticle.category || selectedArticle.categoryTag}</span>
                <span className="news-time-ago">{selectedArticle.timeAgo}</span>
              </div>
              <button
                type="button"
                className="match-modal-close-btn"
                onClick={() => setSelectedArticle(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <h3 className="news-modal-headline">{selectedArticle.title}</h3>
            <p className="news-modal-lead">{selectedArticle.summary}</p>

            {selectedArticle.imageUrl && (
              <div style={{ borderRadius: '12px', overflow: 'hidden', maxHeight: '200px' }}>
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            {Array.isArray(selectedArticle.keyPoints) && selectedArticle.keyPoints.length > 0 && (
              <div className="match-modal-section">
                <span className="match-section-title">Key Takeaways & Details</span>
                <div className="news-modal-points">
                  {selectedArticle.keyPoints.map((point, idx) => (
                    <div key={idx} className="news-point-item">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="news-modal-footer">
              {selectedArticle.url ? (
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-modal-open-link-btn"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i> Read Full Story on {selectedArticle.source}
                </a>
              ) : (
                <span className="news-read-time">
                  <i className="fa-solid fa-newspaper"></i> Verified Journalism Feed
                </span>
              )}
              <button
                type="button"
                className="news-share-btn"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: selectedArticle.title, text: selectedArticle.summary, url: selectedArticle.url || '' }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(`${selectedArticle.title}\n${selectedArticle.summary}\n${selectedArticle.url || ''}`);
                    alert('Story copied to clipboard!');
                  }
                }}
              >
                <i className="fa-solid fa-share-nodes"></i> Share Story
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
