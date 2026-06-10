/**
 * The global abstract-matchday timeline (no real-world dates). Competition
 * rounds carry a `calendarMatchday` pointing into this sequence; the Calendar
 * view is the cross-competition lens over it. The host advances at their own
 * pace.
 */
export interface Calendar {
  currentSeason: number;
  currentMatchday: number;
  matchdaysPerSeason: number;
}

export interface CalendarDate {
  season: number;
  matchday: number;
}
