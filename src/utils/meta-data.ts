import { Module } from 'webpack';
import { PACKAGE_NAMESPACE } from '../types';
import type { ModuleWithMetaData } from '../types';

export const moduleHasMetaData = (
	module: Module,
): module is ModuleWithMetaData => (
	PACKAGE_NAMESPACE in module.buildInfo
);

export function assertHasMetaData(
	module: Module,
): asserts module is ModuleWithMetaData {
	if (!moduleHasMetaData(module)) {
		module.buildInfo[PACKAGE_NAMESPACE] = {};
	}
}
