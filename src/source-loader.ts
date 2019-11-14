import { MLTConfig } from './config';
import { TBaseModuleManifest, TFormatUrlFn, TLoadSourceFn, TSourceMonad } from './types';

const defaultLoadSourceFn: TLoadSourceFn = (url: string): Promise<string> => {
  return fetch(url).then((response: Response) => {
    if (!response.ok) {
      throw new Error(`Cant load bundle, http error ${response.status}`);
    }

    return response.text();
  });
};

export class MLTSourceLoader<TUserManifest extends TBaseModuleManifest> {
  private get loadSourceFn(): TLoadSourceFn {
    return this.config.configObj.loadSourceFn || defaultLoadSourceFn;
  }

  private get formatUrlFn(): TFormatUrlFn<TUserManifest> {
    return this.config.configObj.urlFormatter;
  }

  private notLoadedManifests: Array<string> = [];
  private loadingCache: Record<string, Promise<TSourceMonad<TUserManifest>>> = {};

  // tslint:disable-next-line:no-any
  constructor(private config: MLTConfig<any>) {}

  loadSource = (manifest: TUserManifest): Promise<TSourceMonad<TUserManifest>> => {
    if (!this.formatUrlFn) {
      throw new Error('No formatUrlFn function provided in mlt.loader');
    }

    if (this.notLoadedManifests.includes(manifest.name)) {
      console.error('Retry load source, but already known that url invalid', manifest);

      return Promise.resolve({
        manifest,
        source: void 0
      });
    }

    const url = this.formatUrlFn(manifest);

    // Кажется на этом уровне кэш лишний - в core уже кешируется же
    if (!this.loadingCache[url]) {
      this.loadingCache[url] = this.loadSourceFn(url).catch(
        (error: Error) => {
          console.error('Cant load source for manifest', manifest);
          console.error('Error: ', error);
          this.notLoadedManifests.push(manifest.name);
        }
      ).then(
        (moduleSource: string | void) => {
          return this.config.processorsManager.runSourcePreprocessors({
            manifest,
            source: moduleSource
          });
        }
      );
    }

    return this.loadingCache[url];
  };
}
