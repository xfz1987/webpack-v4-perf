# 构建速度提升和体积优化

# 构建速度优化
> 速度分析：speed-measure-webpack-plugin
> 可以查看每个loder和插件的执行耗时
> 红色字体表示时间过长，黄色还可以，绿色是OK的
```
module.exports = smg.wrap(webpackConfig)
```

## wepback4 vs wepback3
> webpack使用V8, for of 替代 forEach、Map和set代替Object、includes替代indexOf等
> 默认使用更快的 md4 hash 算法
> webpack AST 可以直接从 loader 传递给 AST，减少解析时间
> 使用字符串方案替代正则表达式，正则表达式运算较慢

## 多进程/多实例构建
> thread-loader（推荐：wepback4使用）
· 每次wepback解析一个模块，thread-loader会将它及它的依赖分配给worker线程中
```
module: {
  rules: [
    {
      test: /.js$/,
      // include: path.resolve('src'),
      use: [
        {
          loader: 'thread-loader',
          options: {
              workers: 3 // cpu核数*2 - 1
          }
        },
        'babel-loader',
      ]
    }
  ]
},
```
> happypack(wepback3使用，已经不在维护)
```
// 构造出共享进程池，进程池中包含4个子进程
const happyThreadPool = HappyPack.ThreadPool({ size: 4 });
module: {
    rules: [
      {
        test: /\.js$/,
        // 把对 .js 文件的处理转交给 id 为 babel 的 HappyPack 实例
        use: ['happypack/loader?id=happybabel'],
        exclude: /node_modules/,
      },
      {
        // 把对 .css 文件的处理转交给 id 为 css 的 HappyPack 实例
        test: /\.css$/,
        use: ['happypack/loader?id=happycss']
      },
    ]
},
plugins: [
    new HappyPack({
      id:"happybabel",
      loaders:['babel-loader?cacheDirectory'],
      threadPool:happyThreadPool,
      cache:true,
      verbose:true
    }),
    new HappyPack({
      id: 'happycss',
      // loaders: ['style-loader','css-loader','postcss-loader'],
      loaders: [
        {loader: 'style-loader'},
        {loader: 'css-loader',options:{minimize: false, importLoaders:1}},
        {loader: 'postcss-loader',options:{config: {path: path.resolve(__dirname, '../postcss.config.js')} }}
      ],
      threadPool: happyThreadPool,
    }),
]
```
> parallel-wwebpack

### 多进程/多实例：并行压缩
> 方式一：terser-webpack-plugin 开启 parallel参数（推荐wepback4使用）
· 支持ES6压缩
```
module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true, // 多线程
        cache: true // 开缓存
      })
    ]
  },
}
```
> 方式二：uglifyjs-wepback-plugin
· 不支持ES6压缩
```
plugins: [
  new UglifyJsPlugin({
    uglifyOptions: {
      warning: false,
      parse: {},
      compress: {},
      mangle: true,
      outpu: null,
      // ...
    },
    parallel: true
  })
]
```
> 方式三：parallel-uglify-plugin
· 不支持ES6压缩
```
module.exports = {
  plugins: [
    new ParallelUglifyPlugin({
      uglifyJS: {
        output: {
          beautify: false,
          comments: false
        },
        compress: {
          warnings: false,
          drop_console: ture,
          collapse_vars: true,
          reduce_vars: true
        }
      }
    })
  ]
}
```

## 缓存：提升二次构建速度（比较适合开发环境或静态打包服务器）
下面的几种方式同时使用，效果杠杠的

> babel-loader 开启缓存('babel-loader?cacheDirectory=true')
> TerserPlugin开启缓存(cache: true)
```
{
  test: /\.(js|jsx)$/,
  exclude: '/(node_modules)/',
  use: [
    {
      loader: 'thread-loader',
      options: {
          workers: 3 // cpu核数*2 - 1
      }
    },
    // here this code
    'babel-loader?cacheDirectory=true'
  ] 
}
```
> 使用cache-loader或 hard-source-webpack-plugin（强烈推荐，谁用谁知道）
> 12s -> 7s 多
```
plugins: [
  new HardSourceWebpackPlugin()
]
```


-------------------------------------


# 打包体积优化
> webpack-bundle-analyzer
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
```
plugins: [
  new BundleAnalyzerPlugin({ port: 3011 }) // 默认是 8888 端口
]
```

## 进一步分包：预编译资源模块 dll
> 将 react、react-dom、redux、react-redux基础包🈴️业务包打包成一个文件
> 方法：使用DLLPlugin进行分包，DllReferencePlugin对manifest.json引用
> 这么做的优势：开发和生产环境就可以直接跳过 react等的解析打包，加快热更新及打包速度
> 1.创建webpack.dev.js
```
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'none',
  context: __dirname,
  entry: {
    vendor: [
      'react',
      'react-dom',
      'react-router-dom',
      'mobx-react',
      'mobx',
      'rc-pagination',
      'react-topbar-progress-indicator',
      'simditor'
    ]
  },
  output: {
    filename: '[name]_[hash].dll.js',
    path: path.join(__dirname, '../dist/dll'),
    library: '[name]_[hash]' // 必须与下面的 DllPlugin中的name保持一致
  },
  resolve: {
    extensions: ['.js', 'jsx', '.json'],
  },
  plugins: [
    new webpack.DllPlugin({
      name: '[name]_[hash]',
      path: path.join(__dirname, '../dist/dll', '[name]-manifest.json'),
      context: __dirname
    })
  ]
};
```
> 2.生成dll
```
"scripts": {
  "dll": "rimraf ./dist && webpack --config ./build/webpack.dll.js",
},
npm run dll
```

> 3.在webpack.config.js引入
```
const dllJson = require('../dist/dll/vendor-manifest.json')
plugins: [
  new webpack.DllReferencePlugin({
    manifest: dllJson
  })
]
```
> 4.html动态引入xxxx.dll.js
```
const dllJson = require('../dist/dll/vendor-manifest.json')
new HtmlWebpackPlugin({
  filename: 'index.html',
  template: resolve(__dirname, '../src/index.html'),
  // 线上环境使用CDN，不过个人觉得开发环境用dll，线上环境不要用dll
  vendor: './dll/' + dllJson.name + '.dll.js'
})

html模版
// 一定要保证，dll.js 必须在其他js之前引用
<body>
  <div id="app"></div>
  <script type="text/javascript" src="<%= htmlWebpackPlugin.options.vendor %>"></script>
</body>
```

> 5.执行npm run build，发现那些被拆分的包，没有打进业务代码中


## 缩小构建目标
### 减少文件搜索范围
> 优化 resolve.modules配置（减少模块搜索层级）
> 优化 resolve.mainFields 配置
> 优化 resolve.extensions 配置
> 合理使用 alias
```
// webpack
resolve: {
  modules: [path.resolve(__dirname, '../node_modules')],// 限定在本项目目录上，不会再向上至全局查找
  mainFields: ['main'], // 读取package.json的main字段，入口文件
  extensions: ['.js', '.jsx'], // 省略后缀
  alias: {
    'react': path.resolve(__dirname, '../node_modules/react/umd/react.production.min.js'),
    'react-dom': path.resolve(__dirname, '../node_modules/react-dom/umd/react-dom.production.min.js'),
  }
}
```
> 实验结果：优化了0.3秒

## tree shaking
> js - tree-shaking，webpack4 mode=production 自动处理 ES6 模块
> css - purgecss-webpack-plugin插件，遍历代码，识别已经用到的css，它不能独立使用，需要配合 mini-css-extract-plugin 一起使用
```
plugins: [
  new MiniCssExtractPlugin({
    filename: `${cf.css}/[name].[contenthash:5].css`,
  }),
  // css: tree-shaking
  new PurgecssPlugin({
    paths: glob.sync(`${PATHS.src}/**/*`,  { nodir: true }),
  }),
]
```

## 动态Polyfill
> polyfill service 浏览器访问service，根据 UserAgent，下发不同的Polyfill
> polyfill service 实现按需加载 polyfill
> 可以基于官方自建polyfill服务
```
<script src="https://polyfill.io/v3/polyfill.jss"></script>
```