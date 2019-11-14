import { TBaseModuleManifest } from './types';

export function extractRawManifest<TUserManifest extends TBaseModuleManifest>(
  rootManifest: TUserManifest
): TUserManifest {
  const { modules, ...rawManifest } = rootManifest;

  return rawManifest as TUserManifest;
}

export function combineModuleAndRootManifest<TUserManifest extends TBaseModuleManifest>(
  rootManifest: TUserManifest,
  module: TUserManifest
): TUserManifest {
  const rawManifest = { ...extractRawManifest(rootManifest) };
  const rawManifestName = rawManifest.name;

  delete rawManifest.fileName;
  delete rawManifest.childs;
  delete rawManifest.loadStrategy;
  delete rawManifest.name;

  return {
    // Вот тут гон, надо исключить из rootManifest только loadStrategy и fileName
    // А вот всякую остальную блуду надо оставить - типа enabled, потому что она может распространяться на модули
    // Если не хотим, чтоб распространилась - модуль должен её оверрайдить
    ...rawManifest,
    ...module,
    name: `${rawManifestName}.${module.name}`
  };
}
