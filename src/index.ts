import { Engine } from './Engine';
import { createDirectory, deleteFile } from './utils';

export { version } from '~/package.json';

export interface ExtractOptions {
  /** entry file path */
  entry: string;
  /** output directory path */
  outdir: string;
  /** auto clean output directory default is false */
  autoClean?: boolean;
  /** output file name default is 'index.d.ts' */
  fileName?: string;
  /** tsconfig.json file path default is 'tsconfig.json' */
  project?: string;
}

export function extract(options: ExtractOptions): void {
  const engine = new Engine({
    rootPath: process.cwd(),
    project: options.project,
  });

  const { entry, outdir, autoClean, fileName = 'index.d.ts' } = options;

  createDirectory(outdir);

  if (autoClean) {
    deleteFile(outdir);
  }

  engine.generate(entry, outdir, fileName);
}