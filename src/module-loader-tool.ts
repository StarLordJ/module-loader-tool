import { MLTBundlesManager } from './bundles-manager';
import { MLTCompiler } from './compiler';
import { MLTConfig } from './config';
import { MLTCore } from './core';
import { MLTDependenciesManager } from './dependencies-manager';
import { MLTLazyManager } from './lazy-manager';
import { MLTProcessorsManager } from './processors-manager';
import { MLTSourceLoader } from './source-loader';
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
  private readonly sourceLoader: MLTSourceLoader<TUserManifest>;
  private readonly compiler: MLTCompiler<TUserManifest>;
  private readonly dependenciesManager: MLTDependenciesManager;
  private readonly lazyManager: MLTLazyManager<TUserManifest>;
  private readonly core: MLTCore<TUserManifest>;

  configure: (config: TMltConfig<TUserManifest>) => void = this.config.configure.bind(this.config);
  updateConfig: (config: Partial<TMltConfig<TUserManifest>>) => void = this.config.updateConfig.bind(this.config);
  processorsManager: MLTProcessorsManager<TUserManifest> = this.config.processorsManager;

  constructor() {
    this.sourceLoader = new MLTSourceLoader(this.config);
    this.dependenciesManager = new MLTDependenciesManager(this.config);
    this.compiler = new MLTCompiler();
    this.core = new MLTCore({
      bundlesManager: this.bundlesManager,
      compiler: this.compiler,
      config: this.config,
      dependenciesManager: this.dependenciesManager,
      loader: this.sourceLoader
    });
    this.lazyManager = new MLTLazyManager({
      bundlesManager: this.bundlesManager,
      config: this.config,
      sourceLoader: this.sourceLoader
    });
  }

  getBundleLoadingError(manifest: TUserManifest): Error | void {
    return this.core.getBundleLoadingError(manifest);
  }

  searchBundleManifest(name: string): TSearchModuleResult<TUserManifest> {
    return this.bundlesManager.searchBundleManifest(name);
  }

  loadAndCompileBundle(manifest: TUserManifest): Promise<TCompiledMonad<TUserManifest>> {
    return this.core.loadAndCompileBundle(manifest);
  }

  filter(filterFn: (manifest: TUserManifest) => boolean): Array<TUserManifest> {
    return this.bundlesManager.filterBundles(filterFn);
  }

  isBundleLoaded(manifest: TUserManifest): boolean {
    return this.core.hasCompiledBundle(this.searchBundleManifest(manifest.name));
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
      .then(() => this.lazyManager.init())
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
   * Возвращает ответ - есть еще на очереди ленивые модули или уже кончились
   */
  reportReadyToLazy(): boolean {
    return this.lazyManager.loadMoreLazyModules();
  }
}
