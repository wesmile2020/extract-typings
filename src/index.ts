import { Engine } from './Engine';
import { createDirectory, deleteFile, logSuccess } from './utils';

export { version } from '~/package.json';

export interface ExtractOptions {
  /** entry file path */
  entry: string;
  /** output directory path */
  outdir: string;
  /** auto clean output directory default is false */
  autoClean?: boolean;
  /** custom file name default is 'index.d.ts' */
  fileName?: string;
}

export function extract(options: ExtractOptions): void {
  const engine = new Engine(process.cwd());

  const { entry, outdir, autoClean, fileName = 'index.d.ts' } = options;

  createDirectory(outdir);

  if (autoClean) {
    deleteFile(outdir);
  }

  engine.generate(entry, outdir, fileName);

  logSuccess(`> Successfully extract typings to ${outdir}`);
}