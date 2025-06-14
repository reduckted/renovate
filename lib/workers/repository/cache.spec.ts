import { REPOSITORY_CHANGED } from '../../constants/error-messages';
import type { Pr } from '../../modules/platform';
import * as _cache from '../../util/cache/repository';
import type {
  BranchUpgradeCache,
  RepoCacheData,
} from '../../util/cache/repository/types';
import * as _behindBaseBranchCache from '../../util/git/behind-base-branch-cache';
import * as _cachedFiles from '../../util/git/cached-files';
import * as _conflictsCache from '../../util/git/conflicts-cache';
import * as _modifiedCache from '../../util/git/modified-cache';
import * as _pristine from '../../util/git/pristine';
import type { LongCommitSha } from '../../util/git/types';
import { setBranchCache } from './cache';
import * as _prCache from './update/pr/pr-cache';
import { logger, partial, platform, scm } from '~test/util';

vi.mock('../../util/cache/repository');
vi.mock('../../util/git/behind-base-branch-cache');
vi.mock('../../util/git/modified-cache');
vi.mock('../../util/git/conflicts-cache');
vi.mock('../../util/git/pristine');
vi.mock('../../util/git/cached-files');
vi.mock('./update/pr/pr-cache');

const cache = vi.mocked(_cache);
const behindBaseBranchCache = vi.mocked(_behindBaseBranchCache);
const modifiedCache = vi.mocked(_modifiedCache);
const conflictsCache = vi.mocked(_conflictsCache);
const pristine = vi.mocked(_pristine);
const cachedFiles = vi.mocked(_cachedFiles);
const prCache = vi.mocked(_prCache);

describe('workers/repository/cache', () => {
  let repoCache: RepoCacheData = {};

  const upgrade: BranchUpgradeCache = {
    datasource: 'a',
    depName: 'b',
    depType: 'c',
    displayPending: 'd',
    packageName: 'e',
    fixedVersion: '2.0.0',
    currentVersion: '1.0.0',
    newVersion: '3.0.0',
    currentValue: 'f',
    newValue: 'g',
    currentDigest: 'h',
    newDigest: 'i',
    packageFile: 'j',
    sourceUrl: 'k',
    remediationNotPossible: true,
    updateType: 'major',
  };

  beforeEach(() => {
    repoCache = {};
    cache.getCache.mockReturnValue(repoCache);

    scm.getBranchCommit.mockImplementation((name) => {
      let sha: string | null = null;
      switch (name) {
        case 'first':
          sha = 'firstSha';
          break;
        case 'second':
          sha = 'secondSha';
          break;
        case 'base':
          sha = 'baseSha';
          break;
      }
      return Promise.resolve(sha as LongCommitSha | null);
    });

    pristine.getCachedPristineResult.mockReturnValue(false);
    platform.getBranchPr.mockResolvedValue(null);
    modifiedCache.getCachedModifiedResult.mockReturnValue(false);
    behindBaseBranchCache.getCachedBehindBaseResult.mockReturnValue(false);
    conflictsCache.getCachedConflictResult.mockReturnValue(false);
    prCache.getPrCache.mockReturnValue(null);
    cachedFiles.getCachedFiles.mockReturnValue([]);
  });

  describe('setBranchCache()', () => {
    it('builds branch cache for the given branches', async () => {
      prCache.getPrCache.mockImplementation((name) => {
        switch (name) {
          case 'first':
            return { bodyFingerprint: 'firstBody', lastEdited: 'firstEdited' };
          default:
            return null;
        }
      });
      cachedFiles.getCachedFiles.mockImplementation((name) => {
        switch (name) {
          case 'first':
            return [
              { path: 'a.txt', type: 'addition' },
              { path: 'b.txt', type: 'deletion' },
            ];
          default:
            return [];
        }
      });

      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          prBlockedBy: 'AwaitingTests',
          prTitle: 'First PR',
          result: 'already-existed',
          prNo: undefined,
          automerge: true,
          upgrades: [
            {
              ...upgrade,
              branchName: 'first',
              manager: 'test',
              displayPending: 'x',
            },
          ],
          commitFingerprint: '123',
        },
        {
          branchName: 'second',
          baseBranch: 'base',
          manager: 'test',
          prBlockedBy: 'AwaitingTests',
          prTitle: 'Second PR',
          result: 'needs-pr-approval',
          prNo: undefined,
          automerge: true,
          upgrades: [
            {
              ...upgrade,
              branchName: 'first',
              manager: 'test',
              displayPending: 'y',
            },
            {
              ...upgrade,
              branchName: 'first',
              manager: 'test',
              displayPending: 'z',
            },
          ],
          commitFingerprint: '123',
        },
      ]);

      expect(repoCache.branches).toMatchSnapshot();
    });

    it('with base branch sha, branch sha, branch pr', async () => {
      platform.getBranchPr.mockResolvedValue(partial<Pr>({ number: 123 }));

      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          prNo: 42,
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ prNo: 123 }),
      ]);
    });

    it('with base branch, branch sha, no branch pr', async () => {
      platform.getBranchPr.mockResolvedValue(null);

      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          prNo: 42,
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ prNo: null }),
      ]);
    });

    it('with base branch sha, no branch sha, pr number', async () => {
      platform.getBranchPr.mockResolvedValue(partial<Pr>({ number: 123 }));

      await setBranchCache([
        {
          branchName: 'unknown',
          baseBranch: 'base',
          manager: 'test',
          prNo: 42,
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ prNo: 42 }),
      ]);
    });

    it('with base branch sha, no branch sha, no pr number', async () => {
      platform.getBranchPr.mockResolvedValue(partial<Pr>({ number: 123 }));

      await setBranchCache([
        {
          branchName: 'unknown',
          baseBranch: 'base',
          manager: 'test',
          prNo: undefined,
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ prNo: null }),
      ]);
    });

    it.each([
      { cached: true, expected: true },
      { cached: false, expected: false },
      { cached: null, expected: undefined },
    ])('with isModified=$cached', async ({ cached, expected }) => {
      modifiedCache.getCachedModifiedResult.mockReturnValue(cached);

      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ isModified: expected }),
      ]);
      expect(
        modifiedCache.getCachedModifiedResult,
      ).toHaveBeenCalledExactlyOnceWith('first', 'firstSha');
    });

    it.each([
      { cached: true, expected: true },
      { cached: false, expected: false },
      { cached: null, expected: undefined },
    ])('with isBehindBase=$cached', async ({ cached, expected }) => {
      behindBaseBranchCache.getCachedBehindBaseResult.mockReturnValue(cached);

      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ isBehindBase: expected }),
      ]);
      expect(
        behindBaseBranchCache.getCachedBehindBaseResult,
      ).toHaveBeenCalledExactlyOnceWith('first', 'firstSha', 'base', 'baseSha');
    });

    it.each([
      { cached: true, expected: true },
      { cached: false, expected: false },
      { cached: null, expected: undefined },
    ])('with isConflicted=$cached', async ({ cached, expected }) => {
      conflictsCache.getCachedConflictResult.mockReturnValue(cached);

      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ isConflicted: expected }),
      ]);
      expect(
        conflictsCache.getCachedConflictResult,
      ).toHaveBeenCalledExactlyOnceWith('first', 'firstSha', 'base', 'baseSha');
    });

    it.each([
      { input: true, expected: true },
      { input: false, expected: false },
      { input: undefined, expected: false },
    ])('with automerge=$0', async ({ input, expected }) => {
      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          automerge: input,
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([
        expect.objectContaining({ automerge: expected }),
      ]);
    });

    it('throws if repository changed', async () => {
      const error = new Error(REPOSITORY_CHANGED);
      platform.getBranchPr.mockRejectedValue(error);

      await expect(() =>
        setBranchCache([
          {
            branchName: 'first',
            baseBranch: 'base',
            manager: 'test',
            upgrades: [],
          },
        ]),
      ).rejects.toThrowError(error);
    });

    it.each([401, 404])(
      'logs warning and does not cache branch if HTTP $0 error occurs',
      async (statusCode) => {
        const error = Object.assign(new Error(), { response: { statusCode } });
        platform.getBranchPr.mockRejectedValue(error);

        await setBranchCache([
          {
            branchName: 'first',
            baseBranch: 'base',
            manager: 'test',
            upgrades: [],
          },
        ]);

        expect(repoCache.branches).toEqual([]);
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { err: error, branchName: 'first' },
          'HTTP error generating branch cache',
        );
      },
    );

    it('logs error and does not cache branch if other error occurs', async () => {
      const error = Object.assign(new Error(), { statusCode: 500 });
      platform.getBranchPr.mockRejectedValue(error);

      await setBranchCache([
        {
          branchName: 'first',
          baseBranch: 'base',
          manager: 'test',
          upgrades: [],
        },
      ]);

      expect(repoCache.branches).toEqual([]);
      expect(logger.logger.error).toHaveBeenCalledWith(
        { err: error, branchName: 'first' },
        'Error generating branch cache',
      );
    });
  });
});
