import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const generate = customAlphabet(alphabet, 16);

export function newId(): string {
  return generate();
}

export function newSaveId(): string {
  return `save_${generate()}`;
}
