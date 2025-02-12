const FRENCH_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const FRENCH_MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export const MOUVELIAN_SEASONS = ['Zéphyr', 'Phénix', 'Scion', 'Colosse'];

/**
 *
 * @param date
 * @returns {string}
 */
export function dateToFrenchString(date: Date, { withDay = true, withYear = false } = {}) {
  let dateString = '';
  if (withDay) {
    dateString += `${getFrenchDay(date.getDay())} `;
  }

  dateString += `${date.getDate()} ${getFrenchMonth(date.getMonth())}`;

  if (withYear) {
    dateString += ` ${date.getFullYear()}`;
  }

  return dateString;
}

/**
 *
 * @param dateString Vous collez à tout ce que vous touchez
 * @returns {{year: (string|number), season: number, day: string}}
 */
export function frenchToMouvelian(dateString: string): {
  day: number;
  season: number;
  year: number;
} {
  const args = dateString.split(' ').map((el) => el.trim());

  const day = parseInt(args[0]);
  const season = MOUVELIAN_SEASONS.map((s) => s.toLowerCase()).indexOf(args[1].toLowerCase());
  if (season === -1) {
    throw new Error('Invalid season.');
  }
  const year = parseInt(args[2]) || new Date().getFullYear() - 687;

  return { day, season, year };
}

/**
 *
 * @param dateString
 * @returns {Date}
 */
export function frenchToDate(dateString: string): Date {
  const args = dateString.split(/[ \/\-]/).map((el) => el.trim());
  const date = new Date();

  let day, month, year;

  if (args.length === 1) {
    const dayOfWeek = FRENCH_DAYS.map((d) => d.toLowerCase()).indexOf(args[0].toLowerCase());
    if (dayOfWeek === -1) {
      throw new Error('Invalid date.');
    }

    day = date.getDate() + dayOfWeek - date.getDay();
    month = date.getMonth();
    year = date.getFullYear();
  } else {
    day = +args[0];
    if (Number.isNaN(day)) {
      throw new Error('Invalid date.');
    }

    month = !Number.isNaN(+args[1])
      ? +args[1] - 1
      : FRENCH_MONTHS.map((m) => m.toLowerCase()).indexOf(args[1].toLowerCase());
    if (month < 0 || month >= 12) {
      throw new Error('Invalid date.');
    }

    year = parseInt(args[2]) || date.getFullYear();
  }

  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);

  return date;
}

/**
 * 0 is sunday
 * @param day
 */
function getFrenchDay(day: number) {
  return FRENCH_DAYS[day];
}

/**
 * 0 is January
 * @param month
 */
function getFrenchMonth(month: number) {
  return FRENCH_MONTHS[month];
}

/**
 *
 * @param gregorianDate
 * @returns {{year: number, day: number}}
 */
export function gregorianToMouvelian(gregorianDate: Date): {
  day: number;
  season: number;
  year: number;
} {
  const day = Math.ceil(
    (gregorianDate.getTime() - new Date(gregorianDate.getFullYear(), 0, 1).getTime()) / 86400000,
  );
  const mouvelianDate = {
    day,
    year: gregorianDate.getFullYear() - 687,
    season: 0,
  };

  const bisex = gregorianDate.getFullYear() % 4 === 0;
  const offset = bisex ? 1 : 0;

  if (day < 90 + offset) {
    mouvelianDate.day = day;
    mouvelianDate.season = 0;
  } else if (day <= 180 + offset) {
    mouvelianDate.day = day - (90 + offset);
    mouvelianDate.season = 1;
  } else if (day <= 270 + offset) {
    mouvelianDate.day = day - (180 + offset);
    mouvelianDate.season = 2;
  } else {
    mouvelianDate.day = day - (270 + offset);
    mouvelianDate.season = 3;
  }

  return mouvelianDate;
}

/**
 *
 * @param day
 * @param season
 * @param year
 * @param withYear
 * @returns {string}
 */
export function mouvelianToFrenchString(
  { day, season, year }: { day: number; season: number; year: number },
  { withYear = false } = {},
): string {
  return `${day} du ${MOUVELIAN_SEASONS[season]}${withYear ? ` ${year}` : ''}`;
}

/**
 *
 * @param day
 * @param season
 * @param year
 * @returns {Date}
 */
export function mouvelianToGregorian({
  day,
  season,
  year,
}: {
  day: number;
  season: number;
  year: number;
}) {
  const realYear = year + 687;
  const bisex = year % 4 === 0;
  const offset = bisex ? -1 : 0;

  let dayOfYear = 0;
  switch (season) {
    case 0:
      dayOfYear = day;
      break;
    case 1:
      dayOfYear = 90 + day;
      break;
    case 2:
      dayOfYear = 180 + offset + day;
      break;
    case 3:
      dayOfYear = 270 + offset + day;
      break;
    default:
      throw new Error('Invalid season.');
  }

  return new Date(realYear, 0, dayOfYear);
}
