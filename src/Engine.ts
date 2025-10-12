import ts from 'typescript';
import { LanguageServiceHost } from './LanguageServiceHost';

class Engine {
  private _host: LanguageServiceHost;
  private _service: ts.LanguageService;
  
  constructor(rootPath: string) {
    const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists);
    if (!configPath) {
      throw new Error(`Could not find a valid 'tsconfig.json' file in the current directory.`);
    }
    const { error, config } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) {
      throw new Error(`Error reading 'tsconfig.json': ${error.messageText}`);
    }
    const { options, errors } = ts.convertCompilerOptionsFromJson(config.compilerOptions, rootPath);
    if (errors.length > 0) {
      const errorMessage = errors.map(error => error.messageText).join('\n');
      throw new Error(`Error converting compiler options: ${errorMessage}`);
    }
    this._host = new LanguageServiceHost(options, rootPath);
    this._service = ts.createLanguageService(this._host);
  }
}

export { Engine };
