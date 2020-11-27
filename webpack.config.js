const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require("copy-webpack-plugin");

const isProduction = process.env.npm_lifecycle_event === 'build'

module.exports = {
  entry: './src',
  devtool: !isProduction && 'source-map',
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpe?g|gif|glb|mp3|mp4|woff2)$/i,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]',
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          context: "./node_modules/three/examples/js/libs",
          from: "draco/**/**" 
        }
      ],
    }),
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      minify: isProduction && {
        collapseWhitespace: true
      },
      inlineSource: isProduction && '\.(js|css)$',
			inject: 'head'
    })
  ],
  devServer: {
    stats: 'minimal',
    overlay: true
  }
}
