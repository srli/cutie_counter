module.exports = [
  // Add support for native node modules
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.(otf|ttf|woff)$/,
    use: {
      loader: 'url-loader',
    },
  },
  {
    test: /\.(woff2|eot|png|jpg|svg|txt)$/,
    use: [
      {
        loader: 'file-loader',
        options: {
          name: '[hash]-[name].[ext]',
          outputPath: 'static',
          publicPath: '../static',
        },
      },
    ],
  },
  {
    test: /\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@marshallofsound/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|\.webpack)/,
    use: {
      loader: 'ts-loader',
      options: {
        transpileOnly: true
      }
    }
  },
];
