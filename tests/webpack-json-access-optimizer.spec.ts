import webpack from 'webpack';
import { createFsRequire } from 'fs-require';
import { JsonAccessOptimizer } from '../dist/index.js';
import { assertFsWithReadFileSync, build, watch } from './utils';

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
		const buildStats = await build({
			'/src/index.js': 'export default __(\'someKey\');',
			'/src/localize-function.js': `
			import strings from './strings.json';
			const __ = (key) => strings[key];
			export default __;
			`,
			'/src/strings.json': JSON.stringify({}),
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
				}),
			);
		});

		expect(buildStats.hasWarnings()).toBe(true);
		const [warning] = buildStats.compilation.warnings;
		expect(warning.message).toMatch('[JsonAccessOptimizer] JSON key "someKey" does not exist');
	});

	test('function misuse', async () => {
		const buildStats = await build({
			'/src/index.js': 'export default __(\'someKey\', 1, 2, 3);',
			'/src/localize-function.js': `
			import strings from './strings.json';
			const __ = (key) => strings[key];
			export default __;
			`,
			'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
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
				}),
			);
		});

		expect(buildStats.hasWarnings()).toBe(true);
		const [warning] = buildStats.compilation.warnings;
		expect(warning.message).toMatch('[JsonAccessOptimizer] Confusing usage of accessor function "__" in /src/index.js:1:15');
	});

	test('JSONs should have identical keys', async () => {
		const buildStats = await build({
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
				}),
			);
		});

		expect(buildStats.hasErrors()).toBe(true);
		expect(buildStats.compilation.errors[0].message).toMatch('do not have identical keys');
	});

	test('JSONs should not warn on differently ordered keys', async () => {
		const buildStats = await build({
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
				}),
			);
		});

		expect(buildStats.hasErrors()).toBe(false);
	});
});

test('base case', async () => {
	const buildStats = await build({
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
			}),
		);
	});

	expect(buildStats.hasErrors()).toBe(false);

	const mfs = buildStats.compilation.compiler.outputFileSystem;
	assertFsWithReadFileSync(mfs);

	const distributionSource = mfs.readFileSync('/dist/index.js').toString();
	expect(distributionSource).toMatch(/\["someValue1"\]/);

	const mRequire = createFsRequire(mfs);
	const value = mRequire('/dist/index.js');
	expect(value).toBe('someValue1');
});

test('only keys used should be bundled in', async () => {
	const buildStats = await build({
		'/src/index.js': 'export default __(\'unknownKey\');',
		'/src/localize-function.js': `
		import strings from './strings.json';
		const __ = (key) => strings[key] || key;
		export default __;
		`,
		'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
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
			}),
		);
	});

	expect(buildStats.hasErrors()).toBe(false);

	const mfs = buildStats.compilation.compiler.outputFileSystem;
	assertFsWithReadFileSync(mfs);

	const distributionSource = mfs.readFileSync('/dist/index.js').toString();
	expect(distributionSource).toMatch(/strings_namespaceObject = \[\]/);

	const mRequire = createFsRequire(mfs);
	const value = mRequire('/dist/index.js');
	expect(value).toBe('unknownKey');
});

test('loader works without optimization', async () => {
	const buildStats = await build({
		'/src/index.js': 'export default __(\'someKey\');',
		'/src/localize-function.js': `
		import strings from './strings.json';
		const __ = (key) => strings[key];
		export default __;
		`,
		'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
	}, (config) => {
		config.module?.rules?.push({
			test: /\.json$/,
			loader: require.resolve('../dist/index'),
		});

		config.plugins?.push(
			new webpack.ProvidePlugin({
				__: ['./localize-function', 'default'],
			}),
		);
	});

	const mfs = buildStats.compilation.compiler.outputFileSystem;
	assertFsWithReadFileSync(mfs);

	const distributionSource = mfs.readFileSync('/dist/index.js').toString();
	expect(distributionSource).not.toMatch(/\["someValue"\]/);

	const mRequire = createFsRequire(mfs);
	const value = mRequire('/dist/index.js');
	expect(value).toBe('someValue');
});

test('as optimization', async () => {
	const buildStats = await build({
		'/src/index.js': 'export default __(\'someKey\');',
		'/src/localize-function.js': `
		import strings from './strings.json';
		const __ = (key) => strings[key];
		export default __;
		`,
		'/src/strings.json': JSON.stringify({ someKey: 'someValue' }),
	}, (config) => {
		config.module?.rules?.push({
			test: /\.json$/,
			loader: require.resolve('../dist/index'),
		});

		config.plugins?.push(
			new webpack.ProvidePlugin({
				__: ['./localize-function', 'default'],
			}),
		);

		config.optimization!.minimize = true;
		config.optimization!.minimizer = [
			'...',
			new JsonAccessOptimizer({
				accessorFunctionName: '__',
			}),
		];
	});

	const mfs = buildStats.compilation.compiler.outputFileSystem;
	assertFsWithReadFileSync(mfs);

	const distributionSource = mfs.readFileSync('/dist/index.js').toString();
	expect(distributionSource).toMatch(/\["someValue"\]/);

	const mRequire = createFsRequire(mfs);
	const value = mRequire('/dist/index.js');
	expect(value).toBe('someValue');
});

describe('watch', () => {
	test('removing a non-existent string should remove warning in watch mode', async () => {
		await watch(
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
				config.module?.rules?.push({
					test: /\.json$/,
					loader: require.resolve('../dist/index'),
				});

				config.plugins?.push(
					new webpack.ProvidePlugin({
						__: ['./localize-function', 'default'],
					}),
				);

				config.optimization!.minimize = true;
				config.optimization!.minimizer = [
					'...',
					new JsonAccessOptimizer({
						accessorFunctionName: '__',
					}),
				];
			},
			[
				(ifs, stats) => {
					expect(stats?.hasWarnings()).toBe(true);

					assertFsWithReadFileSync(ifs);

					const mRequire = createFsRequire(ifs);
					const value = mRequire('/dist/index.js');
					expect(value).toBe('unknownKey');

					ifs.writeFileSync('/src/index.js', 'export default __(\'someKey\');');
				},
				(ifs, stats) => {
					expect(stats?.hasWarnings()).toBe(false);

					assertFsWithReadFileSync(ifs);

					const mRequire = createFsRequire(ifs);
					const value = mRequire('/dist/index.js');
					expect(value).toBe('someValue');
				},
			],
		);
	});

	test('removing a non-existent string should remove warning in watch mode - with js loader', async () => {
		await watch(
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
				config.module?.rules?.push({
					test: /\.json$/,
					type: 'javascript/auto',
					use: [
						require.resolve('./globalize-json-loader'),
						require.resolve('../dist/index'),
					],
				});

				config.plugins?.push(
					new webpack.ProvidePlugin({
						__: ['./localize-function', 'default'],
					}),
				);

				config.optimization!.minimize = true;
				config.optimization!.minimizer = [
					'...',
					new JsonAccessOptimizer({
						accessorFunctionName: '__',
					}),
				];
			},
			[
				(ifs, stats) => {
					expect(stats?.hasWarnings()).toBe(true);

					assertFsWithReadFileSync(ifs);

					const mRequire = createFsRequire(ifs);
					const value = mRequire('/dist/index.js');
					expect(value).toBe('unknownKey');

					ifs.writeFileSync('/src/index.js', 'export default __(\'someKey\');');
				},
				(ifs, stats) => {
					expect(stats?.hasWarnings()).toBe(false);

					assertFsWithReadFileSync(ifs);

					const mRequire = createFsRequire(ifs);
					const value = mRequire('/dist/index.js');
					expect(value).toBe('someValue');
				},
			],
		);
	});

	test('keeping non-existent key should just keep warning', async () => {
		await watch(
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
				config.module?.rules?.push({
					test: /\.json$/,
					type: 'javascript/auto',
					use: [
						require.resolve('./globalize-json-loader'),
						require.resolve('../dist/index'),
					],
				});

				config.plugins?.push(
					new webpack.ProvidePlugin({
						__: ['./localize-function', 'default'],
					}),
				);

				config.optimization!.minimize = true;
				config.optimization!.minimizer = [
					'...',
					new JsonAccessOptimizer({
						accessorFunctionName: '__',
					}),
				];
			},
			[
				(ifs, stats) => {
					expect(stats?.hasWarnings()).toBe(true);

					assertFsWithReadFileSync(ifs);

					const mRequire = createFsRequire(ifs);
					const value = mRequire('/dist/index.js');
					expect(value).toBe('unknownKey');

					ifs.writeFileSync('/src/index.js', 'export default __(\'unknownKey\')');
				},
				(ifs, stats) => {
					expect(stats?.hasWarnings()).toBe(true);

					assertFsWithReadFileSync(ifs);

					const mRequire = createFsRequire(ifs);
					const value = mRequire('/dist/index.js');
					expect(value).toBe('unknownKey');
				},
			],
		);
	});
});
