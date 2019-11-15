import { MLTBundlesManager } from './bundles-manager';
import { MLTConfig } from './config';
import { MLTCore } from './core';
import { MLTProcessorsManager } from './processors-manager';
import {
  ModuleLoadStrategy,
  TBaseModuleManifest,
  TCompiledModule,
  TCompiledMonad,
  TMltConfig,
  TSearchModuleResult
} from './types';
import { combineModuleAndRootManifest, extractRawManifest } from './utils';

// TODO Может быть для разных бандлов могут быть разные конфиги/компиляторы?
export class ModuleLoaderTool<TUserManifest extends TBaseModuleManifest> {
  private readonly config: MLTConfig<TUserManifest> = new MLTConfig();
  private readonly bundlesManager: MLTBundlesManager<TUserManifest> = new MLTBundlesManager(this.config);
  private readonly core: MLTCore<TUserManifest> = new MLTCore(this.config);

  configure: (config: TMltConfig<TUserManifest>) => void = this.config.configure.bind(this.config);
  updateConfig: (config: Partial<TMltConfig<TUserManifest>>) => void = this.config.updateConfig.bind(this.config);
  processorsManager: MLTProcessorsManager<TUserManifest> = this.config.processorsManager;

  searchBundleManifest(name: string): TSearchModuleResult<TUserManifest> {
    return this.bundlesManager.searchBundleManifest(name);
  }

  loadAndCompileBundle(manifest: TUserManifest): Promise<TCompiledMonad<TUserManifest>> {
    return this.core.loadAndCompileBundle(manifest);
  }

  filter(filterFn: (manifest: TUserManifest) => boolean): Array<TUserManifest> {
    return this.bundlesManager.filterBundles(filterFn);
  }

  startupCheck(): void {
    const startupCheckErrors = this.config.startupCheck();
    if (startupCheckErrors) {
      console.warn('Startup check errors:');
      startupCheckErrors.forEach((error: string) => console.warn('- ', error));
      throw new Error('MLT startup check failed');
    }
  }

  private loadBlockBundles(): Promise<void> {
    const blockManifests = this.bundlesManager.filterBundles(
      (manifest: TUserManifest) => manifest.loadStrategy === ModuleLoadStrategy.BLOCK
    );

    return this.core.bulkLoadBundles(blockManifests);
  }

  private loadImmediatelyBundles(): Promise<void> {
    const immediatelyManifests = this.bundlesManager.filterBundles(
      (manifest: TUserManifest) => manifest.loadStrategy === ModuleLoadStrategy.IMMEDIATELY
    );

    return this.core.bulkLoadBundles(immediatelyManifests);
  }

  init(filterFn?: (m: TUserManifest) => boolean): Promise<void> {
    return this.bundlesManager
      .loadRootManifest()
      .then((bundlesList: Array<TUserManifest>) => bundlesList.filter(filterFn ? filterFn : (): boolean => true))
      .then((filteredBundlesList: Array<TUserManifest>) => this.bundlesManager.setBundlesList(filteredBundlesList))
      .then(() => this.loadBlockBundles());
  }

  // tslint:disable-next-line:no-any
  start(runner: (...args: Array<any>) => any): Promise<void> {
    // Run and next load immediately services
    return Promise.resolve()
      .then(() => runner())
      .then(() => this.loadImmediatelyBundles());
  }

  manuallyDefineBundle(
    manifest: TUserManifest,
    compiledModule: TCompiledModule,
    modules?: { [K in keyof TUserManifest['modules']]: TCompiledModule }
  ): void {
    console.log('manually define bundle');
    this.bundlesManager.addBundleManifest(manifest);

    const serviceMonad = {
      manifest: extractRawManifest(manifest),
      module: compiledModule
    };

    this.core.saveCompiledBundle(serviceMonad);
    this.core.startCompiledBundle(serviceMonad);

    if (manifest.modules && modules) {
      Object.keys(manifest.modules).forEach((moduleName: string) => {
        const moduleManifest = combineModuleAndRootManifest<TUserManifest>(
          manifest,
          // @ts-ignore ts bug
          manifest.modules[moduleName] as TUserManifest
        );
        // @ts-ignore
        const moduleMonad = { manifest: moduleManifest, module: modules[moduleName] };
        this.core.saveCompiledBundle(moduleMonad);
        this.core.startCompiledBundle(moduleMonad);
      });
    }
  }

  /**
   * Ручка, которую стоит дернуть при готовности грузить lazy-модули
   */
  reportReadyToLazy(): void {}
}
