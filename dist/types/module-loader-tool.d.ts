import { CompiledModule, IBaseModuleManifest, IModuleLoaderEntrypoint, ModuleDependencies, ModuleUrlFormatter } from './interface';
export declare class ModuleLoaderTool<TModuleManifest extends IBaseModuleManifest> {
    private dependencies;
    private urlFormatter;
    private entrypoint;
    private manifestProcessors;
    private _bundlesList;
    private bundlesCache;
    private loadersCache;
    readonly bundlesList: Array<TModuleManifest>;
    private startupCheck;
    private loadBulkBundles;
    defineDependencies(dependencies: ModuleDependencies): void;
    defineUrlFormatter(formatter: ModuleUrlFormatter<TModuleManifest>): void;
    defineEntrypoint(entrypoint: IModuleLoaderEntrypoint<TModuleManifest>): void;
    defineManifestType(type: string, typeMatcher: (manifest: TModuleManifest) => boolean, modulePreprocessor?: (manifest: TModuleManifest) => Promise<void>, modulePostprocessor?: (manifest: TModuleManifest, module: CompiledModule) => Promise<void>): void;
    isBundleLoaded(bundleName: string): boolean;
    load(filterFn?: (m: TModuleManifest) => boolean): Promise<void>;
    start(runner: (...args: Array<any>) => any): Promise<void>;
    loadBundleByManifest(manifest: TModuleManifest): Promise<CompiledModule | void>;
    loadBundleByName(name: string): Promise<CompiledModule | void>;
}
//# sourceMappingURL=module-loader-tool.d.ts.map