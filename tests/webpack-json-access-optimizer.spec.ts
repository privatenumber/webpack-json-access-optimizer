import webpack from 'webpack';
import { build, watch } from 'webpack-test-utils';
import { JsonAccessOptimizer } from '../dist/index.js';

describe('error handling', () => {
	test('no accessorFunctionName provided', async () => {
		await expect(async () => {
			await build(
				{},
				(config) => {
					config.plugins!.push(
						// @ts-expect-error testing no option
						new JsonAccessOptimizer(),
					);
				},
			);
		}).rejects.toThrow('[JsonAccessOptimizer] options.accessorFunctionName must be provided');
	});

	test('accessing non-existent key', async () => {
		const built = await build({
			'/src/index.js': 'export default __(\'someKey\');',
			'/src/localize-function.js': `
			import strings from './strings.json';
			const __ = (key) => strings[key];
			export default __;
			`,
			'/src/strings.json': JSON.stringify({}),
		}, (config) => {
			config.module.rules.push({
				test: /\.json$/,
				loader: require.resolve('../dist/index'),
			});

			config.plugins.push(
				new webpack.ProvidePlugin({
					__: ['./localize-function', 'default'],
				}),
				new JsonAccessOptimizer({
					accessorFunctionName: '__',
				}),
			);
		});

		expect(built.stats.hasWarnings()).toBe(true);
		const [warning] = built.stats.compilation.warnings;
		expect(warning.message).toMatch('[JsonAccessOptimizer] JSON key "someKey" does not exist');
	});

	test('function misuse', async () => {
		const built = await build({
			'/src/index.js': 'export default __(\'someKey\', 1, 2, 3);',
			'/src/localize-function.js': `
			import strings from './strings.json';
			const __ = (key) => strings[key];
			export default __;
			`,
			'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
		}, (config) => {
			config.module.rules.push({
				test: /\.json$/,
				loader: require.resolve('../dist/index'),
			});

			config.plugins.push(
				new webpack.ProvidePlugin({
					__: ['./localize-function', 'default'],
				}),
				new JsonAccessOptimizer({
					accessorFunctionName: '__',
				}),
			);
		});

		expect(built.stats.hasWarnings()).toBe(true);
		const [warning] = built.stats.compilation.warnings;
		expect(warning.message).toMatch('[JsonAccessOptimizer] Confusing usage of accessor function "__" in /src/index.js:1:15');
	});

	test('JSONs should have identical keys', async () => {
		const built = await build({
			'/src/index.js': 'export default __(\'someKey\');',
			'/src/strings-a.json': JSON.stringify({
				keyOne: 'value-one',
			}),
			'/src/strings-b.json': JSON.stringify({
				keyTwo: 'value-two',
			}),
			'/src/localize-function.js': `
			import stringsA from './strings-a.json';
			import stringsB from './strings-b.json';
			const __ = (key) => stringsA[key] + stringsB[key];
			export default __;
			`,
		}, (config) => {
			config.module.rules.push({
				test: /\.json$/,
				loader: require.resolve('../dist/index'),
			});

			config.plugins.push(
				new webpack.ProvidePlugin({
					__: ['./localize-function', 'default'],
				}),
				new JsonAccessOptimizer({
					accessorFunctionName: '__',
				}),
			);
		});

		expect(built.stats.hasErrors()).toBe(true);
		expect(built.stats.compilation.errors[0].message).toMatch('do not have identical keys');
	});

	test('JSONs should not warn on differently ordered keys', async () => {
		const built = await build({
			'/src/index.js': 'export default __(\'someKey\');',
			'/src/strings-a.json': JSON.stringify({
				keyOne: 'value-one',
				keyTwo: 'value-two',
			}),
			'/src/strings-b.json': JSON.stringify({
				keyTwo: 'value-two',
				keyOne: 'value-one',
			}),
			'/src/localize-function.js': `
			import stringsA from './strings-a.json';
			import stringsB from './strings-b.json';
			const __ = (key) => stringsA[key] + stringsB[key];
			export default __;
			`,
		}, (config) => {
			config.module.rules.push({
				test: /\.json$/,
				loader: require.resolve('../dist/index'),
			});

			config.plugins.push(
				new webpack.ProvidePlugin({
					__: ['./localize-function', 'default'],
				}),
				new JsonAccessOptimizer({
					accessorFunctionName: '__',
				}),
			);
		});

		expect(built.stats.hasErrors()).toBe(false);
	});
});

test('base case', async () => {
	const built = await build({
		'/src/index.js': 'export default __(\'someKey\');',
		'/src/localize-function.js': `
			import strings from './strings.json';
			const __ = (key) => strings[key];
			export default __;
		`,
		'/src/strings.json': JSON.stringify({
			someKey: 'someValue1',
			someUnusedKey: 'someValue2',
		}),
	}, (config) => {
		config.module.rules.push({
			test: /\.json$/,
			loader: require.resolve('../dist/index'),
		});

		config.plugins.push(
			new webpack.ProvidePlugin({
				__: ['./localize-function', 'default'],
			}),
			new JsonAccessOptimizer({
				accessorFunctionName: '__',
			}),
		);
	});

	expect(built.stats.hasErrors()).toBe(false);

	const distributionSource = await built.fs.promises.readFile('/dist/index.js', 'utf-8');
	expect(distributionSource).toMatch(/\["someValue1"\]/);

	const value = built.require('/dist/index.js');
	expect(value).toBe('someValue1');
});

test('only keys used should be bundled in', async () => {
	const built = await build({
		'/src/index.js': 'export default __(\'unknownKey\');',
		'/src/localize-function.js': `
		import strings from './strings.json';
		const __ = (key) => strings[key] || key;
		export default __;
		`,
		'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
	}, (config) => {
		config.module.rules.push({
			test: /\.json$/,
			loader: require.resolve('../dist/index'),
		});

		config.plugins.push(
			new webpack.ProvidePlugin({
				__: ['./localize-function', 'default'],
			}),
			new JsonAccessOptimizer({
				accessorFunctionName: '__',
			}),
		);
	});

	expect(built.stats.hasErrors()).toBe(false);

	const distributionSource = await built.fs.promises.readFile('/dist/index.js', 'utf-8');
	expect(distributionSource).toMatch(/strings_namespaceObject = \[\]/);

	const value = built.require('/dist/index.js');
	expect(value).toBe('unknownKey');
});

test('loader works without optimization', async () => {
	const built = await build({
		'/src/index.js': 'export default __(\'someKey\');',
		'/src/localize-function.js': `
		import strings from './strings.json';
		const __ = (key) => strings[key];
		export default __;
		`,
		'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
	}, (config) => {
		config.module.rules.push({
			test: /\.json$/,
			loader: require.resolve('../dist/index'),
		});

		config.plugins.push(
			new webpack.ProvidePlugin({
				__: ['./localize-function', 'default'],
			}),
		);
	});

	const distributionSource = await built.fs.promises.readFile('/dist/index.js', 'utf-8');
	expect(distributionSource).not.toMatch(/\["someValue"\]/);

	const value = built.require('/dist/index.js');
	expect(value).toBe('someValue');
});

test('as optimization', async () => {
	const built = await build({
		'/src/index.js': 'export default __(\'someKey\');',
		'/src/localize-function.js': `
		import strings from './strings.json';
		const __ = (key) => strings[key];
		export default __;
		`,
		'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
	}, (config) => {
		config.module.rules.push({
			test: /\.json$/,
			loader: require.resolve('../dist/index'),
		});

		config.plugins.push(
			new webpack.ProvidePlugin({
				__: ['./localize-function', 'default'],
			}),
		);

		config.optimization.minimize = true;
		config.optimization.minimizer = [
			'...',
			new JsonAccessOptimizer({
				accessorFunctionName: '__',
			}),
		];
	});

	const distributionSource = await built.fs.promises.readFile('/dist/index.js', 'utf-8');
	expect(distributionSource).toMatch(/\["someValue"\]/);

	const value = built.require('/dist/index.js');
	expect(value).toBe('someValue');
});

test('validateOnly', async () => {
	const buildStats = await build({
		'/src/index.js': 'export default __(\'nonExistentKey\');',
		'/src/localize-function.js': `
		import strings from './strings.json';
		const __ = (key) => strings[key];
		export default __;
		`,
		'/src/strings.json': JSON.stringify({
			someUnusedKey: 'someValue1',
		}),
	}, (config) => {
		config.module?.rules?.push({
			test: /\.json$/,
			loader: require.resolve('../dist/index'),
		});

		config.plugins?.push(
			new webpack.ProvidePlugin({
				__: ['./localize-function', 'default'],
			}),
			new JsonAccessOptimizer({
				accessorFunctionName: '__',
				validateOnly: true,
			}),
		);
	});

	expect(buildStats.hasWarnings()).toBe(true);
	const [warning] = buildStats.compilation.warnings;
	expect(warning.message).toMatch('[JsonAccessOptimizer] JSON key "nonExistentKey" does not exist');

	const mfs = buildStats.compilation.compiler.outputFileSystem;
	assertFsWithReadFileSync(mfs);

	const distributionSource = mfs.readFileSync('/dist/index.js').toString();
	expect(distributionSource).toMatch(/"someUnusedKey":"someValue1"/);

	const mRequire = createFsRequire(mfs);
	const value = mRequire('/dist/index.js');
	expect(value).toBe(undefined);
});

describe('watch', () => {
	test('removing a non-existent string should remove warning in watch mode', async () => {
		const watching = await watch(
			{
				'/src/index.js': 'export default __(\'unknownKey\');',
				'/src/localize-function.js': `
					import strings from './strings.json';
					const __ = (key) => strings[key] || key;
					export default __;
				`,
				'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
			},
			(config) => {
				config.module.rules.push({
					test: /\.json$/,
					loader: require.resolve('../dist/index'),
				});

				config.plugins.push(
					new webpack.ProvidePlugin({
						__: ['./localize-function', 'default'],
					}),
				);

				config.optimization.minimize = true;
				config.optimization.minimizer = [
					'...',
					new JsonAccessOptimizer({
						accessorFunctionName: '__',
					}),
				];
			},
		);

		let stats = await watching.build();

		expect(stats.hasWarnings()).toBe(true);

		expect(watching.require('/dist')).toBe('unknownKey');

		await watching.fs.promises.writeFile('/src/index.js', 'export default __(\'someKey\');');

		stats = await watching.build();

		expect(stats.hasWarnings()).toBe(false);

		delete watching.require.cache[watching.require.resolve('/dist')];

		expect(watching.require('/dist')).toBe('someValue');

		await watching.close();
	});

	test('removing a non-existent string should remove warning in watch mode - with js loader', async () => {
		const watching = await watch(
			{
				'/src/index.js': 'export default __(\'unknownKey\');',
				'/src/localize-function.js': `
				import './strings.json';
				const __ = (key) => global.globalizedData[key] || key;
				export default __;
				`,
				'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
			},
			(config) => {
				config.module.rules.push({
					test: /\.json$/,
					type: 'javascript/auto',
					use: [
						require.resolve('./globalize-json-loader'),
						require.resolve('../dist/index'),
					],
				});

				config.plugins.push(
					new webpack.ProvidePlugin({
						__: ['./localize-function', 'default'],
					}),
				);

				config.optimization.minimize = true;
				config.optimization.minimizer = [
					'...',
					new JsonAccessOptimizer({
						accessorFunctionName: '__',
					}),
				];
			},
		);

		let stats = await watching.build();

		expect(stats.hasWarnings()).toBe(true);

		expect(watching.require('/dist')).toBe('unknownKey');

		await watching.fs.promises.writeFile('/src/index.js', 'export default __(\'someKey\');');

		stats = await watching.build();

		expect(stats.hasWarnings()).toBe(false);

		delete watching.require.cache[watching.require.resolve('/dist')];

		expect(watching.require('/dist')).toBe('someValue');

		await watching.close();
	});

	test('keeping non-existent key should just keep warning', async () => {
		const watching = await watch(
			{
				'/src/index.js': 'export default __(\'unknownKey\');',
				'/src/localize-function.js': `
				import './strings.json';
				const __ = (key) => global.globalizedData[key] || key;
				export default __;
				`,
				'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
			},
			(config) => {
				config.module.rules.push({
					test: /\.json$/,
					type: 'javascript/auto',
					use: [
						require.resolve('./globalize-json-loader'),
						require.resolve('../dist/index'),
					],
				});

				config.plugins.push(
					new webpack.ProvidePlugin({
						__: ['./localize-function', 'default'],
					}),
				);

				config.optimization.minimize = true;
				config.optimization.minimizer = [
					'...',
					new JsonAccessOptimizer({
						accessorFunctionName: '__',
					}),
				];
			},
		);

		let stats = await watching.build();

		expect(stats.hasWarnings()).toBe(true);

		expect(watching.require('/dist')).toBe('unknownKey');

		await watching.fs.promises.writeFile('/src/index.js', 'export default __(\'unknownKey\')');

		stats = await watching.build();

		expect(stats.hasWarnings()).toBe(true);

		delete watching.require.cache[watching.require.resolve('/dist')];
		expect(watching.require('/dist')).toBe('unknownKey');

		await watching.close();
	});
});
