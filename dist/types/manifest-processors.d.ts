import { CompiledModule, IBaseModuleManifest, ModulePostprocessor, ModulePreprocessor, TypeMatcher } from './interface';
export declare class ManifestProcessors<TModuleManifest extends IBaseModuleManifest> {
    private typeMatchers;
    private modulePreprocessors;
    private modulePostprocessors;
    private getModuleTypeByManifest;
    registerManifestType(type: string, typeMatcher: TypeMatcher<TModuleManifest>, modulePreprocessor?: ModulePreprocessor<TModuleManifest>, modulePostprocessor?: ModulePostprocessor<TModuleManifest>): void;
    runPreprocessor(manifest: TModuleManifest): Promise<void>;
    runPostprocessor(manifest: TModuleManifest, module: CompiledModule): Promise<void>;
}
//# sourceMappingURL=manifest-processors.d.ts.map