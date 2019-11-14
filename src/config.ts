import { MLTProcessorsManager } from './processors-manager';
import { TBaseModuleManifest, TMltConfig } from './types';

export class MLTConfig<TUserManifest extends TBaseModuleManifest> {
  configObj: TMltConfig<TUserManifest>;
  private readonly _processorsManager: MLTProcessorsManager<TUserManifest> = new MLTProcessorsManager();

  get processorsManager(): MLTProcessorsManager<TUserManifest> {
    return this._processorsManager;
  }

  configure(config: TMltConfig<TUserManifest>): void {
    this.configObj = config;
  }

  updateConfig(config: Partial<TMltConfig<TUserManifest>>): void {
    Object.assign(this.configObj, config);
  }

  // tslint:disable-next-line:cyclomatic-complexity
  startupCheck(): void | Array<string> {
    const errors: Array<string | void> = [
      this.configObj.rootManifestUrl ? void 0 : 'No root manifest url defined. Update config.rootManifestUrl',
      this.configObj.manifestFlattener ? void 0 : 'No root manifest flattener defined. Update config.manifestFlattener',
      this.configObj.urlFormatter ? void 0 : 'No format bundle url function defined. Update config.urlFormatter',
      this.configObj.dependencies ? void 0 : 'No dependencies defined. Update config.dependencies'
    ].filter(Boolean);

    return errors.length ? errors as Array<string> : void 0;
  }
}
