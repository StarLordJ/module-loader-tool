/**
 * Стратегии загрузки модулей
 */
export enum ModuleLoadStrategy {
  /**
   * Блокирующая стратегия. Не будет дан старт приложению до тех пор,
   * пока не загрузятся все блокирующие модули
   */
  BLOCK = 'block',

  /**
   * Неблокирующая стратегия, модули начнут загружаться после того, как будет дан старт приложению
   */
  IMMEDIATELY = 'immediately',

  /**
   * Стратегия загрузки сервисов по запросу, автоматически не грузятся
   */
  ON_DEMAND = 'on_demand',

  /**
   * Стартегия загрузки сервисов лениво, по доступности.
   * Доступность командуется извне, например из сервис-воркера если например пять секунд не было запросов сети
   */
  LAZY = 'lazy'
}

/**
 * Тип подмодуля
 */
export enum ModuleSearchType {
  /**
   * Или корневой модуль, или дочерний модуль - они равны перед системой
   */
  MODULE = 'module',

  /**
   * Ребенок, вкомпилирован в сам модуль
   */
  CHILD = 'child'
}

/**
 * Базовые поля, необходимые каждому манифесту
 */
export type TBaseModuleManifest<TUserAddition = {}, TChild = {}> = {
  name: string;
  loadStrategy: ModuleLoadStrategy;
  fileName: string;
  childs?: Array<TChild>;
  modules?: Record<string, TBaseModuleManifest<TUserAddition>>
} & TUserAddition;

export type TManifestFlattener<T extends TBaseModuleManifest = never> = (manifestObject: object) => Array<T>;

export type TModuleDependencies = Record<string, object>;

export type TUnknownDependencyResolver = (name: string) => object | void;

export type TFormatUrlFn<TUserManifest extends TBaseModuleManifest> = (module: TUserManifest) => string;

export type TLoadSourceFn = (url: string) => Promise<string>;

// tslint:disable-next-line:no-any
export type TCompileFn<T = {}> = (sourceCode: string, ...args: Array<any>) => Promise<TCompiledModule<T>>;

export type TSearchModuleResult<T extends TBaseModuleManifest = never> = (
  { manifest: T } & (
    | { type: ModuleSearchType.MODULE }
    | { type: ModuleSearchType.CHILD, childName: string }
  )
) | void;

export type TCompiledModule<T = {}> = {
  exports: {
    start?: () => void;
    getModuleDependencies?: () => object;
    // tslint:disable-next-line:no-any
    [key: string]: any;
  } & T;
};

// Не совсем трушные монады, но внутри системы и исходники, и скомпилированные объекты передаются
// в паре со своими манифестами

export type TSourceMonad<TUserManifest> = {
  manifest: TUserManifest;
  source: string | void;
};

export type TCompiledMonad<TUserManifest, TModule extends TCompiledModule = TCompiledModule> = {
  manifest: TUserManifest;
  module: TModule | void;
};

type TProcessorResult = Promise<void> | Promise<never> | void;
export type TTypeMatcher<T extends TBaseModuleManifest> = (manifest: T) => boolean;
export type TTypeMatcherWithSource<T extends TBaseModuleManifest> = (sourceMonad: TSourceMonad<T>) => boolean;
export type TModulePreprocessor<T extends TBaseModuleManifest> = (manifest: T) => TProcessorResult;
export type TSourcePreprocessor<T extends TBaseModuleManifest> =
  (sourceMonad: TSourceMonad<T>) => Promise<TSourceMonad<T>>;
export type TModulePostprocessor<T extends TBaseModuleManifest> =
  (compiledMonad: TCompiledMonad<T>) => TProcessorResult;

export type TMltConfig<TUserManifest extends TBaseModuleManifest> = {
  dependencies: TModuleDependencies;
  unknownDependencyResolver?: TUnknownDependencyResolver;

  rootManifestUrl: string;
  manifestFlattener: TManifestFlattener<TUserManifest>;

  urlFormatter: TFormatUrlFn<TUserManifest>;
  loadSourceFn?: TLoadSourceFn;

  compileFn?: TCompileFn;
};
