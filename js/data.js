/* ===========================================================================
 * CRUFYmanager — data.js
 *   Static lookup tables: positions, formations (with pitch coordinates),
 *   default name banks, stadium suffixes, commentary phrase banks.
 * ========================================================================= */

const POSITIONS = ['GK', 'DF', 'MF', 'FW'];

const POSITION_ROLES = {
  GK:  ['GK'],
  DF:  ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MF:  ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  FW:  ['LW', 'RW', 'ST', 'CF']
};

const ROLE_TO_GROUP = (() => {
  const m = {};
  for (const grp of POSITIONS) for (const r of POSITION_ROLES[grp]) m[r] = grp;
  return m;
})();

/* Pitch coordinates: home team attacks "up" (toward y=0).
 * 0,0  = top-left (away goal area). 100,100 = bottom-right (home goal area).
 * Slot x left→right; slot y goalkeeper(92) → striker(8). */
const FORMATIONS = {
  '4-4-2': [
    { role: 'GK',  x: 50, y: 92 },
    { role: 'RB',  x: 82, y: 70 },
    { role: 'CB',  x: 60, y: 74 },
    { role: 'CB',  x: 40, y: 74 },
    { role: 'LB',  x: 18, y: 70 },
    { role: 'RM',  x: 82, y: 46 },
    { role: 'CM',  x: 60, y: 50 },
    { role: 'CM',  x: 40, y: 50 },
    { role: 'LM',  x: 18, y: 46 },
    { role: 'ST',  x: 60, y: 18 },
    { role: 'ST',  x: 40, y: 18 },
  ],
  '4-3-3': [
    { role: 'GK',  x: 50, y: 92 },
    { role: 'RB',  x: 82, y: 70 },
    { role: 'CB',  x: 60, y: 74 },
    { role: 'CB',  x: 40, y: 74 },
    { role: 'LB',  x: 18, y: 70 },
    { role: 'CM',  x: 70, y: 50 },
    { role: 'CDM', x: 50, y: 56 },
    { role: 'CM',  x: 30, y: 50 },
    { role: 'RW',  x: 80, y: 22 },
    { role: 'ST',  x: 50, y: 14 },
    { role: 'LW',  x: 20, y: 22 },
  ],
  '4-2-3-1': [
    { role: 'GK',  x: 50, y: 92 },
    { role: 'RB',  x: 82, y: 70 },
    { role: 'CB',  x: 60, y: 74 },
    { role: 'CB',  x: 40, y: 74 },
    { role: 'LB',  x: 18, y: 70 },
    { role: 'CDM', x: 60, y: 56 },
    { role: 'CDM', x: 40, y: 56 },
    { role: 'RM',  x: 80, y: 34 },
    { role: 'CAM', x: 50, y: 34 },
    { role: 'LM',  x: 20, y: 34 },
    { role: 'ST',  x: 50, y: 14 },
  ],
  '3-5-2': [
    { role: 'GK',  x: 50, y: 92 },
    { role: 'CB',  x: 70, y: 74 },
    { role: 'CB',  x: 50, y: 76 },
    { role: 'CB',  x: 30, y: 74 },
    { role: 'RWB', x: 88, y: 50 },
    { role: 'CM',  x: 65, y: 50 },
    { role: 'CDM', x: 50, y: 58 },
    { role: 'CM',  x: 35, y: 50 },
    { role: 'LWB', x: 12, y: 50 },
    { role: 'ST',  x: 60, y: 18 },
    { role: 'ST',  x: 40, y: 18 },
  ],
  '5-3-2': [
    { role: 'GK',  x: 50, y: 92 },
    { role: 'RWB', x: 86, y: 64 },
    { role: 'CB',  x: 66, y: 76 },
    { role: 'CB',  x: 50, y: 78 },
    { role: 'CB',  x: 34, y: 76 },
    { role: 'LWB', x: 14, y: 64 },
    { role: 'CM',  x: 66, y: 48 },
    { role: 'CDM', x: 50, y: 54 },
    { role: 'CM',  x: 34, y: 48 },
    { role: 'ST',  x: 60, y: 18 },
    { role: 'ST',  x: 40, y: 18 },
  ],
  '4-5-1': [
    { role: 'GK',  x: 50, y: 92 },
    { role: 'RB',  x: 82, y: 70 },
    { role: 'CB',  x: 60, y: 74 },
    { role: 'CB',  x: 40, y: 74 },
    { role: 'LB',  x: 18, y: 70 },
    { role: 'RM',  x: 84, y: 44 },
    { role: 'CM',  x: 65, y: 50 },
    { role: 'CDM', x: 50, y: 56 },
    { role: 'CM',  x: 35, y: 50 },
    { role: 'LM',  x: 16, y: 44 },
    { role: 'ST',  x: 50, y: 16 },
  ],
  '4-1-4-1': [
    { role: 'GK',  x: 50, y: 92 },
    { role: 'RB',  x: 82, y: 70 },
    { role: 'CB',  x: 60, y: 74 },
    { role: 'CB',  x: 40, y: 74 },
    { role: 'LB',  x: 18, y: 70 },
    { role: 'CDM', x: 50, y: 60 },
    { role: 'RM',  x: 84, y: 38 },
    { role: 'CM',  x: 60, y: 42 },
    { role: 'CM',  x: 40, y: 42 },
    { role: 'LM',  x: 16, y: 38 },
    { role: 'ST',  x: 50, y: 16 },
  ],
};

const DEFAULT_FORMATION = '4-4-2';

const TACTIC_PRESETS = {
  balanced:    { mentality: 50, tempo: 50, pressing: 50, label: 'Balanced' },
  attacking:   { mentality: 75, tempo: 65, pressing: 60, label: 'Attacking' },
  defensive:   { mentality: 25, tempo: 35, pressing: 35, label: 'Defensive' },
  hightempo:   { mentality: 55, tempo: 80, pressing: 75, label: 'High tempo' },
  parkthebus:  { mentality: 10, tempo: 25, pressing: 20, label: 'Park the bus' },
};

/* Stadium suffixes for autogen */
const STADIUM_SUFFIXES = [
  'Park', 'Stadium', 'Arena', 'Ground', 'Field', 'Bowl', 'Stadion',
  'Coliseum', 'Stade', 'Estadio', 'Stadio'
];

const STADIUM_PREFIXES = [
  'Old', 'New', 'Royal', 'Memorial', 'National', 'Civic', 'Central',
  'North', 'South', 'East', 'West', 'Riverside', 'Eastlands', 'Hillside',
  'Crown', 'Victory', 'Liberty', 'Union'
];

/* ===========================================================================
 * Default name banks. Each bank: { firstNames: [...], lastNames: [...] }
 * The user can edit / add to these via Settings.
 * ========================================================================= */
const DEFAULT_NAME_BANKS = {
  'Generic English': {
    firstNames: ['James','John','Robert','Michael','William','David','Richard','Charles','Joseph','Thomas','Christopher','Daniel','Paul','Mark','Donald','George','Kenneth','Steven','Edward','Brian','Ronald','Anthony','Kevin','Jason','Matthew','Gary','Timothy','Jose','Larry','Jeffrey','Frank','Scott','Eric','Stephen','Andrew','Raymond','Gregory','Joshua','Jerry','Dennis','Walter','Patrick','Peter','Harold','Douglas','Henry','Carl','Arthur','Ryan','Roger','Joe','Juan','Jack','Albert','Jonathan','Justin','Terry','Gerald','Keith','Samuel','Willie','Ralph','Lawrence','Nicholas','Roy','Benjamin','Bruce','Brandon','Adam','Harry','Fred','Wayne','Billy','Steve','Louis','Jeremy','Aaron','Randy','Howard','Eugene','Carlos','Russell','Bobby','Victor','Ernest','Phillip','Todd','Jesse','Craig','Alan','Shawn','Clarence','Sean','Philip','Chris','Johnny','Earl','Jimmy','Antonio'],
    lastNames: ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson','Watson','Brooks','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes','Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster','Jimenez']
  },
  'Generic Latin': {
    firstNames: ['Diego','Carlos','Luis','Juan','Pedro','Pablo','Miguel','Andres','Francisco','Sergio','Ricardo','Eduardo','Roberto','Alberto','Hugo','Mario','Hector','Manuel','Felipe','Antonio','Rafael','Daniel','Alejandro','Marcelo','Cristian','Esteban','Joaquin','Nicolas','Lucas','Mateo','Tomas','Sebastian','Bruno','Federico','Gonzalo','Adrian','Julian','Emiliano','Maximiliano','Agustin','Ezequiel','Iván','Lautaro','Thiago','Vicente','Leonel','Gabriel','Ezequiel','Joel','Joaquín'],
    lastNames: ['Fernandez','Garcia','Rodriguez','Lopez','Martinez','Gonzalez','Perez','Sanchez','Romero','Diaz','Torres','Ruiz','Ramirez','Flores','Acosta','Benitez','Medina','Suarez','Castro','Ortiz','Rojas','Herrera','Vega','Cabrera','Ramos','Reyes','Mendoza','Vargas','Castillo','Jimenez','Moreno','Ortega','Aguirre','Silva','Rivera','Soto','Cruz','Salazar','Molina','Gutierrez','Delgado','Espinoza','Cordoba','Cardenas','Navarro','Pena','Maldonado','Vera','Caballero','Carrasco']
  },
  'Generic Iberian': {
    firstNames: ['João','Pedro','Bruno','Miguel','Tiago','Diogo','Rui','Nuno','André','Ricardo','Hugo','Tomás','Henrique','Gonçalo','Vasco','Luís','Marco','Filipe','Bernardo','Daniel','Eduardo','Francisco','David','Rafael','Vítor','Sérgio','Paulo','Carlos','Manuel','António','José','Fernando','Mário','Jorge','Renato','Cristiano','Bernardino','Adriano','Edinho','Beto'],
    lastNames: ['Silva','Santos','Pereira','Ferreira','Oliveira','Costa','Rodrigues','Martins','Sousa','Fernandes','Gonçalves','Lopes','Marques','Almeida','Ribeiro','Pinto','Carvalho','Teixeira','Moreira','Correia','Mendes','Nunes','Soares','Vieira','Monteiro','Cardoso','Rocha','Neves','Coelho','Cruz','Cunha','Pires','Reis','Antunes','Lima','Tavares','Barbosa','Henriques','Borges','Macedo']
  },
  'Generic Italian': {
    firstNames: ['Marco','Andrea','Francesco','Alessandro','Matteo','Luca','Davide','Federico','Stefano','Riccardo','Giovanni','Antonio','Roberto','Lorenzo','Tommaso','Simone','Daniele','Gabriele','Enrico','Edoardo','Niccolò','Leonardo','Cristian','Filippo','Alberto','Mattia','Gianluca','Massimo','Salvatore','Vincenzo','Pietro','Paolo','Fabio','Emanuele','Mauro','Sandro','Giorgio','Valerio','Maurizio','Claudio'],
    lastNames: ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Mariani','Rinaldi','Caruso','Ferrara','Galli','Martini','Leone','Longo','Gentile','Martinelli','Vitali','Lombardo','Serra','Coppola','De Santis','D\'Angelo','Marchetti']
  },
  'Generic Slavic': {
    firstNames: ['Jakub','Tomasz','Pawel','Lukasz','Marek','Krzysztof','Pyotr','Sergei','Alexei','Mikhail','Andrei','Ivan','Vladimir','Nikolai','Boris','Dmitri','Aleksandar','Stefan','Marko','Nikola','Luka','Ivan','Filip','Petr','Václav','Tomáš','Martin','Jan','Pavel','Daniel','Filip','Ondřej','Lukáš','Adam','Vojtěch','Jakub','Matej','Štěpán','Alexandar','Bogdan'],
    lastNames: ['Nowak','Kowalski','Wojcik','Kowalczyk','Kaminski','Lewandowski','Zielinski','Szymanski','Wozniak','Dabrowski','Ivanov','Petrov','Sidorov','Smirnov','Kuznetsov','Popov','Sokolov','Lebedev','Kozlov','Novikov','Morozov','Volkov','Solovyov','Vasilev','Petrović','Đorđević','Nikolić','Ilić','Marković','Stanković','Pavlović','Stojanović','Novák','Svoboda','Černý','Procházka','Kučera','Dvořák','Krejčí','Veselý']
  },
  'Generic Nordic': {
    firstNames: ['Lars','Magnus','Erik','Gustav','Karl','Henrik','Mats','Niklas','Jens','Mikael','Anders','Per','Bjorn','Ole','Knut','Jonas','Andreas','Christian','Daniel','Sebastian','Markus','Tobias','Joakim','Linus','Marcus','Patrik','Robin','Simon','Adam','Oskar','Viktor','Filip','Anton','Hugo','Theo','Emil','Lukas','William','Oliver','Elias'],
    lastNames: ['Andersson','Johansson','Karlsson','Nilsson','Eriksson','Larsson','Olsson','Persson','Svensson','Gustafsson','Pettersson','Jonsson','Jansson','Hansson','Bengtsson','Jonasson','Petersen','Hansen','Jensen','Nielsen','Christensen','Andersen','Pedersen','Sørensen','Rasmussen','Jørgensen','Madsen','Kristensen','Olsen','Thomsen','Knudsen','Mortensen','Berg','Lindberg','Lindgren','Lindstrom','Nyberg','Hellström','Sandberg','Forsberg']
  },
  'Generic Germanic': {
    firstNames: ['Lukas','Jonas','Felix','Maximilian','Paul','Leon','Tim','Tom','Jan','Niklas','Florian','Sebastian','Christian','Andreas','Stefan','Daniel','Michael','Markus','Dominik','Patrick','Philipp','Fabian','Tobias','Manuel','Robin','David','Julian','Simon','Marcel','Pascal','Sven','Kai','Jens','Ralf','Mario','Karl','Heinz','Hans','Klaus','Werner'],
    lastNames: ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Schäfer','Koch','Bauer','Richter','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann','Braun','Krüger','Hofmann','Hartmann','Lange','Schmitt','Werner','Schmitz','Krause','Meier','Lehmann','Schmid','Schulze','Maier','Köhler','Herrmann','König','Walter','Mayer','Huber']
  },
  'Generic French': {
    firstNames: ['Jean','Pierre','Michel','André','Philippe','Bernard','Daniel','Robert','Alain','Jacques','Christian','Patrick','Nicolas','Christophe','Bruno','Thierry','François','Olivier','Pascal','Eric','Guillaume','Antoine','Florian','Maxime','Benjamin','Romain','Julien','Vincent','Mathieu','Quentin','Lucas','Hugo','Théo','Nathan','Enzo','Léo','Tom','Jules','Adam','Raphael'],
    lastNames: ['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','Andre','Lefevre','Mercier','Dupont','Lambert','Bonnet','Francois','Martinez','Legrand','Garnier','Faure','Rousseau','Blanc','Guerin','Muller','Henry','Roussel','Nicolas']
  },
  'Generic Arabic': {
    firstNames: ['Mohammed','Ahmed','Mahmoud','Khaled','Hassan','Hussein','Ali','Omar','Yusuf','Ibrahim','Abdullah','Karim','Tarek','Walid','Youssef','Mostafa','Saleh','Nasser','Abdulrahman','Faisal','Bilal','Sami','Adel','Wael','Ramy','Hisham','Fadi','Bassel','Bilal','Anwar','Ayman','Kamal','Jalal','Salem','Ziad','Marwan','Iyad','Sharif','Riad','Tamer'],
    lastNames: ['Al-Saud','Al-Hassan','Al-Hussein','Al-Sayed','Al-Khalil','Al-Ahmad','Al-Khatib','Al-Najjar','Mansour','Salah','Hakim','Karim','Nassar','Sharaf','Saleh','Hadi','Tahir','Younes','Othman','Sabbagh','Khoury','Haddad','Ghazi','Awad','Rashid','Salem','Faris','Saif','Naser','Maaroufi','Zaki','Halim','Zayed','Idris','Bakr','Hashem','Hamad','Tawfiq','Ziad','Murad']
  },
  'Generic East-Asian': {
    firstNames: ['Hiroshi','Takashi','Akira','Kenji','Daiki','Ryota','Yuki','Sho','Takuya','Kazuki','Tomoya','Naoki','Yuta','Kenta','Shinji','Tatsuya','Hideki','Masaru','Min-jun','Seo-jun','Do-yoon','Si-woo','Hyun-woo','Joon-ho','Sung-min','Kyung-soo','Tae-hyun','Jae-won','Wei','Ming','Hao','Lei','Jian','Yong','Bo','Tao','Cheng','Liang','Qiang','Feng'],
    lastNames: ['Tanaka','Suzuki','Sato','Takahashi','Watanabe','Ito','Yamamoto','Nakamura','Kobayashi','Kato','Yoshida','Yamada','Sasaki','Yamaguchi','Matsumoto','Inoue','Kimura','Hayashi','Shimizu','Mori','Kim','Lee','Park','Choi','Jung','Kang','Cho','Yoon','Jang','Lim','Wang','Li','Zhang','Liu','Chen','Yang','Huang','Zhao','Wu','Zhou']
  },
  'Generic African': {
    firstNames: ['Kwame','Kofi','Kwesi','Yaw','Kojo','Akwasi','Sefa','Ade','Femi','Tunde','Sunday','Ifeanyi','Chinedu','Emeka','Obi','Olu','Sani','Bashir','Idris','Nasir','Aliou','Sadio','Idrissa','Pape','Modou','Cheikh','Khalid','Ahmed','Said','Mounir','Tendai','Tafadzwa','Tinashe','Kudzai','Munashe','Sipho','Thabo','Sibusiso','Bafana','Mandla'],
    lastNames: ['Owusu','Mensah','Boateng','Asante','Adjei','Yeboah','Acheampong','Adu','Okafor','Okonkwo','Eze','Adeyemi','Bakare','Diallo','Traoré','Diop','Sow','Cisse','Camara','Toure','Keita','Bah','Sissoko','Diakite','Kone','Ouedraogo','Compaore','Dembele','Coulibaly','Sangare','Maboko','Mwangi','Otieno','Ochieng','Onyango','Mokoena','Khumalo','Dlamini','Mthembu','Sithole']
  }
};

/* ===========================================================================
 * Commentary phrase banks. Engine substitutes {scorer}, {assister},
 * {fouler}, {fouled}, {keeper}, {team}, {min} via simple template render.
 * ========================================================================= */
const COMMENTARY = {
  kickoff: [
    'Kick-off! {hometeam} get the match underway against {awayteam}.',
    'The whistle blows at {stadium} and we are off!',
    'A capacity crowd of {attendance} settles in as the match begins.',
  ],
  halftime: [
    'Half-time. {hometeam} {hs} – {as} {awayteam}.',
    'The referee blows for the break. {hometeam} {hs} – {as} {awayteam}.',
  ],
  fulltime: [
    'Full-time. Final score: {hometeam} {hs} – {as} {awayteam}.',
    'And the referee ends the contest. {hometeam} {hs} – {as} {awayteam}.',
  ],
  goal: [
    '{scorer} smashes it home! Brilliant finish.',
    '{scorer} finds the net! What a strike.',
    'GOAL! {scorer} slots it past the keeper.',
    '{scorer} buries the chance with confidence.',
    '{scorer} arrives at the right moment to make it count.',
    'A clinical finish from {scorer}!',
    '{scorer} steers the ball into the corner of the net.',
    '{scorer} rifles a shot home — the net bulges.',
  ],
  goalAssist: [
    '{assister} threads it through; {scorer} converts.',
    '{assister} delivers a perfect ball and {scorer} taps it in.',
    'A delightful pass from {assister}, finished by {scorer}.',
    '{assister} sets it up on a plate, {scorer} obliges.',
    '{scorer} latches onto a {assister} cross and finishes superbly.',
  ],
  penaltyAwarded: [
    'PENALTY! The referee points to the spot.',
    'A foul in the box — penalty given!',
    'The whistle goes — and it\'s a spot-kick.',
  ],
  penaltyScored: [
    '{scorer} steps up and converts. Cool as ice.',
    '{scorer} slots the penalty straight down the middle.',
    '{scorer} sends the keeper the wrong way.',
  ],
  penaltyMissed: [
    '{scorer} skies it! Unforgivable from the spot.',
    '{keeper} guesses right and parries away!',
    '{scorer} crashes it against the bar!',
  ],
  shotMissed: [
    '{shooter} sends it just wide.',
    '{shooter} rattles the post — so close.',
    '{shooter} blazes the shot over the bar.',
    '{shooter} drags the effort wide of the target.',
    '{shooter} fails to keep it down — over.',
  ],
  shotSaved: [
    '{keeper} pulls off a smart save from {shooter}!',
    '{keeper} makes a routine stop.',
    '{keeper} parries the {shooter} effort to safety.',
    'A diving save from {keeper}!',
  ],
  yellow: [
    '{fouler} goes into the book for a clumsy challenge on {fouled}.',
    'Yellow card for {fouler}.',
    'The referee shows {fouler} the yellow card.',
    '{fouler} earns a caution after a late tackle.',
  ],
  red: [
    'RED CARD! {fouler} is sent off.',
    'A second yellow — {fouler} is given his marching orders.',
    '{fouler} sees red after a horror tackle on {fouled}.',
  ],
  injury: [
    '{player} is down — looks like a problem.',
    '{player} pulls up clutching a hamstring.',
    'The physios are on for {player}.',
    '{player} can\'t continue.',
  ],
  sub: [
    'Substitution: {playerOff} off, {playerOn} on for {team}.',
    '{team} make a change — {playerOn} replaces {playerOff}.',
    '{playerOn} is on; {playerOff} comes off.',
  ],
  freekick: [
    'Free-kick to {team} in a dangerous area.',
    '{team} have a free-kick chance.',
  ],
  corner: [
    'Corner to {team}.',
    '{team} win a corner.',
  ],
  attack: [
    '{team} push forward in numbers.',
    'A nice move down the right by {team}.',
    '{team} string passes together patiently.',
    'Pressure mounting from {team}.',
    '{team} probe through midfield.',
  ],
  blocked: [
    '{shooter} sees the shot blocked.',
    'The defence throws bodies in the way.',
    'Cleared at the last moment by the back line.',
  ],
  offside: [
    'Flag\'s up — offside.',
    '{shooter} caught offside.',
  ],
};

/* News templates */
const NEWS_TEMPLATES = {
  retire: [
    '{player} ({age}) hangs up the boots after a fine career.',
    '{player} announces retirement at age {age}.',
    'After {apps} senior appearances, {player} retires.',
  ],
  retireToManager: [
    '{player} retires at {age} and immediately enters management.',
    '{player} swaps the boots for the dugout.',
  ],
  hire: [
    '{club} appoint {manager} as new head coach.',
    '{manager} takes the reins at {club}.',
  ],
  sack: [
    '{club} part ways with {manager} after a poor run.',
    '{manager} dismissed by {club}.',
  ],
  ntCallup: [
    '{player} earns a call-up to the {nation} squad.',
    'First {nation} call-up for {player}.',
  ],
  promoted: [
    '{club} promoted to {league} after a successful campaign.',
  ],
  relegated: [
    '{club} relegated from {league}.',
  ],
  champion: [
    '{club} crowned {league} champions!',
  ],
  cupWin: [
    '{club} lift the {cup}!',
  ],
  youthIntake: [
    '{club} welcome {n} new players from the youth academy.',
  ],
  injury: [
    '{player} ruled out for {weeks} match{plural} with injury.',
  ],
  suspension: [
    '{player} suspended for {games} match{plural} after a red card.',
  ],
  yellowBan: [
    '{player} suspended for one match after a fifth yellow card.',
  ],
};

const SUBSTITUTION_REASONS = ['Tactical', 'Tired legs', 'Off the pace', 'Injury', 'Disciplinary'];

/* Standard 3-points-for-a-win, 1-for-a-draw points system; configurable per league */
const DEFAULT_POINTS_SYSTEM = { win: 3, draw: 1, loss: 0 };
const TIEBREAKERS = ['gd', 'gf', 'h2h', 'wins'];

/* ===========================================================================
 * Helpers exposed to other modules.
 * ========================================================================= */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function rand() { return Math.random(); }
function randNorm(mean, sd) {
  // Box–Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function uid(prefix = '') { return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

function templ(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : '?'));
}

function generatePlayerName(bankName) {
  const bank = (state && state.nameBanks && state.nameBanks[bankName]) || DEFAULT_NAME_BANKS[bankName] || DEFAULT_NAME_BANKS['Generic English'];
  return `${pick(bank.firstNames)} ${pick(bank.lastNames)}`;
}

function generateClubName(bankName) {
  // Simple club-name generator: <Last Name> <City Suffix> or <City> <Word>
  const cityWords = ['United', 'City', 'Town', 'FC', 'Athletic', 'Rovers', 'Wanderers', 'Albion', 'Rangers', 'County', 'Argyle', 'Forest', 'Park', 'Olympic', 'Sporting', 'Real', 'Internazionale', 'Dinamo'];
  const bank = (state && state.nameBanks && state.nameBanks[bankName]) || DEFAULT_NAME_BANKS[bankName] || DEFAULT_NAME_BANKS['Generic English'];
  const root = pick(bank.lastNames);
  return `${root} ${pick(cityWords)}`;
}

function generateStadiumName(clubName) {
  const root = clubName.split(' ')[0];
  if (Math.random() < 0.4) return `${pick(STADIUM_PREFIXES)} ${pick(STADIUM_SUFFIXES)}`;
  return `${root} ${pick(STADIUM_SUFFIXES)}`;
}

/* Hex colour generator for club kits */
function randomKitColour() {
  const palette = ['#c0392b','#e74c3c','#d35400','#e67e22','#f39c12','#f1c40f','#27ae60','#16a085','#2980b9','#3498db','#8e44ad','#9b59b6','#34495e','#2c3e50','#7f8c8d','#bdc3c7','#1abc9c','#222831','#393e46','#0a3d62','#6a1b9a','#0f4c5c','#e84118','#487eb0'];
  return pick(palette);
}
