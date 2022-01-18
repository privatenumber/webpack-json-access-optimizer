# webpack-json-access-optimizer <a href="https://npm.im/webpack-json-access-optimizer"><img src="https://badgen.net/npm/v/webpack-json-access-optimizer"></a> <!-- <a href="https://npm.im/webpack-json-access-optimizer"><img src="https://badgen.net/npm/dm/webpack-json-access-optimizer"></a>--> <a href="https://packagephobia.now.sh/result?p=webpack-json-access-optimizer"><img src="https://packagephobia.now.sh/badge?p=webpack-json-access-optimizer"></a>

Optimize JSON modules that are referenced via accessor function. For example, i18n locale JSONs.

### Features
- **Tree shaking** Remove unused JSON entries
- **Optimize JSON structure** Minify JSON by converting to an array
- **Developer friendly** Warn on invalid JSON keys and invalid accessor usage
- **Persistent caching support** Designed to support Webpack 5 disk cache

<sub>Support this project by ⭐️ starring and sharing it. [Follow me](https://github.com/privatenumber) to see what other cool projects I'm working on! ❤️</sub>

## Example
### Before
Given a "global accessor function" `$t` that retruns values from `locale.json`:

**index.js**
```js
console.log($t('helloWorld')) // logs "Hello world!"
```

**locale.json**
```json
{
    "helloWorld": "Hello world!",
    "unusedString": "I'm never accessed"
}
```

### After optimization <sup>✨</sup>
**index.js**
```js
console.log($t(0)) // logs "Hello world!"
```

**locale.json**
```json
["Hello world!"]
```

Note:
- The JSON is minified into an array, and the accessor now uses the array indices to access values
- Unused entries are removed from the JSON

## 🖥 Demo
<https://github.com/KumarAbhirup/webpack-treeshaking-json>

## 🚀 Install
```sh
npm i -D webpack-json-access-optimizer
```

## 🚦 Quick setup

Assuming you have some sort of "global accessor function" that takes a JSON key and returns the JSON value (eg. via [`ProvidePlugin`](https://webpack.js.org/plugins/provide-plugin/)):

1. Import the `JsonAccessOptimizer` plugin from `webpack-json-access-optimizer`.
2. Register the plugin with the "global accessor function" name
3. Add the `webpack-json-access-optimizer` loader to the JSON files. Note, all JSON files must have identical keys.

In `webpack.config.js`:

```diff
+ const { JsonAccessOptimizer } = require('webpack-json-access-optimizer')

  module.exports = {
    ...,

    module: {
      rules: [
        ...,
+       {
+         test: /locale\.json$/, // match JSON files to optimize
+         loader: 'webpack-json-access-optimizer'
+       },
      ]
    },

    plugins: [
      ...,
+     new JsonAccessOptimizer({
+       accessorFunctionName: '$t', // localization function name
+     })
    ]
  }
```

### JS loader
If the JSON needs to be transformed to JavaScript via another loader, you can chain them:

In `webpack.config.js`:

```diff
  module.exports = {
    ...,

    module: {
      rules: [
        ...,
        {
          test: /locale\.json$/, // match JSON files to optimize
          use: [
+           'some-other-json-transformer-loader', // any loader to transform JSON to JS
            'webpack-json-access-optimizer'
          ],
+         type: 'javascript/auto'
        },
      ]
    },
  }
```

## ⚙️ Plugin API

### accessorFunctionName
Type: `string`

Required

The name of the "global accessor function" that takes a JSON key and returns the JSON value. This function is typically provided via another plugin like [`ProvidePlugin`](https://webpack.js.org/plugins/provide-plugin/).
