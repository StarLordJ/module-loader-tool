var ManifestProcessors = /** @class */ (function() {
  function ManifestProcessors() {
    this.typeMatchers = {};
    this.modulePreprocessors = {};
    this.modulePostprocessors = {};
  }
  ManifestProcessors.prototype.getModuleTypeByManifest = function(manifest) {
    for (var _i = 0, _a = Object.keys(this.typeMatchers); _i < _a.length; _i++) {
      var typeKey = _a[_i];
      var typeMatcher = this.typeMatchers[typeKey];
      if (typeMatcher(manifest)) {
        return typeKey;
      }
    }
    console.warn('Cant resolve type of service "' + manifest.name + '"');
    return;
  };
  ManifestProcessors.prototype.registerManifestType = function(
    type,
    typeMatcher,
    modulePreprocessor,
    modulePostprocessor
  ) {
    this.typeMatchers[type] = typeMatcher;
    if (modulePreprocessor) {
      this.modulePreprocessors[type] = modulePreprocessor;
    }
    if (modulePostprocessor) {
      this.modulePostprocessors[type] = modulePostprocessor;
    }
  };
  ManifestProcessors.prototype.runPreprocessor = function(manifest) {
    var type = this.getModuleTypeByManifest(manifest);
    if (!type) {
      return Promise.resolve();
    }
    return this.modulePreprocessors[type] ? this.modulePreprocessors[type](manifest) : Promise.resolve();
  };
  ManifestProcessors.prototype.runPostprocessor = function(manifest, module) {
    var type = this.getModuleTypeByManifest(manifest);
    if (!type) {
      return Promise.resolve();
    }
    return this.modulePostprocessors[type] ? this.modulePostprocessors[type](manifest, module) : Promise.resolve();
  };
  return ManifestProcessors;
})();
export { ManifestProcessors };
//# sourceMappingURL=manifest-processors.js.map
