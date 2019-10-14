import { CompiledModule, IBaseModuleManifest, ModulePostprocessor, ModulePreprocessor, TypeMatcher } from './interface';

export class ManifestProcessors<TModuleManifest extends IBaseModuleManifest> {
  private preprocessorMatchers: Array<TypeMatcher<TModuleManifest>> = [];
  private preprocessors: Map<TypeMatcher<TModuleManifest>, ModulePreprocessor<TModuleManifest>> = new Map();

  private postprocessorMatchers: Array<TypeMatcher<TModuleManifest>> = [];
  private postprocessors: Map<TypeMatcher<TModuleManifest>, ModulePostprocessor<TModuleManifest>> = new Map();

  registerPreprocessor(
    typeMatcher: TypeMatcher<TModuleManifest>,
    processor: ModulePreprocessor<TModuleManifest>
  ): void {
    this.preprocessors.set(typeMatcher, processor);
    this.preprocessorMatchers.push(typeMatcher);
  }

  registerPostprocessor(
    typeMatcher: TypeMatcher<TModuleManifest>,
    processor: ModulePostprocessor<TModuleManifest>
  ): void {
    this.postprocessors.set(typeMatcher, processor);
    this.postprocessorMatchers.push(typeMatcher);
  }

  runPreprocessors(manifest: TModuleManifest): Promise<void> {
    const selectedMatchers = this.preprocessorMatchers.filter((matcher: TypeMatcher<TModuleManifest>) =>
      matcher(manifest)
    );

    const preprocessors = selectedMatchers.map(
      // tslint:disable-next-line
      (matcher: TypeMatcher<TModuleManifest>) => this.preprocessors.get(matcher)!
    );

    return Promise.all(
      preprocessors.map((processor: ModulePreprocessor<TModuleManifest>) => {
        if (!processor) {
          return Promise.resolve();
        }

        // tslint:disable-next-line
        return new Promise<void>(
          (resolve: (result: any) => void): void => {
            resolve(processor(manifest));
          }
        );
      })
    ).then(() => {});
  }

  runPostprocessors(manifest: TModuleManifest, compiledModule: CompiledModule): Promise<void> {
    // Чесслово, я больше с типизацией провожусь, чем полезног кода напишу
    const selectedMatchers = this.postprocessorMatchers.filter((matcher: TypeMatcher<TModuleManifest>) =>
      matcher(manifest)
    );

    const postprocessors = selectedMatchers.map(
      // tslint:disable-next-line
      (matcher: TypeMatcher<TModuleManifest>) => this.postprocessors.get(matcher)!
    );

    return Promise.all(
      postprocessors.map((processor: ModulePostprocessor<TModuleManifest>) => {
        if (!processor) {
          return Promise.resolve();
        }

        // tslint:disable-next-line
        return new Promise<void>(
          (resolve: (result: any) => void): void => {
            resolve(processor(manifest, compiledModule));
          }
        );
      })
    ).then(() => {});
  }
}
