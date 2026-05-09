export interface UserSettings {
  language: string;
  reportFormat: 'bbcode' | 'markdown' | 'plain';
  autoAdvance: boolean;
  notifications: {
    transferOffers: boolean;
    injuries: boolean;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  reportFormat: 'bbcode',
  autoAdvance: false,
  notifications: {
    transferOffers: true,
    injuries: true,
  },
};
