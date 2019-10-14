export type TModuleLoader = (url: string) => Promise<string>;

export const defaultModuleLoader: TModuleLoader = (url: string): Promise<string> => {
  return fetch(url).then((response: Response) => {
    if (!response.ok) {
      throw new Error(`Cant load bundle, http error ${response.status}`);
    }

    return response.text();
  });
};
