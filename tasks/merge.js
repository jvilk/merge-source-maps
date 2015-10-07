var path = require('path');
var _ = require('underscore');
var SourceMapUtils = require('./lib/SourceMapUtils');
var defaultOptions = {
    inlineSources: false,
    inlineSourceMap: false,
    ignoreMissingSourceMaps: false
}, prefix = "# sourceMappingURL=", dataURLPrefix = "data:application/json;base64,";
module.exports = function (grunt) {
    'use strict';
    grunt.registerMultiTask('merge-source-maps', 'Merges a chain of source maps into a single file.', function () {
        var self = this, config = {};
        _.extend(config, defaultOptions, self.options());
        self.files.forEach(function (file) {
            // Sanity checks.
            if (file.src.length > 1) {
                grunt.log.error("Multiple source files specified for a single target: " + file.src.join(" "));
            }
            else if (file.src.length === 0) {
                grunt.log.error("No source files specified.");
            }
            var sourceFile = new SourceMapUtils.SourceFile(file.src[0]);
            if (sourceFile.getMap() !== null) {
                var map = sourceFile.getMap();
                // Merge all of the sources together.
                map.merge();
                if (config.inlineSources) {
                    map.inlineSources();
                }
                if (config.inlineSourceMap) {
                    // Inline the source map and flush the file; no need to flush the map.
                    sourceFile.inlineSourceMap();
                    sourceFile.flush();
                }
                else {
                    // Requires an update to both sourceFile and map.
                    if (file.dest !== file.src[0]) {
                        // Custom source map destination.
                        map.setPath(file.dest);
                    }
                    if (path.resolve(map.getPath()) === path.resolve(sourceFile.getPath())) {
                        // Paths are equal, but inlining is not desired. Append `.map` to source map path.
                        map.setPath(map.getPath() + ".map");
                    }
                    // Flush map.
                    map.flush();
                    // Update SourceFile mapping URL.
                    sourceFile.setMappingURL(sourceFile.getPathRelativeToFile(map.getPath()));
                    sourceFile.flush();
                }
            }
            else if (!config.ignoreMissingSourceMaps) {
                grunt.log.error("File " + file.src[0] + " does not have any source maps.\nIf this is not an error, set \"ignoreMissingSourceMaps\" to true.");
            }
        });
    });
};
