import { MLTConfig } from './config';
import {
  ModuleSearchType,
  TBaseModuleManifest,
  TManifestFlattener,
  TSearchModuleResult
} from './types';
import { combineModuleAndRootManifest } from './utils';

export class MLTBundlesManager<TUserManifest extends TBaseModuleManifest> {
  private get rootManifestUrl(): string {
    return this.config.configObj.rootManifestUrl;
  }

  private get flattener(): TManifestFlattener<TUserManifest> {
    return this.config.configObj.manifestFlattener;
  }

  private manifests: Array<TUserManifest> = [];

  constructor(private config: MLTConfig<TUserManifest>) {}

  loadRootManifest(): Promise<Array<TUserManifest>> {
    return fetch(this.rootManifestUrl).then(
      (response: Response) => response.json()
    ).then(
      (manifest: object) => this.flattener(manifest)
    );
  }

  setBundlesList(newManifests: Array<TUserManifest>): void {
    // Расплющим модули в самостоятельные бандлы, а детей оставим

    newManifests.forEach((manifest: TUserManifest) => {
      this.addBundleManifest(manifest);
    });
  }

  addBundleManifest(manifest: TUserManifest): void {
    if (!manifest.modules) {
      this.manifests.push(manifest);

      return;
    }

    const { modules, ...rawManifest } = manifest;
    this.manifests.push(rawManifest as TUserManifest);

    Object.keys(modules).forEach((moduleName: string) => {
      const module = modules[moduleName];
      const moduleManifest = combineModuleAndRootManifest<TUserManifest>(
        rawManifest as TUserManifest,
        module as TUserManifest
      );
      this.manifests.push(moduleManifest);
    });
  }

  // tslint:disable-next-line:cyclomatic-complexity
  searchBundleManifest(name: string): TSearchModuleResult<TUserManifest> {
    // Сперва поищем модуль, если такой найдется. Здесь нам все равно есть ли точка в имени модуля -
    // на корневом уровне лежат только модули
    const rootManifest = this.manifests.find((bundle: TUserManifest) => bundle.name === name);
    if (rootManifest) {
      return {
        manifest: rootManifest,
        type: ModuleSearchType.MODULE
      };
    }

    if (!name.includes('.')) {
      // Если выше не нашли модуль и нету точки в имени - значит искали корневой модуль. И такого нет.
      console.error(
        `BundlesManager: Cant find module "${name}" - no data in root manifest`
      );

      return void 0;
    }

    const nameParts = name.split('.');
    // const [serviceName, moduleName, childName] = nameParts;

    // Одна точка в названии - чайлд микросервиса
    // Две точки - чайлд модуля
    if (nameParts.length === 2) {
      const [parentModuleName, childName] = nameParts;
      const childManifest = this.manifests.find(
        (bundle: TUserManifest) => bundle.name === parentModuleName
      );

      if (!childManifest) {
        console.error(
          `Searching "${name}". We think its a child of service. But we cant find manifest for "${parentModuleName}"`
        );

        return void 0;
      }

      return {
        childName,
        manifest: childManifest,
        type: ModuleSearchType.CHILD
      };
    }

    // Теперь можно поискать по детям в модулях
    const [serviceName, moduleName, moduleChildName] = nameParts;
    const serviceModuleName = `${serviceName}.${moduleName}`;

    const moduleManifest = this.manifests.find(
      (bundle: TUserManifest) => bundle.name === serviceModuleName
    );

    if (!moduleManifest) {
      console.error(
        `BundlesManager: Cant find module "${serviceModuleName}"(searching by "${name}") - no data in root manifest`
      );

      return void 0;
    }

    return {
      childName: moduleChildName,
      manifest: moduleManifest,
      type: ModuleSearchType.CHILD
    };
  }

  /**
   * loadable - либо корневые манифесты, либо манифесты модулей
   * @param filterFn - фильтрующая функция
   */
  filterBundles(filterFn: (manifest: TUserManifest) => boolean): Array<TUserManifest> {
    return this.manifests.filter(filterFn);
  }
}
