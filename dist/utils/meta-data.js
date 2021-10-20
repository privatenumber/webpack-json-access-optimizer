"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertHasMetaData = exports.moduleHasMetaData = void 0;
const types_1 = require("../types");
const moduleHasMetaData = (module) => (types_1.PACKAGE_NAMESPACE in module.buildInfo);
exports.moduleHasMetaData = moduleHasMetaData;
function assertHasMetaData(module) {
    if (!(0, exports.moduleHasMetaData)(module)) {
        module.buildInfo[types_1.PACKAGE_NAMESPACE] = {};
    }
}
exports.assertHasMetaData = assertHasMetaData;
