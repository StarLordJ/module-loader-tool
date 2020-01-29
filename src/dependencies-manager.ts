import { MLTConfig } from './config';
import { TBaseModuleManifest, TModuleDependencies, TUnknownDependencyResolver } from './types';

function throwNoDependencyInstalled(dependencyName: string): never {
  throw new Error(`Dependency "${dependencyName}" is not provided to MLTDependenciesManager`);
}

function throwDependencyAlreadyInstalled(dependencyName: string): never {
  throw new Error(`Dependency "${dependencyName}" already installed. Check your code logic`);
}

export class MLTDependenciesManager {
  private get dependencies(): TModuleDependencies {
    return this.config.configObj.dependencies;
  }

  private set dependencies(d: TModuleDependencies) {
    this.config.configObj.dependencies = d;
  }

  private get unknownResolver(): TUnknownDependencyResolver | void {
    return this.config.configObj.unknownDependencyResolver;
  }

  // tslint:disable-next-line:no-any
  constructor(private config: MLTConfig<any>) {}

  // tslint:disable-next-line:no-any
  installDependency = (dependencyName: string, module: any, force: boolean = false): this => {
    if (force) {
      console.debug('Using "force" to setup dependency allowed only in core');
    }

    if (!force && this.dependencies[dependencyName]) {
      throwDependencyAlreadyInstalled(dependencyName);
    }

    this.dependencies = {
      ...this.dependencies,
      [dependencyName]: module
    };

    return this;
  };

  /**
   * Получить зависимость из функции require
   * @internal
   */
  retrieveDependencyByName = (manifest: TBaseModuleManifest, dependencyName: string): object => {
    if (this.dependencies[dependencyName]) {
      return this.dependencies[dependencyName];
    }

    if (!this.unknownResolver) {
      return throwNoDependencyInstalled(dependencyName);
    }

    const dependency = this.unknownResolver(dependencyName, manifest);

    if (dependency) {
      return dependency;
    }

    return throwNoDependencyInstalled(dependencyName);
  };
}
