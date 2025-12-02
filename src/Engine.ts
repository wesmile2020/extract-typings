import path from 'path';
import ts from 'typescript';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import {
  type MatchPath,
  createMatchPath,
} from 'tsconfig-paths';
import { JSON2Dts } from 'convert_json2dts';
import { LanguageServiceHost } from './LanguageServiceHost';
import {
  formatTimeDuration,
  getDependencies,
  logError,
  readJsonSync,
  sleep
} from './utils';

const EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.d.tsx', '.js', '.jsx', '.json'];

interface TransformedOutput {
  declaration: string;
  dependencies: string[];
  errors: string[];
}

interface EngineOptions {
  rootPath: string;
  project?: string;
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
  private _spinner: Ora = ora('Initializing...');
  
  constructor(options: EngineOptions) {
    const { rootPath, project } = options;
    const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists, project);
    if (!configPath) {
      throw new Error(`Could not find a valid 'tsconfig.json' file in the current directory.`);
    }
    const { error, config } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) {
      throw new Error(`Error reading 'tsconfig.json': ${error.messageText}`);
    }
    const { options: compilerOptions, projectReferences, fileNames } = ts.parseJsonConfigFileContent(config, ts.sys, rootPath, {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
    }, configPath);

    this._matchPath = createMatchPath(compilerOptions.baseUrl ?? rootPath, compilerOptions.paths ?? {});
    this._host = new LanguageServiceHost(compilerOptions, rootPath);
    if (projectReferences) {
      this._host.setProjectReferences(projectReferences);
    }

    for (let i = 0; i < fileNames.length; i += 1) {
      const url = path.resolve(rootPath, fileNames[i]);
      const code = ts.sys.readFile(url, 'utf8') ?? '';
      this._host.setScriptCache(url, code);
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

  private _relativePath(url: string): string {
    const relativePath = path.relative(this._host.getCurrentDirectory(), url);
    return relativePath.replaceAll('\\', '/');
  }
  
  private async _transform(url: string): Promise<TransformedOutput> {
    const filePath = this._relativePath(url);
    this._spinner.text = `Emitting ${chalk.cyan(filePath)} d.ts file`;
    // sleep 0ms to let the spinner update
    await sleep(0);
    if (/\.json$/.test(url)) {
      const jsonCode = ts.sys.readFile(url) ?? '';
      try {
        const json = JSON.parse(jsonCode);
        const declaration = this._json2dts.convertJSONToDts(json);
        return {
          declaration,
          dependencies: [],
          errors: [],
        };
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      } catch (_error: unknown) {
        return {
          declaration: '',
          dependencies: [],
          errors: [`${chalk.cyan(filePath)} ${chalk.red('Error: Invalid JSON file.')}`],
        };
      }
    }

    if (!this._host.containScript(url)) {
      const code = ts.sys.readFile(url, 'utf8') ?? '';
      this._host.setScriptCache(url, code);
    }

    const output = this._service.getEmitOutput(url, true, true);
    const declaration = output.outputFiles.find((file) => /\.d\.ts$/.test(file.name));
    if (!declaration) {
      return {
        declaration: '',
        dependencies: [],
        errors: [`${chalk.cyan(filePath)} ${chalk.red('Error: Failed to emit declaration file.')}`],
      };
    }
    const diagnostics = [
      ...this._service.getSyntacticDiagnostics(url),
      ...this._service.getSemanticDiagnostics(url),
    ];

    const errors: string[] = [];
    if (diagnostics.length > 0) {
      for (let i = 0; i < diagnostics.length; i += 1) {
        let errorFilePath = filePath;
        const { file, start } = diagnostics[i];
        if (file && typeof start === 'number') {
          const { line, character } = file.getLineAndCharacterOfPosition(start);
          errorFilePath += `:${line + 1}:${character + 1}`;
        }
        const errorMessage = ts.flattenDiagnosticMessageText(diagnostics[i].messageText, '\n');
        errors.push(`${chalk.cyan(errorFilePath)} ${chalk.red('Error', errorMessage)}`);
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
        const suffix = path.extname(dependenceUrl);
        if (this._extensionsSet.has(suffix)) {
          transformedDependencies.push(dependenceUrl);
        }
      }
    }

    return {
      declaration: transformedDeclaration,
      dependencies: transformedDependencies,
      errors,
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

  async generate(entry: string, outdir: string, fileName: string): Promise<void> {
    const start = performance.now();
    this._spinner.start();

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
    const errors: string[] = [];
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
      const transformed = await this._transform(current);
      if (transformed) {
        ts.sys.writeFile(outPath, transformed.declaration);
        queue.push(...transformed.dependencies);
        errors.push(...transformed.errors);
      }
    }
    const end = performance.now();
    if (errors.length > 0) {
      const failMessage = chalk.red(' Errors occurred during generation:');
      this._spinner.fail(failMessage);
      console.log(errors.join('\n'));
    } else {
      const successMessage = chalk.green(`Successfully generate typings in ${formatTimeDuration(end - start)}`);
      this._spinner.succeed(successMessage);
    }
  }
}

export { Engine };
