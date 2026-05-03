import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isString } from '@sindresorhus/is';
import { simpleGit } from 'simple-git';
import upath from 'upath';
import type { Mock } from 'vitest';
import * as utils from '../exec/utils.ts';
import { createSimpleGit } from './simple-git.ts';

describe('util/git/simple-git', () => {
  describe('createSimpleGit', () => {
    let directory: string;
    let getChildEnv: Mock<typeof utils.getChildEnv>;

    beforeEach(async () => {
      getChildEnv = vi
        .spyOn(utils, 'getChildEnv')
        .mockImplementation((args) => {
          const result: Record<string, string> = {};
          for (const [key, val] of Object.entries(args?.env ?? {})) {
            if (isString(val)) {
              result[key] = `${val}`;
            }
          }

          return result;
        });

      directory = upath.join(tmpdir(), 'simple-git-test');
      await mkdir(directory, { recursive: true });

      // Create a SimpleGit instance directly so that we
      // can create a Git repository to run the tests in.
      const git = simpleGit({ baseDir: directory });
      await git.init();
      await git.addConfig('user.name', 'test');
    });

    afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
    });

    it('can create SimpleGit instance with no custom config or environment', async () => {
      const cwd = process.cwd();
      process.chdir(directory);
      try {
        const git = createSimpleGit();

        const config = await git.raw('config', 'list');
        expect(config).toContain('user.name=test');

        expect(getChildEnv).toHaveBeenCalledWith({ env: undefined });
      } finally {
        process.chdir(cwd);
      }
    });

    it('can create SimpleGit instance with custom config', async () => {
      const git = createSimpleGit({ config: { baseDir: directory } });

      const config = await git.raw('config', 'list');
      expect(config).toContain('user.name=test');

      expect(getChildEnv).toHaveBeenCalledWith({ env: undefined });
    });

    it('can use GIT_CONFIG environment variables', async () => {
      const git = createSimpleGit({
        config: { baseDir: directory },
        env: {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'foo.bar',
          GIT_CONFIG_VALUE_0: 'baz',
        },
      });

      const config = await git.raw('config', 'list');
      expect(config).toContain('foo.bar=baz');

      expect(getChildEnv).toHaveBeenCalledWith({
        env: {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'foo.bar',
          GIT_CONFIG_VALUE_0: 'baz',
        },
      });
    });

    it('can use GIT_SSH_COMMAND environment variable', async () => {
      const git = createSimpleGit({
        config: { baseDir: directory },
        env: {
          GIT_SSH_COMMAND: 'echo',
        },
      });
      const config = await git.raw('config', 'list');
      expect(config).toContain('user.name=test');

      expect(getChildEnv).toHaveBeenCalledWith({
        env: {
          GIT_SSH_COMMAND: 'echo',
        },
      });
    });
  });
});
