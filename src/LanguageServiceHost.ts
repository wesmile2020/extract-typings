import ts from 'typescript';

class LanguageServiceHost implements ts.LanguageServiceHost {
  private _compilerOptions: ts.CompilerOptions;

  constructor(compilerOptions: ts.CompilerOptions) {
    this._compilerOptions = compilerOptions;
  }

  getCompilationSettings(): ts.CompilerOptions {
    return this._compilerOptions;
  }

  getScriptFileNames(): string[] {
    return [];
  }

  getScriptVersion(fileName: string): string {
    return '0';
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    return undefined;
  }

  getCurrentDirectory(): string {
    return process.cwd();
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    return ts.getDefaultLibFilePath(options);
  }

  fileExists(fileName: string): boolean {
    return ts.sys.fileExists(fileName);
  }

  readFile(fileName: string): string | undefined {
    return ts.sys.readFile(fileName);
  }

  readDirectory(
    path: string,
    extensions?: readonly string[],
    exclude?: readonly string[],
    include?: readonly string[],
    depth?: number
  ): string[] {
    return ts.sys.readDirectory(path, extensions, exclude, include, depth);
  }

  getDirectories(path: string): string[] {
    return ts.sys.getDirectories(path);
  }
}

export { LanguageServiceHost };