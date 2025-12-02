import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ts from 'typescript';

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

export function createDirectory(dirPath: string): void {
  const url = path.resolve(dirPath);
  const pathSegments = url.split(path.sep);
  for (let i = 1; i <= pathSegments.length; i++) {
    const dir = pathSegments.slice(0, i).join(path.sep);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
  }
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

export function formatTimeDuration(duration: number): string {
  if (duration < 1000) {
    return `${duration.toFixed(0)}ms`;
  } else if (duration < 60 * 1000) {
    const seconds = (duration / 1000).toFixed(2);
    return `${seconds}s`;
  } else if (duration < 60 * 60 * 1000) {
    const minutes = Math.floor(duration / (60 * 1000));
    const seconds = ((duration % (60 * 1000)) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(duration / (60 * 60 * 1000));
  const minutes = Math.floor((duration % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = ((duration % (60 * 1000)) % 60).toFixed(0);
  return `${hours}h ${minutes}m ${seconds}s`;
}
