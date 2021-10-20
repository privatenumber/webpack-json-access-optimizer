"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasTemporaryMetaData = exports.setTemporaryMetaData = void 0;
const types_1 = require("../types");
function setTemporaryMetaData(module, metaData) {
    const moduleWithTemporaryMetaData = module;
    moduleWithTemporaryMetaData[types_1.PACKAGE_NAMESPACE] = metaData;
}
exports.setTemporaryMetaData = setTemporaryMetaData;
const hasTemporaryMetaData = (module) => (types_1.PACKAGE_NAMESPACE in module);
exports.hasTemporaryMetaData = hasTemporaryMetaData;
