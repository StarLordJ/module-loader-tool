import { MLTBundlesManager } from './bundles-manager';
import { MLTConfig } from './config';
import { MLTSourceLoader } from './source-loader';
import { ModuleLoadStrategy, TBaseModuleManifest } from './types';

const DEFAULT_LOADER_LIMIT = 2;

export class MLTLazyManager<TUserManifest extends TBaseModuleManifest> {
  private isInitialized: boolean = false;
  private lazyModules: Array<TUserManifest> = [];
  private readonly config: MLTConfig<TUserManifest>;
  private readonly bundlesManager: MLTBundlesManager<TUserManifest>;
  private readonly sourceLoader: MLTSourceLoader<TUserManifest>;

  private get isComplete(): boolean {
    return this.lazyModules.length === 0;
  }

  private get loaderLimit(): number {
    return this.config.configObj.lazyLoaderLimit ? this.config.configObj.lazyLoaderLimit : DEFAULT_LOADER_LIMIT;
  }

  constructor(dependencies: {
    config: MLTConfig<TUserManifest>,
    bundlesManager: MLTBundlesManager<TUserManifest>
    sourceLoader: MLTSourceLoader<TUserManifest>
  }) {
    this.config = dependencies.config;
    this.bundlesManager = dependencies.bundlesManager;
    this.sourceLoader = dependencies.sourceLoader;
  }

  init(): void {
    if (this.isInitialized) { return; }
    this.isInitialized = true;
    this.lazyModules = this.bundlesManager.filterBundles(
      (manifest: TUserManifest) => manifest.loadStrategy === ModuleLoadStrategy.LAZY
    );
  }

  loadMoreLazyModules(): boolean {
    // Если случится так, что в лейзи стрельнут загрузкой раньше, чем будут готовы бандлы - надо просто сказать "Да,
    // еще есть что грузить. Просто потому, что мы пока не знаем объективно. Когда стрельнут еще раз - мб что-то
    // изменится.
    if (!this.isInitialized) {
      return true;
    }

    if (this.isComplete) {
      return false;
    }

    for (let i = 0, l = this.loaderLimit; i < l; i += 1) {
      const manifest = this.lazyModules.shift();
      if (!manifest) {
        return false;
      }
      this.sourceLoader.loadSource(manifest);
    }

    return true;
  }
}
