import { TModuleDependencies } from './types';

export class ModuleLoaderTool {
  private dependencies: TModuleDependencies = {};

  setDependencies(dependencies: TModuleDependencies): this {
    this.dependencies = dependencies;

    return this;
  }

  installDependecy(dependencyName: string, module: object): this {
    if (this.dependencies[dependencyName]) {
      throw new Error();
    }

    return this;
  }
}
