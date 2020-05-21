import { MLTDependenciesManager } from './dependencies-manager';
import {
  ErrorTypes,
  TBaseModuleManifest,
  TCompiledModule,
  TCompiledMonad,
  TCompileFn,
  TSourceCompilingResult,
  TSourceMonad
} from './types';

function defaultCompileFn<TUserManifest extends TBaseModuleManifest>(
  sourceMonad: TSourceMonad<TUserManifest>,
  dependenciesManager: MLTDependenciesManager
): Promise<TCompiledModule> {
  const { manifest, source: sourceCode } = sourceMonad;
  if (!sourceCode) {
    return Promise.reject(new Error(`No source code passed into compiler for module "${manifest.name}"`));
  }

  const require = dependenciesManager.retrieveDependencyByName.bind(dependenciesManager, sourceMonad.manifest);

  // TODO поставить сеттеры, чтобы понимать, куда компилированный модуль положил данные - чистый там UMD или вебпак
  const exports = {};

  const module: TCompiledModule = {
    exports: {}
  };

  try {
    const $$manifest: TUserManifest = manifest;
    // tslint:disable-next-line
    eval(sourceCode);
  } catch (ex) {
    return Promise.reject(Error(`Cant compile module "${manifest.name}": ${ex.message}`));
  }

  return Promise.resolve(module);
}

export class MLTCompiler<TUserManifest extends TBaseModuleManifest> {
  private compileFn: TCompileFn<TUserManifest> = defaultCompileFn;
  private notCompiledBundles: Array<string> = [];

  defineCompileFn = <T>(compileFn: TCompileFn<TUserManifest, T>): void => {
    this.compileFn = compileFn;
  };

  compile = <TModule>(
    sourceMonad: TSourceMonad<TUserManifest>,
    dependenciesManager: MLTDependenciesManager
  ): Promise<TSourceCompilingResult<TCompiledMonad<TUserManifest, TCompiledModule<TModule>>>> => {
    if (!sourceMonad.source) {
      return Promise.resolve({
        compiledMonad: {
          manifest: sourceMonad.manifest,
          module: void 0
        },
        sourceCompilingError: void 0
      });
    }

    if (this.notCompiledBundles.includes(sourceMonad.manifest.name)) {
      console.error('Retry compile source, but already known that source is invalid', sourceMonad.manifest);

      return Promise.resolve({
        compiledMonad: {
          manifest: sourceMonad.manifest,
          module: void 0
        },
        sourceCompilingError: void 0
      });
    }

    return (
      this.compileFn(sourceMonad, dependenciesManager)
        .catch((error: Error) => {
          console.error('Cant compile bundle', sourceMonad.manifest, 'error:', error);
          this.notCompiledBundles.push(sourceMonad.manifest.name);

          return error;
        })
        // @ts-ignore
        .then((moduleOrError: TCompiledModule<TModule> | Error) => {
          const error =
            moduleOrError instanceof Error
              ? {
                  error: moduleOrError,
                  type: ErrorTypes.MODULE_COMPILE_ERROR
                }
              : void 0;

          return {
            compiledMonad: {
              manifest: sourceMonad.manifest,
              module: moduleOrError instanceof Error ? void 0 : moduleOrError
            },
            sourceCompilingError: error
          };
        })
    );
  };
}
