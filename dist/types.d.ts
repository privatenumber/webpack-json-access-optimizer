import { Module } from 'webpack';
import type { Expression } from 'estree';
export declare type PluginOptions = {
    accessorFunctionName: string;
};
export declare type JsonKeys = string[];
export declare type MetaData = {
    allJsonKeys?: JsonKeys;
    optimizedJsonKeys?: JsonKeys;
    jsonKeysUsedInModule?: Map<string, Expression[]>;
};
export declare const PACKAGE_NAMESPACE = "webpack-json-access-optimizer_1.0.0";
export declare type ModuleWithMetaData = Module & {
    buildInfo: Module['buildInfo'] & {
        [PACKAGE_NAMESPACE]: MetaData;
    };
};
