import ts from 'typescript';

class ScriptCache {
  private _version: number = 0;
  private _snapshot: ts.IScriptSnapshot;

  constructor(code: string) {
    this._snapshot = ts.ScriptSnapshot.fromString(code);
  }
  
  update(code: string) {
    this._version += 1;
    this._snapshot = ts.ScriptSnapshot.fromString(code);
  }

  get version(): number {
    return this._version;
  }

  get snapshot(): ts.IScriptSnapshot {
    return this._snapshot;
  }
}

class LanguageServiceHost implements ts.LanguageServiceHost {
  private _compilerOptions: ts.CompilerOptions;
  private _cache: Map<string, ScriptCache> = new Map();
  private _rootPath: string;

  constructor(compilerOptions: ts.CompilerOptions, rootPath: string) {
    this._compilerOptions = compilerOptions;
    this._rootPath = rootPath;
  }

  getCompilationSettings(): ts.CompilerOptions {
    return this._compilerOptions;
  }

  getScriptFileNames(): string[] {
    return [...this._cache.keys()];
  }

  getScriptVersion(fileName: string): string {
    return this._cache.get(fileName)?.version.toString() || '0';
  }

  setScriptSnapshot(fileName: string, code: string): void {
    let cahce = this._cache.get(fileName);
    if (cahce) {
      cahce.update(code);
    } else {
      cahce = new ScriptCache(code);
      this._cache.set(fileName, cahce);
    }
  }
  
  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    return this._cache.get(fileName)?.snapshot;
  }

  getCurrentDirectory(): string {
    return this._rootPath;
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