import fs = require("fs");
import SourceMap = require("source-map");

function findOriginal(consumers: SourceMap.SourceMapConsumer[], generatedLine: number, generatedColumn: number, shouldIgnoreMissingRanges: boolean): SourceMap.MappedPosition {
  let currentLine = generatedLine;
  let currentColumn = generatedColumn;
  let original: SourceMap.MappedPosition = null;

  consumers.forEach(function(consumer) {
    if (shouldIgnoreMissingRanges && currentLine === null) {
      // We found a mapping that fails to match a statement in the previous
      // item in the compilation chain. Prevent a fatal exception with this
      // check.
      // When forEach completes, findOriginal will return an object with
      // null'd fields. The caller will then exit gracefully.
      return;
    }
    original = consumer.originalPositionFor({
      line: currentLine,
      column: currentColumn
    });
    currentLine = original.line;
    currentColumn = original.column;
  });
  return original;
};

export function createMergedSourceMap(maps: any[], shouldIgnoreMissingRanges: boolean) {
  let consumers = maps.map(function(map) {
    return new SourceMap.SourceMapConsumer(map);
  }).reverse();

  let generator = new SourceMap.SourceMapGenerator({
    file: (<any> consumers[0]).file
  });

  consumers[0].eachMapping(function(mapping) {
    let original = findOriginal(consumers, mapping.generatedLine, mapping.generatedColumn, shouldIgnoreMissingRanges);
    // source-map uses nulled fields to indicate that it did not find a match.
    if (original.line === null && shouldIgnoreMissingRanges) {
      return;
    }
    // Else: SourceMapGenerator will throw a nice exception for us when we call
    // `addMapping`.

    generator.addMapping({
      generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
      },
      original: {
        line: original.line,
          column: original.column
      },
      source: original.source,
      name: original.name
    });
  });

  return generator.toString();
}

export function createMergedSourceMapFromFiles(files: string[], shouldIgnoreMissingRanges: boolean): string {
  let rawDataSets = files.map(function(map) {
    return fs.readFileSync(map);
  });
  let maps = rawDataSets.map(function(data) {
    return JSON.parse(data.toString());
  });

  return createMergedSourceMap(maps, shouldIgnoreMissingRanges);
}
