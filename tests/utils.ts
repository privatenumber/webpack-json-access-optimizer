import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import { ufs } from 'unionfs';
import { IFS } from 'unionfs/lib/fs.js';
import { Volume, DirectoryJSON } from 'memfs';
import AggregateError from 'aggregate-error';
import type { FileSystem } from 'fs-require';

type InputFileSystem = webpack.Compiler['inputFileSystem'];
type OutputFileSystem = webpack.Compiler['outputFileSystem'];

export function assertFsWithReadFileSync(
	mfs: InputFileSystem | OutputFileSystem,
): asserts mfs is OutputFileSystem & FileSystem & {
	writeFileSync: typeof fs.writeFileSync;
} {
	if (!('readFileSync' in mfs)) {
		throw new Error('Missing readFileSync');
	}
	if (!('writeFileSync' in mfs)) {
		throw new Error('Missing writeFileSync');
	}
}

const mfsFromJson = (volJson: DirectoryJSON): OutputFileSystem => {
	const mfs = Volume.fromJSON(volJson) as unknown as OutputFileSystem;
	mfs.join = path.join;
	return mfs;
};

type CompilerOptions = Partial<webpack.Compiler>;
class ConfigureCompilerPlugin {
	options: CompilerOptions;

	constructor(options: CompilerOptions) {
		this.options = options;
	}

	apply(compiler: webpack.Compiler) {
		Object.assign(compiler, this.options);
	}
}

function createCompiler(
	volJson: DirectoryJSON,
	configCallback: (config: webpack.Configuration) => void,
) {
	const mfs = mfsFromJson(volJson);
	const config: webpack.Configuration = {
		mode: 'production',
		target: 'node',
		entry: {
			index: '/src/index.js',
		},
		module: {
			rules: [],
		},
		optimization: {
			minimize: false,
		},
		output: {
			filename: '[name].js',
			path: '/dist',
			libraryTarget: 'commonjs2',
			libraryExport: 'default',
		},
		plugins: [
			/**
			 * Inject memfs into the compiler before internal dependencies initialize
			 * (eg. PackFileCacheStrategy)
			 *
			 * https://github.com/webpack/webpack/blob/068ce839478317b54927d533f6fa4713cb6834da/lib/webpack.js#L69-L77
			 */
			new ConfigureCompilerPlugin({
				inputFileSystem: ufs.use(fs).use(mfs as unknown as IFS),
				outputFileSystem: mfs,
			}),
		],
	};

	if (configCallback) {
		configCallback(config);
	}

	return webpack(config);
}

export function build(
	volJson: DirectoryJSON,
	configCallback: (config: webpack.Configuration) => void,
) {
	return new Promise<webpack.Stats>((resolve, reject) => {
		const compiler = createCompiler(volJson, configCallback);

		compiler.run((error, stats) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(stats!);
		});
	});
}

type ChangeFunction = (fs: InputFileSystem, stats?: webpack.Stats) => void | Promise<void>;

export function watch(
	volJson: DirectoryJSON,
	configCallback: (config: webpack.Configuration) => void,
	changes: ChangeFunction[],
) {
	return new Promise<webpack.Stats>((resolve, reject) => {
		const compiler = createCompiler(volJson, configCallback);
		const watching = compiler.watch({}, async (error, stats) => {
			if (error) {
				reject(error);
				return;
			}

			const callback = changes.shift()!;
			await callback(compiler.inputFileSystem, stats);

			if (changes.length === 0) {
				watching.close(() => resolve(stats!));
			}
		});
	});
}
