import { MLTBundlesManager } from './bundles-manager';
import { MLTCompiler } from './compiler';
import { MLTConfig } from './config';
import { MLTDependenciesManager } from './dependencies-manager';
import { MLTSourceLoader } from './source-loader';
import {
  ModuleSearchType,
  TBaseModuleManifest,
  TCompiledMonad,
  TPrefetchConfig,
  TSearchModuleResult,
  TSourceLoaderResult,
  TSourceMonad
} from './types';

/**
 * Кэш для хранения загруженных и загружаемых модулей
 */
export class MLTCore<TUserManifest extends TBaseModuleManifest> {
  private cache: Record<string, Promise<TCompiledMonad<TUserManifest>>> = {};
  private errorCache: Record<string, Error> = {};
  private readonly bundlesManager: MLTBundlesManager<TUserManifest>;
  private readonly config: MLTConfig<TUserManifest>;
  private readonly sourceLoader: MLTSourceLoader<TUserManifest>;
  private readonly compiler: MLTCompiler<TUserManifest>;
  private readonly dependenciesManager: MLTDependenciesManager;

  constructor(dependencies: {
    bundlesManager: MLTBundlesManager<TUserManifest>;
    compiler: MLTCompiler<TUserManifest>;
    config: MLTConfig<TUserManifest>;
    dependenciesManager: MLTDependenciesManager;
    loader: MLTSourceLoader<TUserManifest>;
  }) {
    this.bundlesManager = dependencies.bundlesManager;
    this.config = dependencies.config;
    this.sourceLoader = dependencies.loader;
    this.dependenciesManager = dependencies.dependenciesManager;
    this.compiler = dependencies.compiler;
  }

  getBundleLoadingError(manifest: TUserManifest): Error | void {
    return this.errorCache[manifest.name];
  }

  hasCompiledBundle(moduleSearchResult: TSearchModuleResult<TUserManifest>): boolean {
    if (!moduleSearchResult) {
      return false;
    }

    return !!this.cache[moduleSearchResult.manifest.name];
  }

  saveCompiledBundle(compiledBundle: TCompiledMonad<TUserManifest>): void {
    const {
      manifest: { name: manifestName }
    } = compiledBundle;
    this.cache[manifestName] = Promise.resolve(compiledBundle);
  }

  startCompiledBundle(compiledBundle: TCompiledMonad<TUserManifest>): void {
    const { module } = compiledBundle;

    if (!module) {
      return;
    }

    try {
      module.exports && module.exports.start && module.exports.start();
    } catch (startError) {
      console.error(`Cant execute start() in bundle "${compiledBundle.manifest.name}", error: `, startError);
    }

    if (module.exports && module.exports.getModuleDependencies) {
      const moduleDependencies = module.exports.getModuleDependencies() || {};
      Object.keys(moduleDependencies).forEach((dependencyKey: string) =>
        this.dependenciesManager.installDependency(
          // @ts-ignore
          dependencyKey,
          // @ts-ignore
          moduleDependencies[dependencyKey]
        )
      );
    }

    if (module.exports && module.exports.getUnknownResolver) {
      const resolver = module.exports.getUnknownResolver();
      this.dependenciesManager.installUnknownDependencyResolver(resolver, compiledBundle.manifest);
    }
  }

  loadAndCompileBundle(manifest: TUserManifest): Promise<TCompiledMonad<TUserManifest>> {
    this.executePrefetch(manifest.prefetchFn);
    this.preloadModules(manifest.preloadModules);

    return this.loadBlockModules(manifest.blockModules).then(() => this.internalLoadAndCompile(manifest));
  }

  /**
   * Чистая функция, которая запустит prefetch-запрос.
   * Если модуль, откуда вызывается префеч не загружен - он будет загружен и потянет за собой все свои зависимости
   */
  private executePrefetch(prefetchConfig: TPrefetchConfig | void): void {
    if (!prefetchConfig) {
      return;
    }

    const prefetchStr = `${prefetchConfig.serviceName}.${prefetchConfig.fn}`;

    const prefetchManifest = this.bundlesManager.searchBundleManifest(prefetchStr);
    if (!prefetchManifest) {
      console.debug(`Prefetch: No manifest for module "${prefetchConfig.serviceName}"`);

      return;
    }
    if (prefetchManifest.type === ModuleSearchType.MODULE) {
      console.debug(`Prefetch: Manifest for "${prefetchStr}" has type MODULE, not a CHILD. We dont know what to call`);
      console.debug('If you want to only preload bundle - use "useBundles" prop');

      return;
    }

    this.internalLoadAndCompile(prefetchManifest.manifest).then(
      // tslint:disable-next-line
      ({ module: compiledModule }: TCompiledMonad<any>) => {
        if (!compiledModule) {
          console.debug(`Prefetch: no compiled module for "${prefetchConfig}"`);

          return;
        }

        try {
          compiledModule.exports[prefetchManifest.childName]();
        } catch (e) {
          console.error(`Cant complete prefetch "${prefetchConfig}". Error: `, e);
        }
      }
    );
  }

  /**
   * Метод начнет грузить все модули, которые указаны к предзагрузке
   */
  private preloadModules(modulesToPreload: Array<string> | void): void {
    if (!modulesToPreload || !modulesToPreload.length) {
      return;
    }

    modulesToPreload.forEach((serviceName: string) => {
      const searchResult = this.bundlesManager.searchBundleManifest(serviceName);
      if (!searchResult) {
        console.debug(`useModules: No manifest for module ${serviceName}`);

        return;
      }

      this.internalLoadAndCompile(searchResult.manifest);
    });
  }

  /**
   * Метод загрузит и скомпилирует все модули, помеченные
   */
  private loadBlockModules(blockModules: Array<string> | void): Promise<void> {
    if (!blockModules || !blockModules.length) {
      return Promise.resolve();
    }

    return Promise.all(
      blockModules
        .map((serviceName: string) => {
          const searchResult = this.bundlesManager.searchBundleManifest(serviceName);
          if (!searchResult) {
            console.debug(`blockModules: No manifest for module ${serviceName}`);

            return;
          }

          return this.internalLoadAndCompile(searchResult.manifest);
        })
        .filter((p: Promise<unknown> | void) => !!p)
    ).then(() => void 0);
  }

  private internalLoadAndCompile(manifest: TUserManifest): Promise<TCompiledMonad<TUserManifest>> {
    const manifestName = manifest.name;
    if (this.cache[manifestName]) {
      return this.cache[manifestName].then((compiledMonad: TCompiledMonad<TUserManifest>) =>
        compiledMonad.module === void 0
          ? (this.cache[manifestName] = this.loadAndCompile(manifest))
          : this.cache[manifestName]
      );
    } else {
      return (this.cache[manifestName] = this.loadAndCompile(manifest));
    }
  }

  private loadAndCompile(manifest: TUserManifest): Promise<TCompiledMonad<TUserManifest>> {
    return this.config.processorsManager
      .runPreprocessors(manifest)
      .then(() => this.sourceLoader.loadSource(manifest))
      .then((sourceLoaderResult: TSourceLoaderResult<TUserManifest>) => {
        if (sourceLoaderResult.sourceLoadError) {
          this.errorCache[manifest.name] = sourceLoaderResult.sourceLoadError;
        }

        return this.config.processorsManager.runSourcePreprocessors(sourceLoaderResult.sourceMonad);
      })
      .then((sourceMonad: TSourceMonad<TUserManifest>) => this.compiler.compile(sourceMonad, this.dependenciesManager))
      .then(
        // @ts-ignore
        (compiledMonad: TCompiledMonad<TUserManifest>) => {
          this.startCompiledBundle(compiledMonad);

          return this.config.processorsManager.runPostprocessors(compiledMonad).then(() => compiledMonad);
        }
      );
  }

  /**
   * От bulk не должно требовать результата - это просто в пустоту когда-то сработает и сохранится в кэш
   * Но при этом конечно, если при работе bulk запросить еще раз один из микросервисов - он возьмется из кэша
   * @param manifests
   */
  bulkLoadBundles(manifests: Array<TUserManifest>): Promise<void> {
    return Promise.all(manifests.map((manifest: TUserManifest) => this.loadAndCompileBundle(manifest)))
      .then(() => {})
      .catch((error: Error) => {
        console.error('Это случилось, ошибка при bulkLoadBundles где-то выше', error);
      });
  }
}
