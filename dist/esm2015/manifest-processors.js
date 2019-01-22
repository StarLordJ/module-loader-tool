export class ManifestProcessors {
  constructor() {
    this.typeMatchers = {};
    this.modulePreprocessors = {};
    this.modulePostprocessors = {};
  }
  getModuleTypeByManifest(manifest) {
    for (const typeKey of Object.keys(this.typeMatchers)) {
      const typeMatcher = this.typeMatchers[typeKey];
      if (typeMatcher(manifest)) {
        return typeKey;
      }
    }
    console.warn(`Cant resolve type of service "${manifest.name}"`);
    return;
  }
  registerManifestType(type, typeMatcher, modulePreprocessor, modulePostprocessor) {
    this.typeMatchers[type] = typeMatcher;
    if (modulePreprocessor) {
      this.modulePreprocessors[type] = modulePreprocessor;
    }
    if (modulePostprocessor) {
      this.modulePostprocessors[type] = modulePostprocessor;
    }
  }
  runPreprocessor(manifest) {
    const type = this.getModuleTypeByManifest(manifest);
    if (!type) {
      return Promise.resolve();
    }
    return this.modulePreprocessors[type] ? this.modulePreprocessors[type](manifest) : Promise.resolve();
  }
  runPostprocessor(manifest, module) {
    const type = this.getModuleTypeByManifest(manifest);
    if (!type) {
      return Promise.resolve();
    }
    return this.modulePostprocessors[type] ? this.modulePostprocessors[type](manifest, module) : Promise.resolve();
  }
}
//# sourceMappingURL=manifest-processors.js.map
