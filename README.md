# grunt-merge-source-maps v0.1.0
> Grunt task for merging multiple source maps from compilation phases into a single source map.

If you have a multi-step compilation pipeline, you likely have a separate source map for each step
of compilation (e.g. TypeScript => JavaScript => Minified JavaScript). Combining these source maps
is headache inducing, and there are currently no grunt tasks to do this for you... until now!

(Note: The general template and boilerplate text in this README were copies from [the README for `grunt-contrib-copy`](https://github.com/gruntjs/grunt-contrib-copy/blob/master/README.md)).

## Getting Started

Install the plugin with this command:

```
npm install grunt-merge-source-maps --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```
grunt.loadNpmTasks('grunt-merge-source-maps');
```

## `merge-source-maps` task

*Run this task with `grunt merge-source-maps`.*

Task targets, files and options may be specified according to the grunt [Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

### Source Files

The source files for this task can be any combination of the following:

* JavaScript source referring to an external source map.
* JavaScript source with an embedded source map.
* A source map.

Regardless of which type, each source file must be from the *final* step in the compilation process.
`grunt-merge-source-maps` will follow the chain of source maps to the beginning.

For example, let's say that you compiled `foo.ts` to `foo.js`, and minified it to `foo.min.js`.
If you want to combine `foo.js.map` and `foo.min.js.map`, you should specify either `foo.min.js.map` or `foo.min.js`.

### Destination File

The corresponding destination file *must* be the source map file name that you desire.
However, if you specified `inlineSourceMap`, then the destination *must* be the JavaScript file that you wish to inline the source map into.

### Options

#### inlineSources

Type: `Boolean`

Default: `false`

If `true`, inlines the source code (from the first compilation step, e.g. TypeScript code) into the source map.

#### inlineSourceMap

Type: `Boolean`

Default: `false`

If `true`, inlines the source map into the generated JavaScript. The `dest` file for each `src` file *must* be the path to the generated JavaScript.

#### ignoreMissingSourceMaps

Type: `Boolean`

Default: `false`

If `true`, ignores input files that are missing source maps. Otherwise, `grunt-merge-source-maps` will treat this event as a fatal error.

### Usage Examples

TODO.