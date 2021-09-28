import { Module } from 'webpack';
// eslint-disable-next-line import/no-unresolved
import type { Expression } from 'estree';

export type PluginOptions = {
	accessorFunctionName: string;
};

export type JsonKeys = string[];

export type MetaData = {
	allJsonKeys?: JsonKeys;

	optimizedJsonKeys?: JsonKeys;

	jsonKeysUsedInModule?: Map<string, Expression[]>;
}

export const PACKAGE_NAMESPACE = 'webpack-json-access-optimizer_1.0.0';

export type ModuleWithMetaData = Module & {
	buildInfo: Module['buildInfo'] & {
		[PACKAGE_NAMESPACE]: MetaData;
	};
};
