import { MLTConfig } from './config';
import { TBaseModuleManifest, TModuleDependencies, TUnknownDependencyResolver } from './types';

function throwNoDependencyInstalled(dependencyName: string): never {
  throw new Error(`Dependency "${dependencyName}" is not provided to MLTDependenciesManager`);
}

function throwDependencyAlreadyInstalled(dependencyName: string): never {
  throw new Error(`Dependency "${dependencyName}" already installed. Check your code logic`);
}

function throwInvalidResolver(manifest: TBaseModuleManifest): never {
  throw new Error(`Module "${manifest.name}" tried to install invalid dependency resolver.`);
}

export class MLTDependenciesManager {
  private _isDefaultUnknownResolverInstalled: boolean = false;
  private _unknownResolvers: Array<TUnknownDependencyResolver> = [];

  private get dependencies(): TModuleDependencies {
    return this.config.configObj.dependencies;
  }

  private set dependencies(d: TModuleDependencies) {
    this.config.configObj.dependencies = d;
  }

  // tslint:disable-next-line:no-any
  constructor(private config: MLTConfig<any>) {}

  private ensureDefaultUnknownDependencyResolverInstalled(): void {
    if (this._isDefaultUnknownResolverInstalled) {
      return;
    }
    if (this.config.configObj.unknownDependencyResolver) {
      this._unknownResolvers.push(this.config.configObj.unknownDependencyResolver);
    }
    this._isDefaultUnknownResolverInstalled = true;
  }

  private resolveUnknownDependency(dependencyName: string, manifest: TBaseModuleManifest): object | void {
    this.ensureDefaultUnknownDependencyResolverInstalled();
    // tslint:disable-next-line
    for (let i = 0; i < this._unknownResolvers.length; i += 1) {
      const resolver = this._unknownResolvers[i];
      const dependency = resolver(dependencyName, manifest);
      if (dependency) {
        return dependency;
      }
    }
  }

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

  installUnknownDependencyResolver = (resolver: TUnknownDependencyResolver, manifest: TBaseModuleManifest): this => {
    if (!resolver) {
      throwInvalidResolver(manifest);
    }
    this._unknownResolvers.push(resolver);

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

    const dependency = this.resolveUnknownDependency(dependencyName, manifest);

    if (dependency) {
      return dependency;
    }

    return throwNoDependencyInstalled(dependencyName);
  };
}
