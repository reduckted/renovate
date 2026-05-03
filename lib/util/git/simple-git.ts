import type { SimpleGit, SimpleGitOptions } from 'simple-git';
import { simpleGit } from 'simple-git';
import type { ExtraEnv } from '../exec/types.ts';
import { getChildEnv } from '../exec/utils.ts';
import { simpleGitConfig } from './config.ts';

export function createSimpleGit({
  config,
  env,
}: {
  config?: Partial<SimpleGitOptions>;
  env?: ExtraEnv;
} = {}): SimpleGit {
  return simpleGit({ ...simpleGitConfig(), ...config }).env(
    getChildEnv({ env }),
  );
}
