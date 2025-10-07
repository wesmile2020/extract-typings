# extract-typings

用于提取ts项目声明文件(.d.ts)的一个工具库

## usage

### Install

```bash
npm install extract-typings --save-dev
```

### Command Line

Execute the following command will extract the `d.ts` files related to `./src/index.ts` output to directory `dist/typings`
```bash
extract-typings ./src/index.ts -o dist/typings -f index.d.ts -c 
```

### Options
- -o: output directory default is `dist/typings`;
- -f output entry file name default is `main.d.ts`;
- -c if add this param, will clear your output directory;


### Node API

创建 extract.js 在项目的根目录
```javascript
const { generate } = require('extract-typings');
const path = require('path');

generate({
  input: path.resolve(__dirname, 'src/index.ts'), // 入口文件
  output: path.resolve(__dirname, 'dist/typings'), // 存放生成文件的目录
});
```

执行一下命令将会自动提取 .d.ts
```bash
node ./extract.js
```

### Options

- input: string; required, 入口文件
- output: string; required, 存放生成文件的目录
- autoClear: boolean; default is true, 是否自动清空output文件夹
- extensions: string[]; default is ['.js', '.ts', '.tsx', '.jsx']; 文件后缀名
