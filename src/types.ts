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
 * Базовые поля, необходимые каждому манифесту
 */
export type TBaseModuleManifest = {
  name: string;
  loadStrategy: ModuleLoadStrategy;
  fileName: string;
};
//
// export type TModuleLoaderEntrypoint<T extends TBaseModuleManifest> = {
//   manifestUrl: string;
//   // tslint:disable-next-line
//   flattener?: (manifestObject: any) => Array<T>;
// };

export type TModuleDependencies = Record<string, object>;
// export type ModuleUrlFormatter<T extends IBaseModuleManifest> = (manifest: T) => string;

export type TCompiledModule<T = {}> = {
  exports: {
    start?: () => void;
  } & T;
};

export enum MLTWorkMode {
  SILENTLY = 'silently',
  WARNING = 'warning',
  ERROR = 'error'
}

//
// export type TypeMatcher<T> = (manifest: T) => boolean;
// export type ModulePreprocessor<T> = (manifest: T) => Promise<void> | Promise<never> | void;
// export type ModulePostprocessor<T> = (manifest: T, module: CompiledModule) => Promise<void> | Promise<never> | void;
