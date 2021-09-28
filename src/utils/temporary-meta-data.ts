import { Module } from 'webpack';
import { PACKAGE_NAMESPACE } from '../types';
import type { ModuleWithMetaData, MetaData } from '../types';

type ModuleWithTemporaryMetaData = ModuleWithMetaData & {
	[PACKAGE_NAMESPACE]: MetaData;
};

export function setTemporaryMetaData(
	module: Module,
	metaData: MetaData,
): asserts module is ModuleWithTemporaryMetaData {
	const moduleWithTemporaryMetaData = module as ModuleWithTemporaryMetaData;
	moduleWithTemporaryMetaData[PACKAGE_NAMESPACE] = metaData;
}

export const hasTemporaryMetaData = (
	module: Module,
): module is ModuleWithTemporaryMetaData => (
	PACKAGE_NAMESPACE in module
);
