import { MLTCompiler } from './compiler';
import { MLTConfig } from './config';
import { MLTDependenciesManager } from './dependencies-manager';
import { MLTSourceLoader } from './source-loader';
import { TBaseModuleManifest, TCompiledMonad, TSearchModuleResult, TSourceMonad } from './types';

/**
 * Кэш для хранения загруженных и загружаемых модулей
 */
export class MLTCore<TUserManifest extends TBaseModuleManifest> {
  private cache: Record<string, Promise<TCompiledMonad<TUserManifest>>> = {};
  private readonly config: MLTConfig<TUserManifest>;
  private readonly sourceLoader: MLTSourceLoader<TUserManifest>;
  private readonly compiler: MLTCompiler<TUserManifest>;
  private readonly dependenciesManager: MLTDependenciesManager;

  constructor(
    dependencies: {
      compiler: MLTCompiler<TUserManifest>,
      config: MLTConfig<TUserManifest>,
      dependenciesManager: MLTDependenciesManager,
      loader: MLTSourceLoader<TUserManifest>
    }
  ) {
    this.config = dependencies.config;
    this.sourceLoader = dependencies.loader;
    this.dependenciesManager = dependencies.dependenciesManager;
    this.compiler = dependencies.compiler;
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
  }

  loadAndCompileBundle(manifest: TUserManifest): Promise<TCompiledMonad<TUserManifest>> {
    const manifestName = manifest.name;
    if (!this.cache[manifestName]) {
      this.cache[manifestName] = this.config.processorsManager
        .runPreprocessors(manifest)
        .then(() => this.sourceLoader.loadSource(manifest))
        .then((sourceMonad: TSourceMonad<TUserManifest>) =>
          this.config.processorsManager.runSourcePreprocessors(sourceMonad)
        )
        .then((sourceMonad: TSourceMonad<TUserManifest>) =>
          this.compiler.compile(sourceMonad, this.dependenciesManager)
        )
        .then(
          // @ts-ignore
          (compiledMonad: TCompiledMonad<TUserManifest>) => {
            this.startCompiledBundle(compiledMonad);

            return this.config.processorsManager.runPostprocessors(compiledMonad).then(() => compiledMonad);
          }
        );
    }

    return this.cache[manifestName];
  }

  /**
   * От bulk не должно требовать результата - это просто в пустоту когда-то сработает и сохранится в кэш
   * Но при этом конечно, если при работе bulk запросить еще раз один из микросервисов - он возьмется из кэша
   * @param manifests
   */
  bulkLoadBundles(manifests: Array<TUserManifest>): Promise<void> {
    return Promise.all(
      manifests.map((manifest: TUserManifest) => this.loadAndCompileBundle(manifest))
    )
      .then(() => {})
      .catch((error: Error) => {
        console.error('Это случилось, ошибка при bulkLoadBundles где-то выше', error);
      });
  }
}
