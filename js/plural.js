/** plural(2, 'case') -> "2 cases"; plural(1, 'entry', 'entries') -> "1 entry". */
export const plural = (n, word, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;
