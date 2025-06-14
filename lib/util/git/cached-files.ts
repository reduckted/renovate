import { logger } from '../../logger';
import { getCache } from '../cache/repository';
import type { BranchCache, FileChangeCache } from '../cache/repository/types';
import type { FileChange } from './types';

export function getCachedFiles(branchName: string): FileChangeCache[] {
  const cache = getCache();
  const branch = cache.branches?.find((br) => br.branchName === branchName);
  return branch?.files ? [...branch.files] : [];
}

export function setCachedFiles(branchName: string, files: FileChange[]): void {
  logger.debug('setCachedFiles()');
  const cache = getCache();
  cache.branches ??= [];
  let branch = cache.branches.find((br) => br.branchName === branchName);
  if (!branch) {
    logger.debug(`setCachedFiles(): Branch cache not present`); // should never be called
    branch = {
      branchName,
    } as BranchCache;
    cache.branches.push(branch);
  }

  branch.files = files.map((file) => ({
    type: file.type,
    path: file.path,
  }));
}
