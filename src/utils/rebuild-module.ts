import { Compilation, Module } from 'webpack';

export const rebuildModule = (
	compilation: Compilation,
	module: Module,
) => new Promise<Module | undefined>((resolve, reject) => {
	compilation.rebuildModule(module, (error, result) => {
		if (error) {
			return reject(error);
		}

		resolve(result);
	});
});
