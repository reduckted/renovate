import * as _repositoryCache from '../cache/repository';
import type {
  BranchCache,
  FileChangeCache,
  RepoCacheData,
} from '../cache/repository/types';
import { getCachedFiles, setCachedFiles } from './cached-files';
import type { FileChange } from './types';
import { logger, partial } from '~test/util';

vi.mock('../cache/repository');
vi.mock('.');
const repositoryCache = vi.mocked(_repositoryCache);

describe('util/git/cached-files', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('setCachedFiles', () => {
    it('sets new branch in cache if it does not exist', () => {
      const files: FileChange[] = [
        { type: 'addition', path: 'alpha.js', contents: 'a' },
        { type: 'deletion', path: 'beta.js' },
      ];
      setCachedFiles('branch_name', files);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setCachedFiles(): Branch cache not present',
      );
      expect(repoCache.branches).toEqual([
        {
          branchName: 'branch_name',
          files: [
            { type: 'addition', path: 'alpha.js' },
            { type: 'deletion', path: 'beta.js' },
          ],
        },
      ]);
    });

    it('sets new values in branch when old state exists', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch_name',
            baseBranch: 'base_branch',
            sha: 'SHA',
            files: [{ type: 'addition', path: 'alpha.js' }],
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      setCachedFiles('branch_name', [{ type: 'deletion', path: 'beta.js' }]);
      expect(repoCache.branches).toEqual([
        {
          branchName: 'branch_name',
          baseBranch: 'base_branch',
          sha: 'SHA',
          files: [{ type: 'deletion', path: 'beta.js' }],
        },
      ]);
    });
  });

  describe('getCachedFiles', () => {
    it('gets files from branch in cache if it exists', () => {
      const cachedFiles: FileChangeCache[] = [
        { type: 'addition', path: 'alpha.js' },
        { type: 'deletion', path: 'beta.js' },
      ];
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch_name',
            files: cachedFiles,
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      const fetchedFiles = getCachedFiles('branch_name');
      expect(fetchedFiles).not.toBe(cachedFiles);
      expect(fetchedFiles).toEqual([
        { type: 'addition', path: 'alpha.js' },
        { type: 'deletion', path: 'beta.js' },
      ]);
    });

    it('gets empty array when branch is not in cache', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch_name',
            files: [
              { type: 'addition', path: 'alpha.js' },
              { type: 'deletion', path: 'beta.js' },
            ],
          }),
        ],
      };
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(getCachedFiles('other_branch')).toEqual([]);
    });
  });
});
