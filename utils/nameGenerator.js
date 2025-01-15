import { readFileSync } from 'fs';
import { join } from 'path';

// Load word lists
const loadWordList = (type, lang = 'en') => {
  const path = join(process.cwd(), 'data', type, `${lang}.txt`);
  try {
    return readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  } catch (error) {
    console.error(`Error loading ${type} list for ${lang}:`, error);
    return [];
  }
};

const adjectives = loadWordList('adjectives');
const nouns = loadWordList('nouns');

export function generateUsername() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective}-${noun}`;
} 