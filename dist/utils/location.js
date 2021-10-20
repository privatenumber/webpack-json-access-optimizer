"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSameLocation = exports.isLocation = void 0;
const isPosition = (position) => (typeof (position === null || position === void 0 ? void 0 : position.line) === 'number'
    && typeof (position === null || position === void 0 ? void 0 : position.column) === 'number');
const isSamePosition = (positionA, positionB) => (positionA.line === positionB.line
    && positionA.column === positionB.column);
const isLocation = (location) => (isPosition(location === null || location === void 0 ? void 0 : location.start) && isPosition(location === null || location === void 0 ? void 0 : location.end));
exports.isLocation = isLocation;
const isSameLocation = (locationA, locationB) => (isSamePosition(locationA.start, locationB.start)
    && isSamePosition(locationA.end, locationB.end));
exports.isSameLocation = isSameLocation;
