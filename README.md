# grunt-merge-source-maps v0.1.0
> Grunt task for merging multiple source maps from compilation phases into a single source map.

If you have a multi-step compilation pipeline, you likely have a separate source map for each step
of compilation (e.g. TypeScript => JavaScript => Minified JavaScript). Combining these source maps
is headache inducing, and there are currently no grunt tasks to do this for you... until now!

(Note: The general template and boilerplate text in this README were copied from [the README for `grunt-contrib-copy`](https://github.com/gruntjs/grunt-contrib-copy/blob/master/README.md)).

## Getting Started

Install the plugin with this command:

    npm install grunt-merge-source-maps --save-dev

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

    grunt.loadNpmTasks('grunt-merge-source-maps');

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

If you do not specify a destination, `merge-source-maps` will default to `[source file].map` or `[source file]`, depending on your configuration.

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

Below, we illustrate various useful configurations.

#### Inlined source maps and sources

With this setup, the source map *and* the source code of your project will be embedded directly into the generated JavaScript file.
Thus, the JavaScript file alone is all that is needed to debug your program with source maps, provided the debugger supports
embedded source maps.
Perfect for scenarios where bandwidth is not an issue, such as Node projects or debug builds.

```js
"merge-source-maps": {
    foo: {
        options: {
            inlineSourceMap: true,
            inlineSources: true
        },
        files: [{
            // src and dest are the same; merge-source-maps appends source map info to target file
            src: 'build/<%= basename %>.js',
            dest: 'build/<%= basename %>.js'
        }]
    }
}
```

### External source maps with inlined sources

With this setup, the generated JavaScript file will have a corresponding `.map` file that also contains the source code to the program.
The debugger will only need the JavaScript file and the map file to debug the code with source maps.
Perfect for production web projects, where you want small, minified JavaScript files but also want to be able to debug the original source code.

```js
"merge-source-maps": {
    foo: {
        options: {
            inlineSources: true
        },
        files: [{
            src: 'build/<%= basename %>.js',
            dest: 'build/<%= basename %>.js.map'
        }]
    }
}
```

### External source maps with external sources

With this setup, the generated JavaScript file will have a corresponding `.map` file that references external source code files.
The debugger will need to fetch the JavaScript file, the `.map` file, and each external source code file before you can debug
the code with source maps.
Ideal if you are already planning on hosting the original source files for some reason, as it minimizes redundant information
embedded within the source map.
Also ideal if your debugger does not support embedded source code in source maps.

```js
"merge-source-maps": {
    foo: {
        files: [{
            src: 'build/<%= basename %>.js',
            dest: 'build/<%= basename %>.js.map'
        }]
    }
}
```

## Caveats and Limitations

In most cases, including the below, you will know if `merge-source-maps` does not work on your project, as it will spit out an informative error message.
But here are some limitations up-front.

Feel free to send PRs or open issues if `merge-source-maps` is not meeting your needs.

* **You must not overwrite any of the files produced from previous compilation steps.**
`merge-source-maps` needs the complete chain of compilation steps to appropriately produce a merged source map.
* **Currently limited to JavaScript files only.**
Supporting CSS would be trivial, as the source maps are the same, but the syntax for embedding them is slightly different.
Open an issue if this is a desired feature, and provide sample files if you can. :)
* **Your source files and source maps must contain correct paths to external resources on disk (source files and source maps).**
`merge-source-maps` requires these to be set properly so it can follow the compilation chain back to the original source files.
* **Your source maps must not use the sections property in the source map.**
[The source map standard](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit) includes a section property for
source maps generated from multiple source files, which is intended to be useful when multiple JS files are concatenated.
Currently, `merge-source-maps` does not support this field, and will throw an error.
Feel free to open an issue if this limitation is inhibiting your use of `merge-source-maps`.
