import { MLTConfig } from './config';
import { TBaseModuleManifest, TFormatUrlFn, TLoadSourceFn, TSourceLoaderResult, TSourceMonad } from './types';

const INTERNET_CONNECTION_LOST_MESSAGE = 'Internet Connection is lost';

const defaultLoadSourceFn: TLoadSourceFn = (url: string): Promise<string> => {
  return fetch(url)
    .then((response: Response) => {
      if (!response.ok) {
        throw new Error(`Cant load bundle, http error ${response.status}`);
      }

      return response.text();
    })
    .catch(() => {
      throw new Error(INTERNET_CONNECTION_LOST_MESSAGE);
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

  // tslint:disable-next-line:no-any
  constructor(private config: MLTConfig<any>) {}

  loadSource = (manifest: TUserManifest): Promise<TSourceLoaderResult<TUserManifest>> => {
    if (!this.formatUrlFn) {
      throw new Error('No formatUrlFn function provided in mlt.loader');
    }

    if (this.notLoadedManifests.includes(manifest.name)) {
      console.error('Retry load source, but already known that url invalid', manifest);

      return Promise.resolve({
        sourceLoadError: void 0,
        sourceMonad: {
          manifest,
          source: void 0
        }
      });
    }

    const url = this.formatUrlFn(manifest);

    return this.loadSourceFn(url)
      .catch((error: Error) => {
        console.error('Cant load source for manifest', manifest);
        console.error('Error: ', error);
        if (error.message !== INTERNET_CONNECTION_LOST_MESSAGE) {
          this.notLoadedManifests.push(manifest.name);
        }

        return error;
      })
      .then((moduleSource: string | Error) => {
        return this.config.processorsManager
          .runSourcePreprocessors({
            manifest,
            source: moduleSource instanceof Error ? void 0 : moduleSource
          })
          .then((sourceMonad: TSourceMonad<TUserManifest>) => ({
            sourceLoadError: moduleSource instanceof Error ? moduleSource : void 0,
            sourceMonad
          }));
      });
  };
}
