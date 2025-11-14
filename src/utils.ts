import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ts from 'typescript';

export function eachFile(url: string, ignore: RegExp, callback: (filePath: string) => void): void {
  if (ignore.test(url)) {
    return;
  }
  
  const stat = fs.statSync(url);
  if (stat.isDirectory()) {
    const dirs = fs.readdirSync(url);
    for (let i = 0; i < dirs.length; i++) {
      const nextUrl = path.resolve(url, dirs[i]);
      eachFile(nextUrl, ignore, callback);
    }
  } else if (stat.isFile()) {
    callback(url);
  } else if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(url);
    eachFile(target, ignore, callback);
  }
}

export function findTypings(rootPath: string): string[] {
  const typings: string[] = [];
  
  eachFile(rootPath, /node_modules/, (filePath) => {
    if (/\.d\.ts$/.test(filePath)) {
      typings.push(filePath);
    }
  });
  
  return typings;
}

export function deleteFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const dirs = fs.readdirSync(filePath);
    for (let i = 0; i < dirs.length; i++) {
      const nextUrl = path.resolve(filePath, dirs[i]);
      deleteFile(nextUrl);
    }
    fs.rmdirSync(filePath);
  } else {
    fs.unlinkSync(filePath);
  }
}

export function getFileName(url: string): string {
  const basename = path.basename(url);
  const extname = path.extname(url);
  return basename.slice(0, basename.length - extname.length);
}

export function logError(...message: unknown[]): void {
  console.error(chalk.red(...message));
}

export function logWarning(...message: unknown[]): void {
  console.warn(chalk.yellow(...message));
}

export function logInfo(...message: unknown[]): void {
  console.info(chalk.blue(...message));
}

export function logSuccess(...message: unknown[]): void {
  console.log(chalk.green(...message));
}

export function visitASTNode(node: ts.Node, callback: (node: ts.Node) => void): void {
  ts.forEachChild(node, (child) => {
    callback(child);
    visitASTNode(child, callback);
  });
}

export function getDependencies(ast: ts.SourceFile): string[] {
  const dependencies: string[] = [];
  visitASTNode(ast, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
        dependencies.push(moduleSpecifier.text);
      }
    } else if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (expression.kind === ts.SyntaxKind.Identifier) {
        const identifier = expression as ts.Identifier;
        if (identifier.text === 'require' && node.arguments.length > 0) {
          const argument = node.arguments[0];
          if (ts.isStringLiteral(argument)) {
            dependencies.push(argument.text);
          }
        }
      }
    }
  });
  return dependencies;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function readJsonSync(filePath: string): any {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }
  return null;
}
