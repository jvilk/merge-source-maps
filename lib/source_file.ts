import fs = require('fs');
import path = require('path');
import SourceMapModule = require("source-map");
import {ISourceMapMergerConfig} from './index';
const mappingUrlPrefix = "# sourceMappingURL=";
const dataURLPrefix = "data:application/json;base64,";
const fileProtocolPrefix = "file:/";

/**
 * Represents a source file.
 */
export class SourceFile {
  // The path to the file.
  private _path: string;
  // The contents of the file.
  private _source: string;
  // The index at which the mapping URL starts. -1 if the file lacks a source map.
  private _urlStart: number;
  // The closing comment tag for the source map URL comment, if any (used for CSS).
  private _urlSuffix = '';

  // The source map for this SourceFile, if any. null if it does not exist.
  private _map: SourceMap = null;

  constructor(generatedFilePath: string, config: ISourceMapMergerConfig) {
    this._path = generatedFilePath;
    const readFile = !config.ignoreMissingSources || fs.existsSync(generatedFilePath);
    this._source = readFile ? fs.readFileSync(generatedFilePath).toString() : '';

    let prefixIndex = this._source.lastIndexOf(mappingUrlPrefix);
    if (prefixIndex === -1) {
      // No source map.
      this._urlStart = -1;
    } else {
      this._urlStart = prefixIndex + mappingUrlPrefix.length;

      let url = this._source.slice(this._urlStart).trim();
      if (url.slice(-3) === ' */') {
          url = url.slice(0, -2).trim();
          this._urlSuffix = ' */';
      }

      switch (url[0]) {
        case '"':
        case "'":
          url = url.slice(1, url.length - 1);
          break;
      }
      this._map = this.getMapFromUrl(url);
    }
  }

  private getMapFromUrl(url: string): SourceMap {
    let mapPath: string = null, mapContents: string = null;
    if (url.slice(0, dataURLPrefix.length) === dataURLPrefix) {
      // Embedded source map.
      mapContents = new Buffer(url.slice(dataURLPrefix.length), 'base64').toString();
      mapPath = this._path;
    } else {
      // External source map.
      mapPath = path.resolve(path.dirname(this._path), url);
      mapContents = fs.readFileSync(mapPath).toString();
    }
    return new SourceMap(this, JSON.parse(mapContents), mapPath);
  }

  public getPath(): string { return this._path; }
  public getMap(): SourceMap { return this._map; }
  public getSource(): string { return this._source; }

  public setMappingURL(url: string): void {
    this._source = `${this._source.slice(0, this._urlStart)}${url}${this._urlSuffix}`;
    this._map = this.getMapFromUrl(url);
  }

  public getPathRelativeToFile(aPath: string): string {
    return path.relative(path.dirname(this._path), aPath);
  }

  public findOriginal(line: number, col: number, shouldIgnoreMissingRanges: boolean): SourceMapModule.MappedPosition {
    if (this._map) {
      return this._map.findOriginal(line, col, shouldIgnoreMissingRanges);
    } else {
      return {
        line: line,
        column: col,
        source: this._path
      };
    }
  }

  /**
   * Flush changes to disk.
   */
  public flush(): void {
    fs.writeFileSync(this._path, this._source);
  }

  public inlineSourceMap() {
    this.setMappingURL(`${dataURLPrefix}${new Buffer(this._map.toString(), 'utf8').toString('base64')}`);
  }
}


/**
 * Represents a SourceMap.
 */
export class SourceMap {
  // The source map's corresponding file.
  private _file: SourceFile;
  // The raw JSON source map.
  private _map: SourceMapModule.RawSourceMap;
  // The path to the SourceMap.
  private _path: string;
  private _sourceFiles: SourceFile[];
  private _sourceFileMap: {[p: string]: SourceFile};
  private _consumer: SourceMapModule.SourceMapConsumer;

  constructor(file: SourceFile, map: SourceMapModule.RawSourceMap, mapPath: string) {
    this._file = file;
    this._path = mapPath;
    this._updateMap(map);
  }

  private _updateMap(map: SourceMapModule.RawSourceMap): void {
    this._map = map;
    this._consumer = new SourceMapModule.SourceMapConsumer(map);
    this._sourceFileMap = {};
    this._sourceFiles = this.getAbsoluteSourcePaths().map((sourcePath) => {
      const m = new SourceFile(sourcePath);
      // Map relative path to sourcefile.
      this._sourceFileMap[sourcePath] = m;
      return m;
    });
  }

  /**
   * The reference Sass implementation, dart-sass, outputs file:// absolute
   * URLs in its source maps in many cases. This method makes those into
   * relative URLs like we expect everywhere else. For discussion, see
   * https://github.com/sindresorhus/grunt-sass/issues/299#issuecomment-688802356
   */
  public fixSassSources(sourcePath: string): string {
    const fileProtocolStart = sourcePath.indexOf(fileProtocolPrefix);
    if (fileProtocolStart !== -1) {
      sourcePath = sourcePath
        .slice(fileProtocolStart + fileProtocolPrefix.length)
        .replace(path.dirname(this._path), '')
        .replace(/^\/*/, sourcePath[0] === '/' ? '/' : '');
    }
    return sourcePath;
  }

  public getFile(): SourceFile {
    return this._file;
  }

  public getSourceFiles(): SourceFile[] {
    return this._sourceFiles.slice(0);
  }

  /**
   * Retrieve an absolute path to the sources for this SourceMap.
   */
  public getAbsoluteSourcePaths(): string[] {
    return this._map.sources.map(
      (source) => path.resolve(this.getAbsoluteSourceRoot(), this.fixSassSources(source))
    );
  }

  /**
   * Resolve a path that is relative to the source map.
   */
  public resolveRelativePath(aPath: string): string {
    return path.resolve(path.dirname(this._path), aPath);
  }

  public getRelativePath(p: string): string {
    return path.relative(path.dirname(this._path), this.fixSassSources(p));
  }

  /**
   * Retrieve an absolute path to the SourceMap's sourceRoot.
   */
  public getAbsoluteSourceRoot(): string {
    let relativeSourceRoot = this._map['sourceRoot'] ? this._map.sourceRoot : '.';
    return this.resolveRelativePath(relativeSourceRoot);
  }

  public toString(): string {
    return JSON.stringify(this._map);
  }

  public getPath() {
    return this._path;
  }

  protected getMap(): SourceMapModule.RawSourceMap {
    return this._map;
  }

  protected getParentMaps(): SourceMap[] {
    if (this._sourceFiles.length === 0) {
      return null;
    }
    return this._sourceFiles.map((f) => f.getMap());
  }

  public findOriginal(line: number, col: number, shouldIgnoreMissingRanges: boolean): SourceMapModule.MappedPosition {
    const pos = this._consumer.originalPositionFor({ line: line, column: col });
    if (!pos || pos.line === null || pos.line === undefined) {
      if (shouldIgnoreMissingRanges) {
        return pos;
      } else {
        throw new Error(`Could not find original location of ${this._file.getPath()}:${line}:${col}`);
      }
    }
    // Normalize source file.
    pos.source = this.resolveRelativePath(pos.source);
    if (this._sourceFiles.length > 0) {
      const sf = this._sourceFileMap[pos.source];
      if (!sf) {
        if (shouldIgnoreMissingRanges) {
          return pos;
        } else {
          throw new Error(`Could not find original location of ${this._file.getPath()}:${line}:${col}`);
        }
      } else {
        return sf.findOriginal(pos.line, pos.column, shouldIgnoreMissingRanges);
      }
    } else {
      return pos;
    }
  }

  /**
   * Merges all parents into a new source map.
   */
  public merge(shouldIgnoreMissingRanges: boolean = true): void {
    let generator = new SourceMapModule.SourceMapGenerator({
      file: this._path
    });

    this._consumer.eachMapping((mapping) => {
      const original = this.findOriginal(mapping.generatedLine, mapping.generatedColumn, shouldIgnoreMissingRanges);
      // source-map uses nulled fields to indicate that it did not find a match.
      if (original.line === null && shouldIgnoreMissingRanges) {
        return;
      }

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

    const newMap = generator.toJSON();
    newMap.sources = newMap.sources.map((s) => this.getRelativePath(s));
    this._updateMap(newMap);
  }

  public inlineSources(): void {
    this._map.sourcesContent = this._sourceFiles.map((file) => file.getSource());
  }

  public setPath(newPath: string) {
    this._path = newPath;
  }

  public flush(): void {
    if (this._path === this._file.getPath()) {
      // Inline source file.
      this._file.inlineSourceMap();
      this._file.flush();
    } else {
      fs.writeFileSync(this._path, this.toString());
    }
  }
}
