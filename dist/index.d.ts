import type { LoaderContext } from 'webpack';
declare function jsonAccessOptimizerLoader(this: LoaderContext<never>, source: string): string;
declare namespace jsonAccessOptimizerLoader {
    var JsonAccessOptimizer: typeof import("./json-access-optimizer").JsonAccessOptimizer;
}
export = jsonAccessOptimizerLoader;
