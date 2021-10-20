"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPOJO = void 0;
const { hasOwnProperty } = Object.prototype;
function toPOJO(object) {
    if (!object || typeof object !== 'object') {
        return object;
    }
    const cloned = {};
    for (const propertyName in object) {
        if (hasOwnProperty.call(object, propertyName)) {
            cloned[propertyName] = toPOJO(object[propertyName]);
        }
    }
    return cloned;
}
exports.toPOJO = toPOJO;
