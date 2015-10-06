/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/gruntjs/gruntjs.d.ts" />
/// <reference path="../typings/source-map/source-map.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
var path = require('path');
var fs = require('fs');
var _ = require('underscore');
var SourceMapMerger = require('./lib/SourceMapMerger.js');
var defaultOptions = {
    inlineSources: false,
    inlineSourceMap: false,
    ignoreMissingSourceMaps: false
}, prefix = "# sourceMappingURL=", dataURLPrefix = "data:application/json;base64,";
/**
 * Get the associated source map for the given file, which could be a data file or
 * a source map file.
 *
 * Returns `null` if we fail to find a source map. Throws an error if the file
 * specifies an invalid source map.
 */
function getSourceMap(grunt, filePath) {
    var fileContents = fs.readFileSync(filePath).toString(), map, parentDir = path.dirname(filePath);
    // Is it a source map?
    try {
        // Will throw if invalid JSON.
        map = JSON.parse(fileContents);
        if (!map['mappings']) {
            // Will be caught below.
            throw new Error("Invalid source map.");
        }
    }
    catch (e) {
        // Not a source map! Check for a referenced source map if it's JS.
        var urlStart = fileContents.indexOf(prefix);
        if (urlStart === -1) {
            // Could not find a source map.
            return null;
        }
        var url = fileContents.slice(urlStart + prefix.length);
        // Strip any extraneous quotes.
        if (url[0] === "'" || url[0] == '"') {
            url = url.slice(1, url.length - 1);
        }
        // Is it an embedded source map, or a regular URL?
        if (url.slice(0, dataURLPrefix.length) === dataURLPrefix) {
            try {
                map = JSON.parse(new Buffer(url.slice(dataURLPrefix.length), 'base64').toString());
            }
            catch (e) {
                grunt.log.error("Failed to parse embedded source map from " + filePath + ": " + e);
            }
        }
        else {
            var mapPath = path.relative(parentDir, url);
            parentDir = path.dirname(mapPath);
            try {
                map = JSON.parse(fs.readFileSync(mapPath).toString());
            }
            catch (e) {
                grunt.log.error("Failed to parse external source map for " + filePath + " at " + mapPath + ": " + e);
            }
        }
    }
    return {
        parentDir: parentDir,
        map: map
    };
}
module.exports = function (grunt) {
    'use strict';
    grunt.registerMultiTask('merge-source-maps', 'Merges a chain of source maps into a single file.', function () {
        var self = this, config = {};
        _.extend(config, defaultOptions, self.data);
        self.files.forEach(function (file) {
            if (file.src.length > 0) {
                grunt.log.warn("Multiple source files specified for a single target: " + file.src.join(" "));
            }
            var sourceMaps = [], nextPath = file.src[0], currentSourceMap = null;
            // Follow the source map back to its... source.
            while (null !== nextPath && null !== (currentSourceMap = getSourceMap(grunt, nextPath))) {
                if (currentSourceMap.map.sections) {
                    grunt.log.error("Source map for file " + file.src[0] + " contains the unsupported \"sections\" property.");
                }
                sourceMaps.push(currentSourceMap);
                if (currentSourceMap.map['sources']) {
                    if (currentSourceMap.map.sources.length > 1) {
                        grunt.log.warn(nextPath + " has multiple source files: " + currentSourceMap.map.sources.join(" "));
                    }
                    nextPath = path.relative(currentSourceMap.parentDir, currentSourceMap.map.sources[0]);
                }
                else {
                    nextPath = null;
                }
            }
            if (sourceMaps.length > 0) {
                // Join all of the source maps together!
                var mergedSourceMap = SourceMapMerger.createMergedSourceMap(sourceMaps.map(function (item) { return item.map; }).reverse(), true);
                if (config.inlineSources) {
                    var mergedSourceMapObj = JSON.parse(mergedSourceMap), sources = mergedSourceMapObj.sources;
                    if (mergedSourceMapObj.sourceRoot) {
                        sources = sources.map(function (source) { return path.relative(mergedSourceMapObj.sourceRoot, source); });
                    }
                    mergedSourceMapObj.sourcesContent = sources.map(function (source) { return fs.readFileSync(source).toString(); });
                    mergedSourceMap = JSON.stringify(mergedSourceMapObj);
                }
                if (config.inlineSourceMap) {
                    if (!grunt.file.exists(file.dest)) {
                        grunt.log.error("\"inlineSourceMap\" specified, but destination file " + file.dest + " does not exist!");
                    }
                    fs.appendFileSync(file.dest, "\n//" + prefix + dataURLPrefix + new Buffer(mergedSourceMap, 'utf8').toString('base64'));
                }
                else {
                    grunt.file.write(file.dest, mergedSourceMap);
                }
            }
            else if (!config.ignoreMissingSourceMaps) {
                grunt.log.error("File " + file.src[0] + " does not have any source maps.\nIf this is not an error, set \"ignoreMissingSourceMaps\" to true.");
            }
        });
    });
};
