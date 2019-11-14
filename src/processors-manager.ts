import {
  TBaseModuleManifest,
  TCompiledMonad,
  TModulePostprocessor, TModulePreprocessor,
  TSourceMonad,
  TSourcePreprocessor,
  TTypeMatcher,
  TTypeMatcherWithSource
} from './types';

type TProcessorStorageItem<TUserManifest extends TBaseModuleManifest, Processor> = {
  matcher: TTypeMatcher<TUserManifest>;
  fn: Processor;
};

type TSourceProcessorStorageItem<TUserManifest extends TBaseModuleManifest> = {
  matcher: TTypeMatcherWithSource<TUserManifest>;
  fn: TSourcePreprocessor<TUserManifest>
};

export class MLTProcessorsManager<TUserManifest extends TBaseModuleManifest> {
  private preprocessors: Array<TProcessorStorageItem<TUserManifest, TModulePreprocessor<TUserManifest>>> = [];
  private sourcePreprocessors: Array<TSourceProcessorStorageItem<TUserManifest>> = [];
  private postprocessors: Array<TProcessorStorageItem<TUserManifest, TModulePostprocessor<TUserManifest>>> = [];

  registerPreprocessor = (
    typeMatcher: TTypeMatcher<TUserManifest>,
    processor: TModulePreprocessor<TUserManifest>
  ): void => {
    this.preprocessors.push({ matcher: typeMatcher, fn: processor });
  };

  registerSourcePreprocessor = (
    typeMatcher: TTypeMatcherWithSource<TUserManifest>,
    processor: TSourcePreprocessor<TUserManifest>
  ): void => {
    this.sourcePreprocessors.push({ matcher: typeMatcher, fn: processor });
  };

  registerPostprocessor = (
    typeMatcher: TTypeMatcher<TUserManifest>,
    processor: TModulePostprocessor<TUserManifest>
  ): void => {
    this.postprocessors.push({ matcher: typeMatcher, fn: processor });
  };

  runPreprocessors(manifest: TUserManifest): Promise<void> {
    type TPreprocessorItem = TProcessorStorageItem<TUserManifest, TModulePreprocessor<TUserManifest>>;
    const selectedProcessors = this.preprocessors.filter(
      (storedItem: TPreprocessorItem) =>
        storedItem.matcher(manifest)
    );

    return Promise.all(
      selectedProcessors.map(
        (storedItem: TPreprocessorItem) => storedItem.fn
      ).map((processor: TModulePreprocessor<TUserManifest>) => {
        const processorResult = processor(manifest);
        const processorPromise = processorResult && processorResult.then
                                 ? processorResult
                                 : Promise.resolve(processorResult);

        processorPromise.catch(() => {}).then(() => {});

        return processorPromise;
      })
    ).then(() => {});
  }

  runSourcePreprocessors(sourceMonad: TSourceMonad<TUserManifest>): Promise<TSourceMonad<TUserManifest>> {
    type TSource = TSourceMonad<TUserManifest>;
    type TSourcePreprocessorItem = TSourceProcessorStorageItem<TUserManifest>;

    const { manifest, source } = sourceMonad;

    const selectedPreprocessors = this.sourcePreprocessors.filter(
      (sourcePreprocessor: TSourcePreprocessorItem) => sourcePreprocessor.matcher(sourceMonad)
    );

    const runPreprocessor = (
      processor: TSourcePreprocessor<TUserManifest>,
      monad: TSource
    ): Promise<TSource> => {
      return processor(monad);
    };

    return selectedPreprocessors.reduce(
      (sourcePromise: Promise<TSource>, nextPreprocessor: TSourcePreprocessorItem) => {
        return sourcePromise.then((processedSource: TSource) => runPreprocessor(nextPreprocessor.fn, processedSource));
      },
      Promise.resolve(sourceMonad)
    );
  }

  runPostprocessors(compiledMonad: TCompiledMonad<TUserManifest>): Promise<void> {
    const { manifest, module } = compiledMonad;

    if (!module) {
      console.warn(`Cant run postprocessor for module "${manifest.name}", no compilation result`);

      return Promise.resolve();
    }

    type TPostprocessorItem = TProcessorStorageItem<TUserManifest, TModulePostprocessor<TUserManifest>>;
    const selectedProcessors = this.postprocessors.filter(
      (storedItem: TPostprocessorItem) =>
        storedItem.matcher(manifest)
    );

    return Promise.all(
      selectedProcessors.map(
        (storedItem: TPostprocessorItem) => storedItem.fn
      ).map((processor: TModulePostprocessor<TUserManifest>) => {
        const processorResult = processor(compiledMonad);
        const processorPromise = processorResult && processorResult.then
                                 ? processorResult
                                 : Promise.resolve(processorResult);
        processorPromise.catch(() => {}).then(() => {});

        return processorResult;
      })
    ).then(() => {});
  }
}
