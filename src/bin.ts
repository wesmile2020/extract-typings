import path from 'path';
import { logError } from './utils';
import { extract } from './index';

function resolve(...dirs: string[]) {
  return path.resolve(process.cwd(), ...dirs);
}

/**
 * Run the extract-typings tool.
 * 
 */
function run() {
  const args = process.argv.slice(2);

  let entry = '';
  const entryIdx = args.indexOf('-e');
  if (entryIdx >= 0 && entryIdx < args.length - 1) {
    entry = resolve(args[entryIdx + 1]);
  }
  if (!entry) {
    logError('extract-typings: Please type entry file path.');
    return;
  }

  const outIdx = args.indexOf('-o');
  let output = resolve('dist', 'typings');
  if (outIdx >= 0 && outIdx < args.length - 1) {
    output = resolve(args[outIdx + 1]);
  }

  const fileNameIdx = args.indexOf('-f');
  let fileName = 'index';
  if (fileNameIdx >= 0 && fileNameIdx < args.length - 1) {
    fileName = args[fileNameIdx + 1];
  }

  try {
    extract({
      entry: entry,
      outdir: output,
      autoClean: args.includes('-c'),
      fileName,
    });
  } catch (error) {
    logError((error as Error).message);
  }
}

run();
