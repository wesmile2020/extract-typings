# extract-typings

a tool to extract typings from ts project.

## Usage

### Install

```bash
npm install extract-typings --save-dev
```

### Command Line

Execute the following command will extract the `d.ts` files related to `./src/index.ts` output to directory `dist/typings`
```bash
extract-typings -e ./src/index.ts -o dist/typings -f index.d.ts -c 
```

### Options
- -e: entry file path; required;
- -o: output directory default is `dist/typings`;
- -f output entry file name default is `main.d.ts`;
- -c if add this param, will clear your output directory;
- -p: tsconfig.json file path;


### Node API 

First, create a file named `extract.js` in the root directory of your project.
```javascript
const { generate } = require('extract-typings');
const path = require('path');

generate({
  entry: path.resolve(__dirname, 'src/index.ts'),
  output: path.resolve(__dirname, 'dist/typings'),
});
```

Then, run the following command to extract typings:
```bash
node ./extract.js
```

### Options

- entry: string; required; entry file path;
- outdir: string; required; output directory path;
- autoClean: boolean; default is false; whether to clean output directory before extract;
- fileName: string; default is 'index.d.ts'; output file name;
- project: string; tsconfig.json file path;

