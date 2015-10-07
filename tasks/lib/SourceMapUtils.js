var fs = require('fs');
var path = require('path');
var SourceMapMerger = require('./SourceMapMerger.js'), mappingUrlPrefix = "# sourceMappingURL=", dataURLPrefix = "data:application/json;base64,";
/**
 * Represents a source file.
 */
var SourceFile = (function () {
    function SourceFile(generatedFilePath) {
        // The source map for this SourceFile, if any. null if it does not exist.
        this._map = null;
        this._path = generatedFilePath;
        this._source = fs.readFileSync(generatedFilePath).toString();
        var prefixIndex = this._source.indexOf(mappingUrlPrefix);
        if (prefixIndex === -1) {
            // No source map.
            this._urlStart = -1;
        }
        else {
            this._urlStart = prefixIndex + mappingUrlPrefix.length;
            var url = this._source.slice(this._urlStart).trim();
            switch (url[0]) {
                case '"':
                case "'":
                    url = url.slice(1, url.length - 1);
                    break;
            }
            this._map = this.getMapFromUrl(url);
        }
    }
    SourceFile.prototype.getMapFromUrl = function (url) {
        var mapPath = null, mapContents = null;
        if (url.slice(0, dataURLPrefix.length) === dataURLPrefix) {
            // Embedded source map.
            mapContents = new Buffer(url.slice(dataURLPrefix.length), 'base64').toString();
            mapPath = this._path;
        }
        else {
            // External source map.
            mapPath = path.resolve(path.dirname(this._path), url);
            mapContents = fs.readFileSync(mapPath).toString();
        }
        return new SourceMap(this, mapContents, mapPath);
    };
    SourceFile.prototype.getPath = function () { return this._path; };
    SourceFile.prototype.getMap = function () { return this._map; };
    SourceFile.prototype.getSource = function () { return this._source; };
    SourceFile.prototype.setMappingURL = function (url) {
        this._source = "" + this._source.slice(0, this._urlStart) + url;
        this._map = this.getMapFromUrl(url);
    };
    SourceFile.prototype.getPathRelativeToFile = function (aPath) {
        return path.relative(path.dirname(this._path), aPath);
    };
    /**
     * Flush changes to disk.
     */
    SourceFile.prototype.flush = function () {
        fs.writeFileSync(this._path, this._source);
    };
    SourceFile.prototype.inlineSourceMap = function () {
        this.setMappingURL("" + dataURLPrefix + new Buffer(this._map.toString(), 'utf8').toString('base64'));
    };
    return SourceFile;
})();
exports.SourceFile = SourceFile;
/**
 * Represents a SourceMap.
 * @param generatedFilePath The path to a generated JavaScript file that contains a sourceMappingURL.
 */
var SourceMap = (function () {
    function SourceMap(file, rawContents, mapPath) {
        this._file = file;
        this._map = JSON.parse(rawContents);
        this._path = mapPath;
        // Get the source files
        this._sourceFiles = this.getAbsoluteSourcePaths().map(function (sourcePath) { return new SourceFile(sourcePath); });
    }
    SourceMap.prototype.getFile = function () {
        return this._file;
    };
    SourceMap.prototype.getSourceFiles = function () {
        return this._sourceFiles.slice(0);
    };
    /**
     * Retrieve an absolute path to the sources for this SourceMap.
     */
    SourceMap.prototype.getAbsoluteSourcePaths = function () {
        var _this = this;
        return this._map.sources.map(function (source) { return path.resolve(_this.getAbsoluteSourceRoot(), source); });
    };
    /**
     * Resolve a path that is relative to the source map.
     */
    SourceMap.prototype.resolveRelativePath = function (aPath) {
        return path.resolve(path.dirname(this._path), aPath);
    };
    /**
     * Retrieve an absolute path to the SourceMap's sourceRoot.
     */
    SourceMap.prototype.getAbsoluteSourceRoot = function () {
        var relativeSourceRoot = this._map['sourceRoot'] ? this._map.sourceRoot : '.';
        return this.resolveRelativePath(relativeSourceRoot);
    };
    SourceMap.prototype.toString = function () {
        return JSON.stringify(this._map);
    };
    SourceMap.prototype.getPath = function () {
        return this._path;
    };
    SourceMap.prototype.getMap = function () {
        return this._map;
    };
    SourceMap.prototype.getParentMap = function () {
        if (this._sourceFiles.length > 1) {
            throw new Error("Error: Source map for " + this._file.getPath() + " has multiple source files.");
        }
        else if (this._sourceFiles.length === 0) {
            return null;
        }
        return this._sourceFiles[0].getMap();
    };
    /**
     * Merges all parents into this source map.
     */
    SourceMap.prototype.merge = function () {
        var nextMap = this, maps = [];
        while (nextMap !== null) {
            maps.push(nextMap.getMap());
            nextMap = nextMap.getParentMap();
        }
        this._map = JSON.parse(SourceMapMerger.createMergedSourceMap(maps.reverse(), true));
        // Update SourceFiles.
        this._sourceFiles = this.getAbsoluteSourcePaths().map(function (sourcePath) { return new SourceFile(sourcePath); });
    };
    SourceMap.prototype.inlineSources = function () {
        this._map.sourcesContent = this._sourceFiles.map(function (file) { return file.getSource(); });
    };
    SourceMap.prototype.setPath = function (newPath) {
        this._path = newPath;
    };
    SourceMap.prototype.flush = function () {
        if (this._path === this._file.getPath()) {
            // Inline source file.
            this._file.inlineSourceMap();
            this._file.flush();
        }
        else {
            fs.writeFileSync(this._path, this.toString());
        }
    };
    return SourceMap;
})();
exports.SourceMap = SourceMap;
