#! /usr/bin/env node
import yargs = require('yargs/yargs')(process.argv.slice(2));
import mergeSourceMaps = require('../lib/index');
import ISourceMapMergerConfig = mergeSourceMaps.ISourceMapMergerConfig;

const parser = yargs.usage('$0 [JavaScript files with source maps]')
     .boolean('inline-sources')
     .describe('inline-sources', 'Inline original source code into each source map')
     .default('inline-sources', false)
     .boolean('inline-source-map')
     .describe('inline-source-map', 'Inline the source map into the JavaScript file')
     .default('inline-source-map', false)
     .boolean('ignore-missing-source-maps')
     .describe('ignore-missing-source-maps', 'Ignore input files that are missing source maps')
     .default('ignore-missing-source-maps', false)
     .help('help');

const args = parser.argv;

const opts: ISourceMapMergerConfig = {
  inlineSources: args['inline-sources'],
  inlineSourceMap: args['inline-source-map'],
  ignoreMissingSourceMaps: args['ignore-missing-source-maps']
};

if (args._.length > 0) {
  mergeSourceMaps.merge(args._.map((f: string) => { return { src: f, dest: f } }), opts);
} else {
  parser.showHelp();
}
