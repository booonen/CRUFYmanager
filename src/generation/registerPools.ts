import english from '../data/names/english.json';
import german from '../data/names/german.json';
import french from '../data/names/french.json';
import spanish from '../data/names/spanish.json';
import italian from '../data/names/italian.json';
import slavic from '../data/names/slavic.json';
import nordic from '../data/names/nordic.json';
import african from '../data/names/african.json';
import chinese from '../data/names/chinese.json';
import arabic from '../data/names/arabic.json';
import turkish from '../data/names/turkish.json';
import greek from '../data/names/greek.json';
import japanese from '../data/names/japanese.json';
import { type NamePool, registerNationalityAlias, registerPool } from './nameGen';

const ALL_POOLS: NamePool[] = [
  english as NamePool,
  german as NamePool,
  french as NamePool,
  spanish as NamePool,
  italian as NamePool,
  slavic as NamePool,
  nordic as NamePool,
  african as NamePool,
  chinese as NamePool,
  arabic as NamePool,
  turkish as NamePool,
  greek as NamePool,
  japanese as NamePool,
];

const NATIONALITY_ALIASES: Record<string, string> = {
  // English-speaking
  england: 'english',
  scotland: 'english',
  wales: 'english',
  ireland: 'english',
  'northern ireland': 'english',
  'united kingdom': 'english',
  uk: 'english',
  'great britain': 'english',
  'united states': 'english',
  usa: 'english',
  america: 'english',
  australia: 'english',
  'new zealand': 'english',
  canada: 'english',
  // German-speaking
  germany: 'german',
  austria: 'german',
  switzerland: 'german',
  // French-speaking
  france: 'french',
  belgium: 'french',
  // Spanish-speaking
  spain: 'spanish',
  argentina: 'spanish',
  mexico: 'spanish',
  colombia: 'spanish',
  chile: 'spanish',
  uruguay: 'spanish',
  peru: 'spanish',
  // Italian
  italy: 'italian',
  // Slavic
  russia: 'slavic',
  poland: 'slavic',
  ukraine: 'slavic',
  'czech republic': 'slavic',
  czechia: 'slavic',
  serbia: 'slavic',
  croatia: 'slavic',
  bulgaria: 'slavic',
  slovakia: 'slavic',
  slovenia: 'slavic',
  belarus: 'slavic',
  // Nordic
  sweden: 'nordic',
  norway: 'nordic',
  denmark: 'nordic',
  finland: 'nordic',
  iceland: 'nordic',
  // African
  nigeria: 'african',
  ghana: 'african',
  senegal: 'african',
  cameroon: 'african',
  ivory_coast: 'african',
  "côte d'ivoire": 'african',
  kenya: 'african',
  'south africa': 'african',
  zimbabwe: 'african',
  zambia: 'african',
  // Chinese
  china: 'chinese',
  taiwan: 'chinese',
  // Arabic
  egypt: 'arabic',
  morocco: 'arabic',
  algeria: 'arabic',
  tunisia: 'arabic',
  saudi_arabia: 'arabic',
  'saudi arabia': 'arabic',
  uae: 'arabic',
  qatar: 'arabic',
  jordan: 'arabic',
  lebanon: 'arabic',
  iraq: 'arabic',
  // Turkish
  turkey: 'turkish',
  türkiye: 'turkish',
  // Greek
  greece: 'greek',
  cyprus: 'greek',
  // Japanese
  japan: 'japanese',
};

let registered = false;

export function registerAllNamePools(): void {
  if (registered) return;
  registered = true;
  for (const pool of ALL_POOLS) {
    registerPool(pool);
  }
  for (const [nationality, code] of Object.entries(NATIONALITY_ALIASES)) {
    registerNationalityAlias(nationality, code);
  }
}
