export enum ModuleLoadStrategy {
  BLOCK = 'block',
  IMMEDIATELY = 'immediately',
  ON_DEMAND = 'on_demand',
  LAZY = 'lazy'
}

export interface IBaseModuleManifest {
  name: string;
  loadStrategy: ModuleLoadStrategy;
  fileName: string;
}

export interface IModuleLoaderEntrypoint<T extends IBaseModuleManifest> {
  manifestUrl: string;
  // tslint:disable-next-line
  flattener?: (manifestObject: any) => Array<T>;
}

export type ModuleDependencies = Record<string, object>;
export type ModuleUrlFormatter<T extends IBaseModuleManifest> = (manifest: T) => string;

export type CompiledModuleControls = {
  start?: () => void;
  getComponent?: () => React.ComponentClass;
};

export type CompiledModule = {
  exports: {
    controls: CompiledModuleControls;
    [key: string]: object;
  };
};

export type TypeMatcher<T> = (manifest: T) => boolean;
export type ModulePreprocessor<T> = (manifest: T) => Promise<void>;
export type ModulePostprocessor<T> = (manifest: T, module: CompiledModule) => Promise<void>;
