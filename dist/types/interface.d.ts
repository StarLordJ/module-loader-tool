/// <reference types="react" />
export declare enum ModuleLoadStrategy {
    BLOCK = "block",
    IMMEDIATELY = "immediately",
    ON_DEMAND = "on_demand",
    LAZY = "lazy"
}
export interface IBaseModuleManifest {
    name: string;
    loadStrategy: ModuleLoadStrategy;
    fileName: string;
}
export interface IModuleLoaderEntrypoint<T extends IBaseModuleManifest> {
    manifestUrl: string;
    flattener?: (manifestObject: any) => Array<T>;
}
export declare type ModuleDependencies = Record<string, object>;
export declare type ModuleUrlFormatter<T extends IBaseModuleManifest> = (manifest: T) => string;
export declare type CompiledModuleControls = {
    start?: () => void;
    getComponent?: () => React.ComponentClass;
};
export declare type CompiledModule = {
    exports: {
        controls: CompiledModuleControls;
        [key: string]: object;
    };
};
export declare type TypeMatcher<T> = (manifest: T) => boolean;
export declare type ModulePreprocessor<T> = (manifest: T) => Promise<void>;
export declare type ModulePostprocessor<T> = (manifest: T, module: CompiledModule) => Promise<void>;
//# sourceMappingURL=interface.d.ts.map