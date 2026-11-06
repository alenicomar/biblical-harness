import { normalizeName } from './theographic.ts';

/**
 * Common Spanish (RV) biblical names -> the English spelling Theographic uses.
 * Keys are stored normalized (lowercase, no diacritics). Only names that differ
 * from the English spelling are listed; identical ones (David, Moses→Moses) need no entry.
 */
const SPANISH_TO_ENGLISH: Record<string, string> = {
  // people
  adan: 'Adam', eva: 'Eve', cain: 'Cain', abel: 'Abel', noe: 'Noah', abraham: 'Abraham', sara: 'Sarah',
  agar: 'Hagar', ismael: 'Ishmael', isaac: 'Isaac', rebeca: 'Rebekah', jacob: 'Jacob', esau: 'Esau',
  lea: 'Leah', raquel: 'Rachel', jose: 'Joseph', moises: 'Moses', aaron: 'Aaron', miriam: 'Miriam',
  josue: 'Joshua', caleb: 'Caleb', gedeon: 'Gideon', sanson: 'Samson', rut: 'Ruth', noemi: 'Naomi',
  booz: 'Boaz', samuel: 'Samuel', saul: 'Saul', jonatan: 'Jonathan', salomon: 'Solomon', elias: 'Elijah',
  eliseo: 'Elisha', isaias: 'Isaiah', jeremias: 'Jeremiah', ezequiel: 'Ezekiel', daniel: 'Daniel',
  jonas: 'Jonah', ester: 'Esther', job: 'Job', esdras: 'Ezra', nehemias: 'Nehemiah', david: 'David',
  maria: 'Mary', jesus: 'Jesus', juan: 'John', pedro: 'Peter', santiago: 'James', andres: 'Andrew',
  felipe: 'Philip', bartolome: 'Bartholomew', mateo: 'Matthew', tomas: 'Thomas', judas: 'Judas',
  simon: 'Simon', pablo: 'Paul', bernabe: 'Barnabas', timoteo: 'Timotheus', tito: 'Titus',
  lucas: 'Luke', marcos: 'Mark', esteban: 'Stephen', lidia: 'Lydia', priscila: 'Priscilla',
  aquila: 'Aquila', apolos: 'Apollos', lazaro: 'Lazarus', marta: 'Martha', nicodemo: 'Nicodemus',
  herodes: 'Herod', pilato: 'Pilate', caifas: 'Caiaphas', 
  // places
  belen: 'Bethlehem', jerusalen: 'Jerusalem', egipto: 'Egypt', babilonia: 'Babylon', nazaret: 'Nazareth',
  galilea: 'Galilee', judea: 'Judea', samaria: 'Samaria', damasco: 'Damascus', roma: 'Rome',
  corinto: 'Corinth', efeso: 'Ephesus', filipos: 'Philippi', tesalonica: 'Thessalonica', atenas: 'Athens',
  antioquia: 'Antioch', jerico: 'Jericho', hebron: 'Hebron', sion: 'Zion', 'monte sinai': 'Sinai',
  sinai: 'Sinai', edom: 'Edom', moab: 'Moab', asiria: 'Assyria', persia: 'Persia', grecia: 'Greece',
  'mar rojo': 'Red Sea', 'rio jordan': 'Jordan', jordan: 'Jordan', capernaum: 'Capernaum', patmos: 'Patmos',
  // events / groups
  exodo: 'The Exodus', diluvio: 'The Flood', fariseos: 'Pharisees', saduceos: 'Sadducees',
};

/** English Theographic spelling for a Spanish name, or undefined when none is known. */
export function spanishToEnglishName(name: string): string | undefined {
  return SPANISH_TO_ENGLISH[normalizeName(name)];
}
