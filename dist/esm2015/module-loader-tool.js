import { CompileModuleError, LoadBundleError, NoDependencyError, PostprocessorError } from './errors';
import { ModuleLoadStrategy } from './interface';
import { ManifestProcessors } from './manifest-processors';
const InvalidHttpStatusStart = 400;
function fetchBundleSource(url) {
    return fetch(url).then((response) => {
        if (response.status >= InvalidHttpStatusStart) {
            throw new LoadBundleError(`Cant load bundle, http error ${response.status}`);
        }
        return response.text();
    });
}
function compileSource(source, dependencies) {
    // @ts-ignore
    // tslint:disable-next-line
    const require = (name) => {
        const dependency = dependencies[name];
        if (!dependency) {
            // В любом случае кинуть ошибку. Может быть конечно, что микросервис просит зависимость,
            // но не использует её и скомпилируется, однако лучше явно сообщить и по результатам:
            // а) Выпилить зависимость из микросервиса
            // б) Внести зависимость в ядро
            // в) Вкомпилировать зависимость в микросервис
            throw new NoDependencyError(`Dependency "${name}" does not provided by core application`);
        }
        return dependency;
    };
    const exports = {};
    const module = {
        exports: {}
    };
    try {
        // tslint:disable-next-line
        eval(source);
    }
    catch (ex) {
        throw new CompileModuleError(`Cant compile module: ${ex.message}`);
    }
    return module;
}
export class ModuleLoaderTool {
    constructor() {
        this.dependencies = {};
        this.manifestProcessors = new ManifestProcessors();
        this.bundlesCache = {};
        this.loadersCache = {};
    }
    get bundlesList() {
        return this._bundlesList;
    }
    startupCheck() {
        if (!this.urlFormatter) {
            throw new Error('urlFormatter is not defined');
        }
        if (!this.entrypoint) {
            throw new Error('entrypoint is not defined');
        }
    }
    loadBulkBundles(filterFn) {
        return Promise.all(this.bundlesList.filter(filterFn).map((manifest) => this.loadBundleByManifest(manifest))).then((compiledBundles) => {
            compiledBundles.forEach((compiledBundle) => {
                const controls = compiledBundle && compiledBundle.exports.controls;
                if (controls && controls.start) {
                    controls.start();
                }
            });
        });
    }
    defineDependencies(dependencies) {
        this.dependencies = dependencies;
    }
    defineUrlFormatter(formatter) {
        this.urlFormatter = formatter;
    }
    defineEntrypoint(entrypoint) {
        this.entrypoint = entrypoint;
    }
    defineManifestType(type, typeMatcher, modulePreprocessor, modulePostprocessor) {
        this.manifestProcessors.registerManifestType(type, typeMatcher, modulePreprocessor, modulePostprocessor);
    }
    isBundleLoaded(bundleName) {
        return !!this.bundlesCache[bundleName];
    }
    load(filterFn) {
        this.startupCheck();
        return fetch(this.entrypoint.manifestUrl)
            .then((response) => response.text())
            .then((bundlesText) => JSON.parse(bundlesText))
            .then(
        // tslint:disable-next-line
        (bundlesObj) => {
            const flattener = this.entrypoint.flattener;
            const loadedBundles = flattener ? flattener(bundlesObj) : bundlesObj;
            if (!filterFn) {
                this._bundlesList = loadedBundles;
                return;
            }
            this._bundlesList = loadedBundles.filter(filterFn);
        })
            .then(() => this.loadBulkBundles((manifest) => manifest.loadStrategy === ModuleLoadStrategy.BLOCK));
    }
    // tslint:disable-next-line
    start(runner) {
        // Run and load immediately services in parallel
        return Promise.resolve()
            .then(() => runner())
            .then(() => this.loadBulkBundles((manifest) => manifest.loadStrategy === ModuleLoadStrategy.IMMEDIATELY));
    }
    loadBundleByManifest(manifest) {
        if (this.bundlesCache[manifest.name]) {
            return Promise.resolve(this.bundlesCache[manifest.name]);
        }
        if (this.loadersCache[manifest.name]) {
            return this.loadersCache[manifest.name];
        }
        const serviceFileUrl = this.urlFormatter(manifest);
        this.loadersCache[manifest.name] = this.manifestProcessors
            .runPreprocessor(manifest)
            .then(() => fetchBundleSource(serviceFileUrl))
            .then((source) => compileSource(source, this.dependencies))
            .then((compiledModule) => {
            this.bundlesCache[manifest.name] = compiledModule;
            return this.manifestProcessors
                .runPostprocessor(manifest, compiledModule)
                .then(() => compiledModule)
                .catch(() => {
                throw new PostprocessorError('Postprocessor crashed');
            });
        })
            .catch((error) => {
            console.error(`Module: ${manifest.name}. Error: ${error.message}`);
            return void 0;
        });
        return this.loadersCache[manifest.name];
    }
    loadBundleByName(name) {
        const manifest = this._bundlesList.find((m) => m.name === name);
        if (!manifest) {
            throw new Error(`Module with name "${name}" is not declared`);
        }
        return this.loadBundleByManifest(manifest);
    }
}
//# sourceMappingURL=module-loader-tool.js.map