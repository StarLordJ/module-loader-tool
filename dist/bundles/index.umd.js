(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('tslib')) :
    typeof define === 'function' && define.amd ? define(['exports', 'tslib'], factory) :
    (global = global || self, factory(global.ModuleLoaderTool = {}, global.tslib_1));
}(this, function (exports, tslib_1) { 'use strict';

    (function (ModuleLoadStrategy) {
        ModuleLoadStrategy["BLOCK"] = "block";
        ModuleLoadStrategy["IMMEDIATELY"] = "immediately";
        ModuleLoadStrategy["ON_DEMAND"] = "on_demand";
        ModuleLoadStrategy["LAZY"] = "lazy";
    })(exports.ModuleLoadStrategy || (exports.ModuleLoadStrategy = {}));

    var NoDependencyError = /** @class */ (function (_super) {
        tslib_1.__extends(NoDependencyError, _super);
        function NoDependencyError() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return NoDependencyError;
    }(Error));
    // tslint:disable-next-line
    var CompileModuleError = /** @class */ (function (_super) {
        tslib_1.__extends(CompileModuleError, _super);
        function CompileModuleError() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return CompileModuleError;
    }(Error));
    // tslint:disable-next-line
    var CreationModuleError = /** @class */ (function (_super) {
        tslib_1.__extends(CreationModuleError, _super);
        function CreationModuleError() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return CreationModuleError;
    }(Error));
    // tslint:disable-next-line
    var LoadBundleError = /** @class */ (function (_super) {
        tslib_1.__extends(LoadBundleError, _super);
        function LoadBundleError() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return LoadBundleError;
    }(Error));
    // tslint:disable-next-line
    var PostprocessorError = /** @class */ (function (_super) {
        tslib_1.__extends(PostprocessorError, _super);
        function PostprocessorError() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return PostprocessorError;
    }(Error));

    var ManifestProcessors = /** @class */ (function () {
        function ManifestProcessors() {
            this.typeMatchers = {};
            this.modulePreprocessors = {};
            this.modulePostprocessors = {};
        }
        ManifestProcessors.prototype.getModuleTypeByManifest = function (manifest) {
            for (var _i = 0, _a = Object.keys(this.typeMatchers); _i < _a.length; _i++) {
                var typeKey = _a[_i];
                var typeMatcher = this.typeMatchers[typeKey];
                if (typeMatcher(manifest)) {
                    return typeKey;
                }
            }
            console.warn("Cant resolve type of service \"" + manifest.name + "\"");
            return;
        };
        ManifestProcessors.prototype.registerManifestType = function (type, typeMatcher, modulePreprocessor, modulePostprocessor) {
            this.typeMatchers[type] = typeMatcher;
            if (modulePreprocessor) {
                this.modulePreprocessors[type] = modulePreprocessor;
            }
            if (modulePostprocessor) {
                this.modulePostprocessors[type] = modulePostprocessor;
            }
        };
        ManifestProcessors.prototype.runPreprocessor = function (manifest) {
            var type = this.getModuleTypeByManifest(manifest);
            if (!type) {
                return Promise.resolve();
            }
            return this.modulePreprocessors[type] ? this.modulePreprocessors[type](manifest) : Promise.resolve();
        };
        ManifestProcessors.prototype.runPostprocessor = function (manifest, module) {
            var type = this.getModuleTypeByManifest(manifest);
            if (!type) {
                return Promise.resolve();
            }
            return this.modulePostprocessors[type] ? this.modulePostprocessors[type](manifest, module) : Promise.resolve();
        };
        return ManifestProcessors;
    }());

    var InvalidHttpStatusStart = 400;
    function fetchBundleSource(url) {
        return fetch(url).then(function (response) {
            if (response.status >= InvalidHttpStatusStart) {
                throw new LoadBundleError("Cant load bundle, http error " + response.status);
            }
            return response.text();
        });
    }
    function compileSource(source, dependencies) {
        var module = {
            exports: {}
        };
        try {
            // tslint:disable-next-line
            eval(source);
        }
        catch (ex) {
            throw new CompileModuleError("Cant compile module: " + ex.message);
        }
        return module;
    }
    var ModuleLoaderTool = /** @class */ (function () {
        function ModuleLoaderTool() {
            this.dependencies = {};
            this.manifestProcessors = new ManifestProcessors();
            this.bundlesCache = {};
            this.loadersCache = {};
        }
        Object.defineProperty(ModuleLoaderTool.prototype, "bundlesList", {
            get: function () {
                return this._bundlesList;
            },
            enumerable: true,
            configurable: true
        });
        ModuleLoaderTool.prototype.startupCheck = function () {
            if (!this.urlFormatter) {
                throw new Error('urlFormatter is not defined');
            }
            if (!this.entrypoint) {
                throw new Error('entrypoint is not defined');
            }
        };
        ModuleLoaderTool.prototype.loadBulkBundles = function (filterFn) {
            var _this = this;
            return Promise.all(this.bundlesList.filter(filterFn).map(function (manifest) { return _this.loadBundleByManifest(manifest); })).then(function (compiledBundles) {
                compiledBundles.forEach(function (compiledBundle) {
                    var controls = compiledBundle && compiledBundle.exports.controls;
                    if (controls && controls.start) {
                        controls.start();
                    }
                });
            });
        };
        ModuleLoaderTool.prototype.defineDependencies = function (dependencies) {
            this.dependencies = dependencies;
        };
        ModuleLoaderTool.prototype.defineUrlFormatter = function (formatter) {
            this.urlFormatter = formatter;
        };
        ModuleLoaderTool.prototype.defineEntrypoint = function (entrypoint) {
            this.entrypoint = entrypoint;
        };
        ModuleLoaderTool.prototype.defineManifestType = function (type, typeMatcher, modulePreprocessor, modulePostprocessor) {
            this.manifestProcessors.registerManifestType(type, typeMatcher, modulePreprocessor, modulePostprocessor);
        };
        ModuleLoaderTool.prototype.isBundleLoaded = function (bundleName) {
            return !!this.bundlesCache[bundleName];
        };
        ModuleLoaderTool.prototype.load = function (filterFn) {
            var _this = this;
            this.startupCheck();
            return fetch(this.entrypoint.manifestUrl)
                .then(function (response) { return response.text(); })
                .then(function (bundlesText) { return JSON.parse(bundlesText); })
                .then(
            // tslint:disable-next-line
            function (bundlesObj) {
                var flattener = _this.entrypoint.flattener;
                var loadedBundles = flattener ? flattener(bundlesObj) : bundlesObj;
                if (!filterFn) {
                    _this._bundlesList = loadedBundles;
                    return;
                }
                _this._bundlesList = loadedBundles.filter(filterFn);
            })
                .then(function () {
                return _this.loadBulkBundles(function (manifest) { return manifest.loadStrategy === exports.ModuleLoadStrategy.BLOCK; });
            });
        };
        // tslint:disable-next-line
        ModuleLoaderTool.prototype.start = function (runner) {
            var _this = this;
            // Run and load immediately services in parallel
            return Promise.resolve()
                .then(function () { return runner(); })
                .then(function () {
                return _this.loadBulkBundles(function (manifest) { return manifest.loadStrategy === exports.ModuleLoadStrategy.IMMEDIATELY; });
            });
        };
        ModuleLoaderTool.prototype.loadBundleByManifest = function (manifest) {
            var _this = this;
            if (this.bundlesCache[manifest.name]) {
                return Promise.resolve(this.bundlesCache[manifest.name]);
            }
            if (this.loadersCache[manifest.name]) {
                return this.loadersCache[manifest.name];
            }
            var serviceFileUrl = this.urlFormatter(manifest);
            this.loadersCache[manifest.name] = this.manifestProcessors
                .runPreprocessor(manifest)
                .then(function () { return fetchBundleSource(serviceFileUrl); })
                .then(function (source) { return compileSource(source, _this.dependencies); })
                .then(function (compiledModule) {
                _this.bundlesCache[manifest.name] = compiledModule;
                return _this.manifestProcessors
                    .runPostprocessor(manifest, compiledModule)
                    .then(function () { return compiledModule; })
                    .catch(function () {
                    throw new PostprocessorError('Postprocessor crashed');
                });
            })
                .catch(function (error) {
                console.error("Module: " + manifest.name + ". Error: " + error.message);
                return void 0;
            });
            return this.loadersCache[manifest.name];
        };
        ModuleLoaderTool.prototype.loadBundleByName = function (name) {
            var manifest = this._bundlesList.find(function (m) { return m.name === name; });
            if (!manifest) {
                throw new Error("Module with name \"" + name + "\" is not declared");
            }
            return this.loadBundleByManifest(manifest);
        };
        return ModuleLoaderTool;
    }());

    exports.ModuleLoaderTool = ModuleLoaderTool;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=index.umd.js.map
