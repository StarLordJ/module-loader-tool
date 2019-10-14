import { TCompiledModule, TModuleDependencies } from './types';

export type TModuleCompiler<T = {}> = (sourceCode: string, ...args: Array<any>) => Promise<TCompiledModule<T>>;

/**
 * Стандартный компилятор, настроенный на исполнение UMD модулей вида:
 *
 * @param sourceCode - исходный код модуля
 * @param dependencies - объект с зависимостями для компиляции
 * @param unknownResolver - функция для разрешения неизвестных зависимостей. Неизвестные зависимости могут
 * появляться в случае, если пакет содержит много путей экспорта, разработчик использует их, но не представляется
 * возможным перечислить их все в объекте зависимостей.
 * Например пакет ui-kit имеет пути 'ui-kit/button', 'ui-kit/label', 'ui-kit/input'.
 * Но в то же время все экспорты у него есть из корня. В этом случае резолвер будет примерно таким:
 *
 * import * as uikit from 'ui-kit';
 *
 * function unknownResolver(dependenyName: string): object {
 *    if (/^ui\-kit$/.test(dependencyName)){
 *      return uikit;
 *    }
 * }
 *
 * Когда скомпилированный код будет обращаться, например, к button - он будет делать это так:
 * require('ui-kit').button
 * Функция require не найдет ui-kit в dependencies и обратится к резолверу. А тот вернет объект, у которого будет
 * ключ button
 */
export const defaultCompiler: TModuleCompiler = (
  sourceCode: string,
  dependencies: TModuleDependencies,
  unknownResolver?: (name: string) => object | undefined
): Promise<TCompiledModule> => {
  const require = (name: string): object => {
    const dependency = dependencies[name];

    if (dependency) {
      return dependency;
    }

    if (!unknownResolver) {
      throw new Error(`Dependency "${name}" does not provided by core application`);
    }

    const unknownDependency = unknownResolver(name);

    if (unknownDependency) {
      return unknownDependency;
    }

    // В любом случае кинуть ошибку. Может быть конечно, что микросервис просит зависимость,
    // но не использует её и скомпилируется, однако лучше явно сообщить и по результатам:
    // а) Выпилить зависимость из микросервиса
    // б) Внести зависимость в ядро
    // в) Вкомпилировать зависимость в микросервис
    throw new Error(`Dependency "${name}" does not provided by core application`);
  };

  // TODO поставить сеттеры, чтобы понимать, куда компилированный модуль положил данные - чистый там UMD или вебпак
  const exports = {};

  const module: TCompiledModule = {
    exports: {}
  };

  try {
    // tslint:disable-next-line
    eval(sourceCode);
  } catch (ex) {
    throw new Error(`Cant compile module: ${ex.message}`);
  }

  return Promise.resolve(module);
};
