import fs = require('fs');
import path = require('path');
var SourceMapMerger: {
  createMergedSourceMap(maps: SourceMap.RawSourceMap[], ignoreMissingStatements?: boolean): string;
  createMergedSourceMapFromFiles(files: string[], ignoreMissingStatements?: boolean): string;
} = require('./SourceMapMerger.js'),
    mappingUrlPrefix = "# sourceMappingURL=",
    dataURLPrefix = "data:application/json;base64,";


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

  // The source map for this SourceFile, if any. null if it does not exist.
  private _map: SourceMap = null;

  constructor(generatedFilePath: string) {
    this._path = generatedFilePath;
    this._source = fs.readFileSync(generatedFilePath).toString();

    var prefixIndex = this._source.indexOf(mappingUrlPrefix);
    if (prefixIndex === -1) {
      // No source map.
      this._urlStart = -1;
    } else {
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

  private getMapFromUrl(url: string): SourceMap {
    var mapPath: string = null, mapContents: string = null;
    if (url.slice(0, dataURLPrefix.length) === dataURLPrefix) {
      // Embedded source map.
      mapContents = new Buffer(url.slice(dataURLPrefix.length), 'base64').toString();
      mapPath = this._path;
    } else {
      // External source map.
      mapPath = path.resolve(path.dirname(this._path), url);
      mapContents = fs.readFileSync(mapPath).toString();
    }
    return new SourceMap(this, mapContents, mapPath);
  }

  public getPath(): string { return this._path; }
  public getMap(): SourceMap { return this._map; }
  public getSource(): string { return this._source; }

  public setMappingURL(url: string): void {
    this._source = `${this._source.slice(0, this._urlStart)}${url}`;
    this._map = this.getMapFromUrl(url);
  }

  public getPathRelativeToFile(aPath: string): string {
    return path.relative(path.dirname(this._path), aPath);
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
 * @param generatedFilePath The path to a generated JavaScript file that contains a sourceMappingURL.
 */
export class SourceMap {
  // The source map's corresponding file.
  private _file: SourceFile;
  // The raw JSON source map.
  private _map: SourceMap.RawSourceMap;
  // The path to the SourceMap.
  private _path: string;
  // The next file in the compilation chain.
  private _sourceFiles: SourceFile[];

  constructor(file: SourceFile, rawContents: string, mapPath: string) {
    this._file = file;
    this._map = JSON.parse(rawContents);
    this._path = mapPath;
    // Get the source files
    this._sourceFiles = this.getAbsoluteSourcePaths().map((sourcePath) => new SourceFile(sourcePath));
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
      (source) => path.resolve(this.getAbsoluteSourceRoot(), source)
    );
  }

  /**
   * Resolve a path that is relative to the source map.
   */
  public resolveRelativePath(aPath: string): string {
    return path.resolve(path.dirname(this._path), aPath);
  }

  /**
   * Retrieve an absolute path to the SourceMap's sourceRoot.
   */
  public getAbsoluteSourceRoot(): string {
    var relativeSourceRoot = this._map['sourceRoot'] ? this._map.sourceRoot : '.';
    return this.resolveRelativePath(relativeSourceRoot);
  }

  public toString(): string {
    return JSON.stringify(this._map);
  }

  public getPath() {
    return this._path;
  }

  protected getMap(): SourceMap.RawSourceMap {
    return this._map;
  }

  protected getParentMap(): SourceMap {
    if (this._sourceFiles.length > 1) {
      throw new Error(`Error: Source map for ${this._file.getPath()} has multiple source files.`);
    } else if (this._sourceFiles.length === 0) {
      return null;
    }
    return this._sourceFiles[0].getMap();
  }

  /**
   * Merges all parents into this source map.
   */
  public merge(): void {
    var nextMap = this,
      maps: SourceMap.RawSourceMap[] = [];
    while (nextMap !== null) {
      maps.push(nextMap.getMap())
      nextMap = nextMap.getParentMap();
    }
    this._map = JSON.parse(SourceMapMerger.createMergedSourceMap(maps.reverse(), true));
    // Update SourceFiles.
    this._sourceFiles = this.getAbsoluteSourcePaths().map((sourcePath) => new SourceFile(sourcePath));
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
