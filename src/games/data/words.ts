import fs from 'fs';

// Get words from words.txt
const rawText = fs.readFileSync('./src/games/data/words.txt').toString();
export const WORDUEL_WORDS: string[] = rawText.split(/\r?\n/);
