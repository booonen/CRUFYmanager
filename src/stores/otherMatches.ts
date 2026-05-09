import type { OtherMatch } from '../domain/otherMatches';
import { useSavefileStore } from './savefile';

export function useOtherMatches(): OtherMatch[] {
  return useSavefileStore((s) => s.savefile?.otherMatches ?? []);
}
