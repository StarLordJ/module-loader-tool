import { MLTDependenciesManager } from './dependencies-manager';
import { TBaseModuleManifest, TCompiledModule, TCompiledMonad, TCompileFn, TSourceMonad } from './types';

function defaultCompileFn(
  sourceCode: string,
  dependenciesManager: MLTDependenciesManager
): Promise<TCompiledModule> {
  const require = dependenciesManager.retrieveDependencyByName;

  // TODO поставить сеттеры, чтобы понимать, куда компилированный модуль положил данные - чистый там UMD или вебпак
  const exports = {};

  const module: TCompiledModule = {
    exports: {}
  };

  try {
    // tslint:disable-next-line
    eval(sourceCode);
  } catch (ex) {
    throw new Error(`Cant compile module: ${ ex.message }`);
  }

  return Promise.resolve(module);
}

export class MLTCompiler<TUserManifest extends TBaseModuleManifest> {
  private compileFn: TCompileFn = defaultCompileFn;
  private notCompiledBundles: Array<string> = [];

  defineCompileFn = <T>(compileFn: TCompileFn<T>): void => {
    this.compileFn = compileFn;
  };

  compile = <TModule>(
    sourceMonad: TSourceMonad<TUserManifest>,
    dependenciesManager: MLTDependenciesManager
  ): Promise<TCompiledMonad<TUserManifest, TCompiledModule<TModule>>> => {
    if (!sourceMonad.source) {
      return Promise.resolve({
        manifest: sourceMonad.manifest,
        module: void 0
      });
    }

    if (this.notCompiledBundles.includes(sourceMonad.manifest.name)) {
      console.error('Retry compile source, but already known that source is invalid', sourceMonad.manifest);

      return Promise.resolve({
        manifest: sourceMonad.manifest,
        module: void 0
      });
    }

    return this.compileFn(sourceMonad.source, dependenciesManager).catch(
      (error: Error) => {
        console.error('Cant compile bundle', sourceMonad.manifest, 'error:', error);
        this.notCompiledBundles.push(sourceMonad.manifest.name);
      }
    ).then(
      // @ts-ignore
      (module: TCompiledModule<TModule> | void) => ({
        manifest: sourceMonad.manifest,
        module
      })
    );
  };
}
