"use strict";
const json_access_optimizer_1 = require("./json-access-optimizer");
const types_1 = require("./types");
const meta_data_1 = require("./utils/meta-data");
const temporary_meta_data_1 = require("./utils/temporary-meta-data");
function jsonAccessOptimizerLoader(source) {
    const module = this._module;
    // Move it to build info so Webpack caches it
    if ((0, temporary_meta_data_1.hasTemporaryMetaData)(module)) {
        module.buildInfo[types_1.PACKAGE_NAMESPACE] = module[types_1.PACKAGE_NAMESPACE];
    }
    const jsonData = JSON.parse(source);
    if ((0, meta_data_1.moduleHasMetaData)(module)) {
        const { optimizedJsonKeys } = module.buildInfo[types_1.PACKAGE_NAMESPACE];
        if (optimizedJsonKeys) {
            const jsonValues = optimizedJsonKeys.map(key => jsonData[key]);
            return JSON.stringify(jsonValues);
        }
    }
    (0, meta_data_1.assertHasMetaData)(module);
    module.buildInfo[types_1.PACKAGE_NAMESPACE] = {
        allJsonKeys: Object.keys(jsonData).sort(),
    };
    return source;
}
jsonAccessOptimizerLoader.JsonAccessOptimizer = json_access_optimizer_1.JsonAccessOptimizer;
module.exports = jsonAccessOptimizerLoader;
