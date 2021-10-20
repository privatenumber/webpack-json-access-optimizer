import { Module } from 'webpack';
import type { ModuleWithMetaData } from '../types';
export declare const moduleHasMetaData: (module: Module) => module is ModuleWithMetaData;
export declare function assertHasMetaData(module: Module): asserts module is ModuleWithMetaData;
