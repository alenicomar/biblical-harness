/** Lowercase, diacritics stripped, whitespace collapsed: "  José  " -> "jose". */
export function normalizeName(name) {
    return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
