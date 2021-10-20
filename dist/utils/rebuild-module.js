"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rebuildModule = void 0;
const rebuildModule = (compilation, module) => new Promise((resolve, reject) => {
    compilation.rebuildModule(module, (error, result) => {
        if (error) {
            return reject(error);
        }
        resolve(result);
    });
});
exports.rebuildModule = rebuildModule;
