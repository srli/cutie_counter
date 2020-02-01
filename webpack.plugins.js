const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = [
  new ForkTsCheckerWebpackPlugin({
    async: false
  }),
  new CopyPlugin([
    { from: 'css/**/*'},
    { from: 'assets/**/*'},
    { from: 'ext_js/**/*'},
    { from: 'fonts/**/*'},
    { from: 'index.html'}]),
];
