import { CompileModuleError, LoadBundleError, NoDependencyError, PostprocessorError } from './errors';
import { ModuleLoadStrategy } from './interface';
import { ManifestProcessors } from './manifest-processors';
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
    // @ts-ignore
    // tslint:disable-next-line
    var require = function (name) {
        var dependency = dependencies[name];
        if (!dependency) {
            // В любом случае кинуть ошибку. Может быть конечно, что микросервис просит зависимость,
            // но не использует её и скомпилируется, однако лучше явно сообщить и по результатам:
            // а) Выпилить зависимость из микросервиса
            // б) Внести зависимость в ядро
            // в) Вкомпилировать зависимость в микросервис
            throw new NoDependencyError("Dependency \"" + name + "\" does not provided by core application");
        }
        return dependency;
    };
    var exports = {};
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
            return _this.loadBulkBundles(function (manifest) { return manifest.loadStrategy === ModuleLoadStrategy.BLOCK; });
        });
    };
    // tslint:disable-next-line
    ModuleLoaderTool.prototype.start = function (runner) {
        var _this = this;
        // Run and load immediately services in parallel
        return Promise.resolve()
            .then(function () { return runner(); })
            .then(function () {
            return _this.loadBulkBundles(function (manifest) { return manifest.loadStrategy === ModuleLoadStrategy.IMMEDIATELY; });
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
export { ModuleLoaderTool };
//# sourceMappingURL=module-loader-tool.js.map