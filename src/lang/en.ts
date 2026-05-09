export const en = {
  app: {
    name: 'CRUFYmanager',
    tagline: 'Football competition simulator',
  },
  nav: {
    section_main: 'World',
    calendar: 'Calendar',
    competitions: 'Competitions',
    clubs: 'Clubs',
    players: 'Players',
    section_country: 'Country',
    nationalTeam: 'National Team',
    otherMatches: 'Other Matches',
    section_records: 'Records',
    history: 'History',
    section_world: 'Beyond',
    world: 'World',
    section_save: 'Save',
    saves: 'Saves',
  },
  saves: {
    activeNone: 'No active save',
    new: 'New savefile',
    create: 'Create savefile',
    list: 'Saved games',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    deleteConfirm: 'Delete this savefile? This cannot be undone.',
    export: 'Export JSON',
    import: 'Import JSON',
    switch: 'Switch',
    switchTo: 'Switch to this save',
    activeBadge: 'Active',
    empty: {
      title: 'No savefiles yet',
      body: 'Start a new world to populate clubs, players, and competitions.',
    },
    fields: {
      countryName: 'Country name',
      countryNameHint: 'e.g. Republic of Foo. Used in match reports.',
      countryShortCode: 'Short code',
      countryShortCodeHint: '3-letter country code used in BBCode tables.',
      matchdaysPerSeason: 'Matchdays per season',
      matchdaysPerSeasonHint: 'Total matchday slots in a season. Default 52.',
    },
  },
  routes: {
    placeholder: {
      title: 'Coming soon',
      body: 'This view is part of a later phase. The savefile schema is in place; the UI lights up as we build features.',
    },
  },
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    close: 'Close',
    back: 'Back',
  },
  errors: {
    importFailed: 'Could not import savefile',
  },
};

export type StringTree = typeof en;
