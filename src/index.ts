import type { LoaderContext } from 'webpack';
import { JsonAccessOptimizer } from './json-access-optimizer';
import { PACKAGE_NAMESPACE } from './types';
import {
	moduleHasMetaData,
	assertHasMetaData,
} from './utils/meta-data';
import { hasTemporaryMetaData } from './utils/temporary-meta-data';

function jsonAccessOptimizerLoader(
	this: LoaderContext<never>,
	source: string,
) {
	const module = this._module!;

	// Move it to build info so Webpack caches it
	if (hasTemporaryMetaData(module)) {
		module.buildInfo[PACKAGE_NAMESPACE] = module[PACKAGE_NAMESPACE];
	}

	const jsonData: { [jsonKey: string]: any } = JSON.parse(source);

	if (moduleHasMetaData(module)) {
		const { optimizedJsonKeys } = module.buildInfo[PACKAGE_NAMESPACE];

		if (optimizedJsonKeys) {
			const jsonValues = optimizedJsonKeys.map(key => jsonData[key]);
			return JSON.stringify(jsonValues);
		}
	}

	assertHasMetaData(module);

	module.buildInfo[PACKAGE_NAMESPACE] = {
		allJsonKeys: Object.keys(jsonData).sort(),
	};

	return source;
}

jsonAccessOptimizerLoader.JsonAccessOptimizer = JsonAccessOptimizer;

export = jsonAccessOptimizerLoader;
