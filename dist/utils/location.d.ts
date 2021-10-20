declare type Position = {
    line: number;
    column: number;
};
declare type Location = {
    start: Position;
    end: Position;
};
export declare const isLocation: (location: any) => location is Location;
export declare const isSameLocation: (locationA: Location, locationB: Location) => boolean;
export {};
