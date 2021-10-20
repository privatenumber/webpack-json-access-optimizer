"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasOptimizeJsonLoader = void 0;
const loaderPath = require.resolve('../index.js');
const hasOptimizeJsonLoader = (module) => module.loaders.some(({ loader }) => loader === loaderPath);
exports.hasOptimizeJsonLoader = hasOptimizeJsonLoader;
