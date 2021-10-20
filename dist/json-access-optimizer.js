"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonAccessOptimizer = void 0;
const assert_1 = __importDefault(require("assert"));
const webpack_1 = require("webpack");
const is_same_array_1 = require("./utils/is-same-array");
const to_pojo_1 = require("./utils/to-pojo");
const location_1 = require("./utils/location");
const rebuild_module_1 = require("./utils/rebuild-module");
const has_optimize_json_loader_1 = require("./utils/has-optimize-json-loader");
const meta_data_1 = require("./utils/meta-data");
const temporary_meta_data_1 = require("./utils/temporary-meta-data");
const types_1 = require("./types");
const { ConstDependency } = webpack_1.dependencies;
const isNumberPattern = /^\d+$/;
class JsonAccessOptimizer {
    constructor(options) {
        (0, assert_1.default)(options === null || options === void 0 ? void 0 : options.accessorFunctionName, `[${JsonAccessOptimizer.name}] options.accessorFunctionName must be provided`);
        this.options = options;
    }
    apply(compiler) {
        compiler.hooks.thisCompilation.tap(JsonAccessOptimizer.name, (compilation, { normalModuleFactory }) => {
            this.detectJsonKeyAccess(normalModuleFactory);
            this.optimizeJsonModules(compilation);
        });
    }
    detectJsonKeyAccess(normalModuleFactory) {
        const { accessorFunctionName } = this.options;
        const handler = (parser) => {
            // Hook executed per module
            parser.hooks.program.tap(JsonAccessOptimizer.name, () => {
                const { module } = parser.state;
                (0, meta_data_1.assertHasMetaData)(module);
                const metaData = module.buildInfo[types_1.PACKAGE_NAMESPACE];
                if (metaData.jsonKeysUsedInModule) {
                    metaData.jsonKeysUsedInModule.clear();
                }
                else {
                    metaData.jsonKeysUsedInModule = new Map();
                }
            });
            // Hook executed per function call in modules
            parser.hooks.call.for(accessorFunctionName).tap(JsonAccessOptimizer.name, (node) => {
                const { module } = parser.state;
                const callExpressionNode = node;
                const [firstArgumentNode] = callExpressionNode.arguments;
                if (callExpressionNode.arguments.length === 1
                    && firstArgumentNode.type === 'Literal'
                    && typeof firstArgumentNode.value === 'string') {
                    (0, meta_data_1.assertHasMetaData)(module);
                    const metaData = module.buildInfo[types_1.PACKAGE_NAMESPACE];
                    const { jsonKeysUsedInModule } = metaData;
                    if (jsonKeysUsedInModule) {
                        const stringKey = firstArgumentNode.value;
                        const replaceNode = (0, to_pojo_1.toPOJO)(firstArgumentNode);
                        if (jsonKeysUsedInModule.has(stringKey)) {
                            jsonKeysUsedInModule.get(stringKey).push(replaceNode);
                        }
                        else {
                            jsonKeysUsedInModule.set(stringKey, [replaceNode]);
                        }
                    }
                }
                else {
                    const location = callExpressionNode.loc.start;
                    const warning = new webpack_1.WebpackError(`[${JsonAccessOptimizer.name}] Confusing usage of accessor function "${accessorFunctionName}" in ${module.resource}:${location.line}:${location.column}`);
                    module.addWarning(warning);
                }
            });
        };
        normalModuleFactory.hooks.parser
            .for('javascript/auto')
            .tap(JsonAccessOptimizer.name, handler);
        normalModuleFactory.hooks.parser
            .for('javascript/dynamic')
            .tap(JsonAccessOptimizer.name, handler);
        normalModuleFactory.hooks.parser
            .for('javascript/esm')
            .tap(JsonAccessOptimizer.name, handler);
    }
    optimizeJsonModules(compilation) {
        compilation.hooks.finishModules.tapPromise(JsonAccessOptimizer.name, async (modules) => {
            const normalModules = Array.from(modules).filter(module => module instanceof webpack_1.NormalModule);
            normalModules.sort((a, b) => a.request.localeCompare(b.request));
            const jsonModules = [];
            let jsonKeys;
            // Validate consistent keys across JSON files
            for (const module of normalModules) {
                if (!(0, has_optimize_json_loader_1.hasOptimizeJsonLoader)(module)
                    || !(0, meta_data_1.moduleHasMetaData)(module)) {
                    continue;
                }
                const { allJsonKeys } = module.buildInfo[types_1.PACKAGE_NAMESPACE];
                if (!allJsonKeys) {
                    continue;
                }
                const { resource } = module;
                if (jsonKeys) {
                    if (!(0, is_same_array_1.isSameArray)(jsonKeys.allJsonKeys, allJsonKeys)) {
                        module.addError(new webpack_1.WebpackError(`[${JsonAccessOptimizer.name}] JSON files "${jsonKeys.resource}" and "${resource}" do not have identical keys`));
                        return;
                    }
                }
                else {
                    jsonKeys = {
                        resource,
                        allJsonKeys,
                    };
                }
                jsonModules.push(module);
            }
            if (!jsonKeys || jsonModules.length === 0) {
                return;
            }
            const optimizedJsonKeys = [];
            for (const module of normalModules) {
                if (!(0, meta_data_1.moduleHasMetaData)(module)) {
                    continue;
                }
                const { jsonKeysUsedInModule } = module.buildInfo[types_1.PACKAGE_NAMESPACE];
                if (!jsonKeysUsedInModule) {
                    continue;
                }
                const jsonKeysUsedInModuleSorted = Array.from(jsonKeysUsedInModule).sort((a, b) => a[0].localeCompare(b[0]));
                for (const [jsonKey, jsonKeyUsageNodes] of jsonKeysUsedInModuleSorted) {
                    if (!jsonKeys.allJsonKeys.includes(jsonKey)) {
                        const warningMessage = `[${JsonAccessOptimizer.name}] JSON key "${jsonKey}" does not exist`;
                        const warnings = Array.from(module.getWarnings() || []);
                        const hasWarning = warnings.some(warning => warning.message === warningMessage);
                        if (!hasWarning) {
                            module.addWarning(new webpack_1.WebpackError(warningMessage));
                        }
                        continue;
                    }
                    let keyIndex = optimizedJsonKeys.indexOf(jsonKey);
                    if (keyIndex === -1) {
                        keyIndex = optimizedJsonKeys.push(jsonKey) - 1;
                    }
                    const keyId = keyIndex.toString();
                    for (const jsonKeyUsageNode of jsonKeyUsageNodes) {
                        const dep = new ConstDependency(keyId, jsonKeyUsageNode.range);
                        dep.loc = jsonKeyUsageNode.loc;
                        if (!module.presentationalDependencies) {
                            module.addPresentationalDependency(dep);
                            continue;
                        }
                        if (!(0, location_1.isLocation)(dep.loc)) {
                            continue;
                        }
                        const { loc: depLoc } = dep;
                        const matchingDepIndex = module.presentationalDependencies.findIndex((existingDep) => {
                            if (existingDep instanceof ConstDependency
                                && isNumberPattern.test(existingDep.expression)) {
                                const { loc } = existingDep;
                                return ((0, location_1.isLocation)(loc)
                                    && (0, location_1.isSameLocation)(depLoc, loc));
                            }
                            return false;
                        });
                        if (matchingDepIndex > -1) {
                            const existingDep = module.presentationalDependencies[matchingDepIndex];
                            if (existingDep instanceof ConstDependency
                                && existingDep.expression === dep.expression) {
                                continue;
                            }
                            module.presentationalDependencies.splice(matchingDepIndex, 1, dep);
                        }
                        else {
                            module.addPresentationalDependency(dep);
                        }
                    }
                }
            }
            await Promise.all(jsonModules.map(async (module) => {
                // Temporarily store data on module because rebuild clears .buildInfo
                // rebuild triggers loader, which places data back into .buildInfo
                // Data needs to be in .buildInfo becaue Webpack writes it to persistent cache
                (0, temporary_meta_data_1.setTemporaryMetaData)(module, {
                    ...module.buildInfo[types_1.PACKAGE_NAMESPACE],
                    optimizedJsonKeys,
                });
                await (0, rebuild_module_1.rebuildModule)(compilation, module);
            }));
        });
    }
}
exports.JsonAccessOptimizer = JsonAccessOptimizer;
