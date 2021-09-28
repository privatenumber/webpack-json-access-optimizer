import assert from 'assert';
import {
	Compiler,
	Compilation,
	WebpackError,
	javascript,
	dependencies,
	NormalModule,
} from 'webpack';
// eslint-disable-next-line import/no-unresolved
import type { SimpleCallExpression, Position } from 'estree';
import { isSameArray } from './utils/is-same-array';
import { toPOJO } from './utils/to-pojo';
import { isLocation, isSameLocation } from './utils/location';
import { rebuildModule } from './utils/rebuild-module';
import { hasOptimizeJsonLoader } from './utils/has-optimize-json-loader';
import {
	moduleHasMetaData,
	assertHasMetaData,
} from './utils/meta-data';
import { setTemporaryMetaData } from './utils/temporary-meta-data';
import {
	PluginOptions,
	PACKAGE_NAMESPACE,
	JsonKeys,
	ModuleWithMetaData,
} from './types';

const { ConstDependency } = dependencies;
const isNumberPattern = /^\d+$/;

export class JsonAccessOptimizer {
	options: PluginOptions;

	constructor(options: PluginOptions) {
		assert(
			options?.accessorFunctionName,
			`[${JsonAccessOptimizer.name}] options.accessorFunctionName must be provided`,
		);

		this.options = options;
	}

	apply(compiler: Compiler) {
		compiler.hooks.thisCompilation.tap(
			JsonAccessOptimizer.name,
			(compilation, { normalModuleFactory }) => {
				this.detectJsonKeyAccess(normalModuleFactory);
				this.optimizeJsonModules(compilation);
			},
		);
	}

	detectJsonKeyAccess(normalModuleFactory: ReturnType<Compiler['createNormalModuleFactory']>) {
		const { accessorFunctionName } = this.options;

		const handler = (parser: javascript.JavascriptParser) => {
			// Hook executed per module
			parser.hooks.program.tap(
				JsonAccessOptimizer.name,
				() => {
					const { module } = parser.state;

					assertHasMetaData(module);
					const metaData = module.buildInfo[PACKAGE_NAMESPACE];

					if (metaData.jsonKeysUsedInModule) {
						metaData.jsonKeysUsedInModule.clear();
					} else {
						metaData.jsonKeysUsedInModule = new Map();
					}
				},
			);

			// Hook executed per function call in modules
			parser.hooks.call.for(accessorFunctionName).tap(
				JsonAccessOptimizer.name,
				(node) => {
					const { module } = parser.state;
					const callExpressionNode = node as SimpleCallExpression;
					const [firstArgumentNode] = callExpressionNode.arguments;

					if (
						callExpressionNode.arguments.length === 1
						&& firstArgumentNode.type === 'Literal'
						&& typeof firstArgumentNode.value === 'string'
					) {
						assertHasMetaData(module);
						const metaData = module.buildInfo[PACKAGE_NAMESPACE];
						const { jsonKeysUsedInModule } = metaData;

						if (jsonKeysUsedInModule) {
							const stringKey = firstArgumentNode.value;
							const replaceNode = toPOJO(firstArgumentNode);

							if (jsonKeysUsedInModule.has(stringKey)) {
								jsonKeysUsedInModule.get(stringKey)!.push(replaceNode);
							} else {
								jsonKeysUsedInModule.set(stringKey, [replaceNode]);
							}
						}
					} else {
						const location = callExpressionNode.loc!.start;
						const warning = new WebpackError(`[${JsonAccessOptimizer.name}] Confusing usage of accessor function "${accessorFunctionName}" in ${module.resource}:${location.line}:${location.column}`);
						module.addWarning(warning);
					}
				},
			);
		};

		normalModuleFactory.hooks.parser
			.for('javascript/auto')
			.tap(JsonAccessOptimizer.name, handler);
		normalModuleFactory.hooks.parser
			.for('javascript/dynamic')
			.tap(JsonAccessOptimizer.name, handler);
		normalModuleFactory.hooks.parser
			.for('javascript/esm')
			.tap(JsonAccessOptimizer.name, handler);
	}

	optimizeJsonModules(
		compilation: Compilation,
	) {
		compilation.hooks.finishModules.tapPromise(JsonAccessOptimizer.name, async (modules) => {
			const normalModules = Array.from(modules).filter(
				module => module instanceof NormalModule,
			) as NormalModule[];
			const jsonModules: ModuleWithMetaData[] = [];

			let jsonKeys: {
				resource: string;
				allJsonKeys: JsonKeys;
			} | undefined;

			// Validate consistent keys across JSON files
			for (const module of normalModules) {
				if (
					!hasOptimizeJsonLoader(module)
					|| !moduleHasMetaData(module)
				) {
					continue;
				}

				const { allJsonKeys } = module.buildInfo[PACKAGE_NAMESPACE];

				if (!allJsonKeys) {
					continue;
				}

				const { resource } = module;
				if (jsonKeys) {
					if (!isSameArray(jsonKeys.allJsonKeys, allJsonKeys)) {
						module.addError(
							new WebpackError(`[${JsonAccessOptimizer.name}] JSON files "${jsonKeys.resource}" and "${resource}" do not have identical keys`),
						);
						return;
					}
				} else {
					jsonKeys = {
						resource,
						allJsonKeys,
					};
				}

				jsonModules.push(module);
			}

			if (!jsonKeys || jsonModules.length === 0) {
				return;
			}

			const optimizedJsonKeys: JsonKeys = [];
			for (const module of normalModules) {
				if (!moduleHasMetaData(module)) {
					continue;
				}

				const { jsonKeysUsedInModule } = module.buildInfo[PACKAGE_NAMESPACE];
				if (!jsonKeysUsedInModule) {
					continue;
				}

				for (const [jsonKey, jsonKeyUsageNodes] of jsonKeysUsedInModule) {
					if (!jsonKeys.allJsonKeys.includes(jsonKey)) {
						module.addWarning(
							new WebpackError(`[${JsonAccessOptimizer.name}] JSON key "${jsonKey}" does not exist`),
						);
						continue;
					}

					let keyIndex = optimizedJsonKeys.indexOf(jsonKey);
					if (keyIndex === -1) {
						keyIndex = optimizedJsonKeys.push(jsonKey) - 1;
					}

					const keyId = keyIndex.toString();

					for (const jsonKeyUsageNode of jsonKeyUsageNodes) {
						const dep = new ConstDependency(keyId, jsonKeyUsageNode.range!);
						dep.loc = jsonKeyUsageNode.loc!;

						if (!module.presentationalDependencies) {
							module.addPresentationalDependency(dep);
							continue;
						}

						if (!isLocation(dep.loc)) {
							continue;
						}

						const { loc: depLoc } = dep;
						const matchingDep = module.presentationalDependencies.findIndex(
							(existingDep) => {
								if (
									existingDep instanceof ConstDependency
									&& isNumberPattern.test(existingDep.expression)
								) {
									const { loc } = existingDep;
									return (
										isLocation(loc)
										&& isSameLocation(depLoc, loc)
									);
								}

								return false;
							},
						);

						if (matchingDep > -1) {
							module.presentationalDependencies.splice(matchingDep, 1, dep);
						} else {
							module.addPresentationalDependency(dep);
						}
					}
				}
			}

			await Promise.all(
				jsonModules.map(async (module) => {
					// Temporarily store data on module because rebuild clears .buildInfo
					// rebuild triggers loader, which places data back into .buildInfo
					// Data needs to be in .buildInfo becaue Webpack writes it to persistent cache
					setTemporaryMetaData(module, {
						...module.buildInfo[PACKAGE_NAMESPACE],
						optimizedJsonKeys,
					});

					await rebuildModule(compilation, module);
				}),
			);
		});
	}
}
