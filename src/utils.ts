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
  return {
    ...module,
    enabled: rootManifest.enabled,
    name: `${rootManifest.name}.${module.name}`
  };
}
