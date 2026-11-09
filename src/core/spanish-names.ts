import { normalizeName } from './names.ts';

/**
 * Spanish (RV) biblical names whose spelling differs from the English one Theographic uses,
 * mapped to that English spelling. Keys are stored normalized (lowercase, no diacritics).
 * Names spelled the same in both languages (David, Abraham, Moab) are deliberately absent:
 * an unlisted name returns undefined and callers search for it as written.
 */
const SPANISH_TO_ENGLISH: Record<string, string> = {
  // people
  adan: 'Adam', eva: 'Eve', noe: 'Noah', sara: 'Sarah', agar: 'Hagar', ismael: 'Ishmael',
  rebeca: 'Rebekah', lea: 'Leah', raquel: 'Rachel', jose: 'Joseph', moises: 'Moses',
  josue: 'Joshua', gedeon: 'Gideon', sanson: 'Samson', rut: 'Ruth', noemi: 'Naomi',
  booz: 'Boaz', jonatan: 'Jonathan', salomon: 'Solomon', elias: 'Elijah',
  eliseo: 'Elisha', isaias: 'Isaiah', jeremias: 'Jeremiah', ezequiel: 'Ezekiel',
  jonas: 'Jonah', ester: 'Esther', esdras: 'Ezra', nehemias: 'Nehemiah',
  maria: 'Mary', juan: 'John', pedro: 'Peter', santiago: 'James', andres: 'Andrew',
  felipe: 'Philip', bartolome: 'Bartholomew', mateo: 'Matthew', tomas: 'Thomas',
  pablo: 'Paul', bernabe: 'Barnabas', timoteo: 'Timotheus', tito: 'Titus',
  lucas: 'Luke', marcos: 'Mark', esteban: 'Stephen', lidia: 'Lydia', priscila: 'Priscilla',
  apolos: 'Apollos', lazaro: 'Lazarus', marta: 'Martha', nicodemo: 'Nicodemus',
  herodes: 'Herod', pilato: 'Pilate', caifas: 'Caiaphas',
  // places
  belen: 'Bethlehem', jerusalen: 'Jerusalem', egipto: 'Egypt', babilonia: 'Babylon', nazaret: 'Nazareth',
  galilea: 'Galilee', damasco: 'Damascus', roma: 'Rome',
  corinto: 'Corinth', efeso: 'Ephesus', filipos: 'Philippi', tesalonica: 'Thessalonica', atenas: 'Athens',
  antioquia: 'Antioch', jerico: 'Jericho', sion: 'Zion', 'monte sinai': 'Sinai',
  asiria: 'Assyria', grecia: 'Greece',
  'mar rojo': 'Red Sea', 'rio jordan': 'Jordan',
  // events / groups
  exodo: 'The Exodus', diluvio: 'The Flood', fariseos: 'Pharisees', saduceos: 'Sadducees',
};

/** English Theographic spelling for a Spanish name, or undefined when none is known. */
export function spanishToEnglishName(name: string): string | undefined {
  return SPANISH_TO_ENGLISH[normalizeName(name)];
}
