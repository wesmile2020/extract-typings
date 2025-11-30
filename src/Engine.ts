import path from 'path';
import ts from 'typescript';
import {
  type MatchPath,
  createMatchPath,
} from 'tsconfig-paths';
import { JSON2Dts } from 'convert_json2dts';
import { LanguageServiceHost } from './LanguageServiceHost';
import {
  findTypings,
  getDependencies,
  logError,
  readJsonSync
} from './utils';

const EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.d.tsx', '.js', '.jsx'];

interface TransformedOutput {
  declaration: string;
  dependencies: string[];
}

class Engine {
  private _host: LanguageServiceHost;
  private _service: ts.LanguageService;
  /** Record output file name use count */
  private _nameIndices: Map<string, number> = new Map();
  /** Record module name and output file name mapping */
  private _moduleNameMap: Map<string, string> = new Map();
  private _matchPath: MatchPath;
  private _json2dts: JSON2Dts = new JSON2Dts();
  private _extensionsSet: Set<string> = new Set(EXTENSIONS);
  
  constructor(rootPath: string) {
    const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists);
    if (!configPath) {
      throw new Error(`Could not find a valid 'tsconfig.json' file in the current directory.`);
    }
    // TODO: support reference tsconfig.json
    const { error, config } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) {
      throw new Error(`Error reading 'tsconfig.json': ${error.messageText}`);
    }
    const compilerOptions = {
      ...config.compilerOptions,
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
    };
    const { options, errors } = ts.convertCompilerOptionsFromJson(compilerOptions, rootPath);
    if (errors.length > 0) {
      const errorMessage = errors.map(error => error.messageText).join('\n');
      throw new Error(`Error converting compiler options: ${errorMessage}`);
    }
    this._matchPath = createMatchPath(options.baseUrl ?? rootPath, options.paths ?? {});

    this._host = new LanguageServiceHost(options, rootPath);
    const typings = findTypings(rootPath);
    for (let i = 0; i < typings.length; i += 1) {
      const code = ts.sys.readFile(typings[i], 'utf8') ?? '';
      this._host.setScriptCache(typings[i], code);
    }
    
    this._service = ts.createLanguageService(this._host, ts.createDocumentRegistry());
    
    const diagnostics = this._service.getCompilerOptionsDiagnostics();
    if (diagnostics.length > 0) {
      let message = '';
      for (let i = 0; i < diagnostics.length; i += 1) {
        message += ts.flattenDiagnosticMessageText(diagnostics[i].messageText, '\n');
        const { file, start } = diagnostics[i];
        if (file && typeof start === 'number') {
          const { line, character } = file.getLineAndCharacterOfPosition(start);
          message += `${file.fileName} (${line + 1},${character + 1})`;
        }
        message += '\n';
      }
      throw new Error(`Error: ${message}`);
    }
  }
  
  private _transform(url: string): TransformedOutput | null {
    console.log('transform', url);
    
    if (/\.json$/.test(url)) {
      const jsonCode = ts.sys.readFile(url) ?? '';
      try {
        const json = JSON.parse(jsonCode);
        const declaration = this._json2dts.convertJSONToDts(json);
        return {
          declaration,
          dependencies: [],
        };
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      } catch (_error: unknown) {
        logError(`Error: Failed to transform JSON file ${url}`);
        return null;
      }
    }

    const code = ts.sys.readFile(url, 'utf8') ?? '';
    this._host.setScriptCache(url, code);

    const output = this._service.getEmitOutput(url, true, true);
    if (output.emitSkipped) {
      logError(`Error: Failed to emit ${url} declaration file`);
      return null;
    }
    const declaration = output.outputFiles.find((file) => /\.d\.ts$/.test(file.name));
    if (!declaration) {
      logError(`Error: Failed to emit ${url} declaration file`);
      return null;
    }
    const diagnostics = [
      ...this._service.getSyntacticDiagnostics(url),
      ...this._service.getSemanticDiagnostics(url)
    ];
    if (diagnostics.length > 0) {
      logError(`Generate declaration file for ${url} with ${diagnostics.length} errors`);
      for (let i = 0; i < diagnostics.length; i += 1) {
       let message = ts.flattenDiagnosticMessageText(diagnostics[i].messageText, '\n');
        const { file, start } = diagnostics[i];
        if (file && typeof start === 'number') {
          const { line, character } = file.getLineAndCharacterOfPosition(start);
          message += ` on (${file.fileName}:${line + 1}:${character + 1})`;
        }
        logError(`Error: ${message}`);
      }
    }
    // get declaration ast
    this._host.setScriptCache(declaration.name, declaration.text);
    const sourceFile = this._service.getProgram()?.getSourceFile(declaration.name);
    const transformedDependencies: string[] = [];
    let transformedDeclaration = declaration.text;
    if (sourceFile) {
      const dependencies = getDependencies(sourceFile);
      for (let i = 0; i < dependencies.length; i += 1) {
        const dependenceUrl = this._findPath(dependencies[i], url);
        if (!dependenceUrl) {
          continue;
        }
        const moduleName = this._getUniqueName(dependenceUrl);
        transformedDeclaration = transformedDeclaration.replaceAll(dependencies[i], `./${moduleName}`);
        transformedDependencies.push(dependenceUrl);
      }
    }

    return {
      declaration: transformedDeclaration,
      dependencies: transformedDependencies,
    };
  }
  
  private _findPath(moduleName: string, importer: string): string | null {
    let url = this._matchPath(moduleName, readJsonSync, ts.sys.fileExists, EXTENSIONS);
    if (url) {
      url = path.resolve(url);
    } else {
      const dirname = path.dirname(importer);
      url = path.resolve(dirname, moduleName);
    }

    if (ts.sys.fileExists(url)) {
      return url;
    }
    for (let i = 0; i < EXTENSIONS.length; i += 1) {
      const candidate = `${url}${EXTENSIONS[i]}`;
      if (ts.sys.fileExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }
  
  private _getUniqueName(url: string): string {
    let name = this._moduleNameMap.get(url);
    if (!name) {
      const basename = path.basename(url);
      const extname = path.extname(url);
      if (this._extensionsSet.has(extname)) {
        name = basename.slice(0, basename.length - extname.length);
      } else {
        name = basename;
      }
      let count = 0;
      if (this._nameIndices.has(name)) {
        /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
        count = this._nameIndices.get(name)!;
        name = `${name}_${count + 1}`;
      }
      this._nameIndices.set(name, count + 1);
      this._moduleNameMap.set(url, name);
    }

    return name;
  }

  generate(entry: string, outdir: string, fileName: string): void {
    this._nameIndices.clear();
    this._moduleNameMap.clear();
    
    let isFirst = true;
    const queue: string[] = [];
    if (ts.sys.fileExists(entry)) {
      queue.push(entry);
    } else {
      logError(`The entry file ${entry} not found`);
    }
    const circleSet: Set<string> = new Set();
    while (queue.length > 0) {
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      const current = queue.pop()!;
      if (circleSet.has(current)) {
        continue;
      }
      circleSet.add(current);
      const outFileName = isFirst ? fileName : this._getUniqueName(current);
      const outPath = path.resolve(outdir, outFileName) + '.d.ts';
      isFirst = false;
      const transformed = this._transform(current);
      if (transformed) {
        ts.sys.writeFile(outPath, transformed.declaration);
        queue.push(...transformed.dependencies);
      }
    }
  }
}

export { Engine };
