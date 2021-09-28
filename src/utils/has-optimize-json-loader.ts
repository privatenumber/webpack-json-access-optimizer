import { NormalModule } from 'webpack';

const loaderPath = require.resolve('../index.js');

export const hasOptimizeJsonLoader = (
	module: NormalModule,
) => module.loaders.some(
	({ loader }) => loader === loaderPath,
);
