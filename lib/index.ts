import path = require('path');
import {SourceFile} from './source_file';
import _ = require('underscore');

export interface ISourceMapMergerConfig {
  inlineSources?: boolean;
  inlineSourceMap?: boolean;
  ignoreMissingSourceMaps?: boolean;
}

export interface IFile {
  src: string;
  dest: string;
}

const defaultOptions: ISourceMapMergerConfig = {
  inlineSources: false,
  inlineSourceMap: false,
  ignoreMissingSourceMaps: false
};

function mergeFile(file: IFile, config: ISourceMapMergerConfig): void {
  const sourceFile = new SourceFile(file.src);
  if (sourceFile.getMap() !== null) {
    // Merge all of the sources together.
    const map = sourceFile.getMap();
    map.merge();

    if (config.inlineSources) {
      map.inlineSources();
    }

    if (config.inlineSourceMap) {
      // Inline the source map and flush the file; no need to flush the map.
      sourceFile.inlineSourceMap();
      sourceFile.flush();
    } else {
      // Requires an update to both sourceFile and map.
      if (file.dest !== file.src) {
        // Custom source map destination.
        map.setPath(file.dest);
      }

      if (path.resolve(map.getPath()) === path.resolve(sourceFile.getPath())) {
        // Paths are equal, but inlining is not desired. Append `.map` to source map path.
        map.setPath(`${map.getPath()}.map`);
      }
      // Flush map.
      map.flush();
      // Update SourceFile mapping URL.
      sourceFile.setMappingURL(sourceFile.getPathRelativeToFile(map.getPath()));
      sourceFile.flush();
    }
  } else if (!config.ignoreMissingSourceMaps) {
      throw new Error(`File ${file.src[0]} does not have any source maps.\nIf this is not an error, set "ignoreMissingSourceMaps" to true.`);
  }
}

export function merge(files: IFile | IFile[], config: ISourceMapMergerConfig): void {
  const standardConfig = _.extend({}, defaultOptions, config);
  if (Array.isArray(files)) {
    files.forEach((file) => mergeFile(file, standardConfig));
  } else {
    mergeFile(files, standardConfig);
  }
}
