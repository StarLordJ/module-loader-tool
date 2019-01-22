import { CompileModuleError, LoadBundleError, NoDependencyError, PostprocessorError } from './errors';
import {
  CompiledModule,
  IBaseModuleManifest,
  IModuleLoaderEntrypoint,
  ModuleDependencies,
  ModuleLoadStrategy,
  ModuleUrlFormatter
} from './interface';
import { ManifestProcessors } from './manifest-processors';

const InvalidHttpStatusStart = 400;

function fetchBundleSource(url: string): Promise<string> {
  return fetch(url).then((response: Response) => {
    if (response.status >= InvalidHttpStatusStart) {
      throw new LoadBundleError(`Cant load bundle, http error ${response.status}`);
    }

    return response.text();
  });
}

function compileSource(source: string, dependencies: ModuleDependencies): CompiledModule {
  // @ts-ignore
  // tslint:disable-next-line
  const require = (name: string): any => {
    const dependency = dependencies[name];
    if (!dependency) {
      // В любом случае кинуть ошибку. Может быть конечно, что микросервис просит зависимость,
      // но не использует её и скомпилируется, однако лучше явно сообщить и по результатам:
      // а) Выпилить зависимость из микросервиса
      // б) Внести зависимость в ядро
      // в) Вкомпилировать зависимость в микросервис
      throw new NoDependencyError(`Dependency "${name}" does not provided by core application`);
    }

    return dependency;
  };
  const exports = {};
  const module = {
    exports: {}
  };
  try {
    // tslint:disable-next-line
    eval(source);
  } catch (ex) {
    throw new CompileModuleError(`Cant compile module: ${ex.message}`);
  }

  return module as CompiledModule;
}

export class ModuleLoaderTool<TModuleManifest extends IBaseModuleManifest> {
  private dependencies: ModuleDependencies = {};
  private urlFormatter: ModuleUrlFormatter<TModuleManifest>;
  private entrypoint: IModuleLoaderEntrypoint<TModuleManifest>;

  private manifestProcessors: ManifestProcessors<TModuleManifest> = new ManifestProcessors();
  private _bundlesList: Array<TModuleManifest>;
  private bundlesCache: Record<string, CompiledModule> = {};
  private loadersCache: Record<string, Promise<CompiledModule | void>> = {};

  get bundlesList(): Array<TModuleManifest> {
    return this._bundlesList;
  }

  private startupCheck(): void {
    if (!this.urlFormatter) {
      throw new Error('urlFormatter is not defined');
    }

    if (!this.entrypoint) {
      throw new Error('entrypoint is not defined');
    }
  }

  private loadBulkBundles(filterFn: (manifest: TModuleManifest) => boolean): Promise<void> {
    return Promise.all(
      this.bundlesList.filter(filterFn).map((manifest: TModuleManifest) => this.loadBundleByManifest(manifest))
    ).then((compiledBundles: Array<CompiledModule | void>) => {
      compiledBundles.forEach((compiledBundle: CompiledModule | void) => {
        const controls = compiledBundle && compiledBundle.exports.controls;
        if (controls && controls.start) {
          controls.start();
        }
      });
    });
  }

  defineDependencies(dependencies: ModuleDependencies): void {
    this.dependencies = dependencies;
  }

  defineUrlFormatter(formatter: ModuleUrlFormatter<TModuleManifest>): void {
    this.urlFormatter = formatter;
  }

  defineEntrypoint(entrypoint: IModuleLoaderEntrypoint<TModuleManifest>): void {
    this.entrypoint = entrypoint;
  }

  defineManifestType(
    type: string,
    typeMatcher: (manifest: TModuleManifest) => boolean,
    modulePreprocessor?: (manifest: TModuleManifest) => Promise<void>,
    modulePostprocessor?: (manifest: TModuleManifest, module: CompiledModule) => Promise<void>
  ): void {
    this.manifestProcessors.registerManifestType(type, typeMatcher, modulePreprocessor, modulePostprocessor);
  }

  isBundleLoaded(bundleName: string): boolean {
    return !!this.bundlesCache[bundleName];
  }

  load(filterFn?: (m: TModuleManifest) => boolean): Promise<void> {
    this.startupCheck();

    return fetch(this.entrypoint.manifestUrl)
      .then((response: Response) => response.text())
      .then((bundlesText: string) => JSON.parse(bundlesText))
      .then(
        // tslint:disable-next-line
        (bundlesObj: any) => {
          const flattener = this.entrypoint.flattener;
          const loadedBundles = flattener ? flattener(bundlesObj) : bundlesObj;

          if (!filterFn) {
            this._bundlesList = loadedBundles;
            return;
          }

          this._bundlesList = loadedBundles.filter(filterFn);
        }
      )
      .then(() =>
        this.loadBulkBundles((manifest: TModuleManifest) => manifest.loadStrategy === ModuleLoadStrategy.BLOCK)
      );
  }

  // tslint:disable-next-line
  start(runner: (...args: Array<any>) => any): Promise<void> {
    // Run and load immediately services in parallel
    return Promise.resolve()
      .then(() => runner())
      .then(() =>
        this.loadBulkBundles((manifest: TModuleManifest) => manifest.loadStrategy === ModuleLoadStrategy.IMMEDIATELY)
      );
  }

  loadBundleByManifest(manifest: TModuleManifest): Promise<CompiledModule | void> {
    if (this.bundlesCache[manifest.name]) {
      return Promise.resolve(this.bundlesCache[manifest.name]);
    }

    if (this.loadersCache[manifest.name]) {
      return this.loadersCache[manifest.name];
    }

    const serviceFileUrl = this.urlFormatter(manifest);

    this.loadersCache[manifest.name] = this.manifestProcessors
      .runPreprocessor(manifest)
      .then(() => fetchBundleSource(serviceFileUrl))
      .then((source: string) => compileSource(source, this.dependencies))
      .then((compiledModule: CompiledModule) => {
        this.bundlesCache[manifest.name] = compiledModule;

        return this.manifestProcessors
          .runPostprocessor(manifest, compiledModule)
          .then(() => compiledModule)
          .catch(() => {
            throw new PostprocessorError('Postprocessor crashed');
          });
      })
      .catch((error: NoDependencyError | CompileModuleError | PostprocessorError) => {
        console.error(`Module: ${manifest.name}. Error: ${error.message}`);

        return void 0;
      });

    return this.loadersCache[manifest.name];
  }

  loadBundleByName(name: string): Promise<CompiledModule | void> {
    const manifest = this._bundlesList.find((m: TModuleManifest) => m.name === name);
    if (!manifest) {
      throw new Error(`Module with name "${name}" is not declared`);
    }

    return this.loadBundleByManifest(manifest);
  }
}
