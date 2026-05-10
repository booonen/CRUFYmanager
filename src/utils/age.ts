import type { Calendar, CalendarDate } from '../domain/calendar';

export function computeAge(dob: CalendarDate, calendar: Calendar): number {
  const seasonsElapsed = calendar.currentSeason - dob.season;
  const passedBirthMatchday = calendar.currentMatchday >= dob.matchday;
  return Math.max(0, seasonsElapsed - (passedBirthMatchday ? 0 : 1));
}

export function dobForAge(age: number, calendar: Calendar): CalendarDate {
  const targetSeason = calendar.currentSeason - age;
  return { season: targetSeason, matchday: calendar.currentMatchday };
}
