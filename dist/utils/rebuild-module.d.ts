import { Compilation, Module } from 'webpack';
export declare const rebuildModule: (compilation: Compilation, module: Module) => Promise<Module | undefined>;
