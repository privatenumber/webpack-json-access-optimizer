import { Module } from 'webpack';
import { PACKAGE_NAMESPACE } from '../types';
import type { ModuleWithMetaData, MetaData } from '../types';
declare type ModuleWithTemporaryMetaData = ModuleWithMetaData & {
    [PACKAGE_NAMESPACE]: MetaData;
};
export declare function setTemporaryMetaData(module: Module, metaData: MetaData): asserts module is ModuleWithTemporaryMetaData;
export declare const hasTemporaryMetaData: (module: Module) => module is ModuleWithTemporaryMetaData;
export {};
