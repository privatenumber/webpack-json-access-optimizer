import { Compiler, Compilation } from 'webpack';
import { PluginOptions } from './types';
export declare class JsonAccessOptimizer {
    options: PluginOptions;
    constructor(options: PluginOptions);
    apply(compiler: Compiler): void;
    detectJsonKeyAccess(normalModuleFactory: ReturnType<Compiler['createNormalModuleFactory']>): void;
    optimizeJsonModules(compilation: Compilation): void;
}
