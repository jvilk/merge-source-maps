# merge-source-maps v0.5.0
> Library, command-line tool, and Grunt task for merging multiple source maps from compilation phases into a single source map.

If you have a multi-step compilation pipeline, you likely have a separate source map for each step
of compilation (e.g. TypeScript => JavaScript => Minified JavaScript). Combining these source maps
is headache inducing, and there are currently no grunt tasks to do this for you... until now!

(Note: The general template and boilerplate text in this README were copied from [the README for `grunt-contrib-copy`](https://github.com/gruntjs/grunt-contrib-copy/blob/master/README.md)).

## Getting Started

Install with this command:

    npm install merge-source-maps --save-dev

Once installed, you can use `merge-source-maps` in your Gruntfile with this line of JavaScript:

    grunt.loadNpmTasks('merge-source-maps');

Alternatively, you can use the `merge-source-maps` command line tool, which is now in `node_modules/.bin/merge-source-maps`.
It's easy to call as a script in `package.json`:

```json
"scripts": {
    "source-maps": "merge-source-maps --inline-sources dist/mylib.js"
}
```

Or, install globally and you can run `merge-source-maps` from your terminal!

    npm i -g merge-source-maps

### Grunt `merge-source-maps` task

*Run this task with `grunt merge-source-maps`.*

Task targets, files and options may be specified according to the grunt [Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

#### Source Files

The source files for this task should be a JavaScript source file that contains or references an external source map.
The source file should be from the *final* step in the compilation process.
`merge-source-maps` will follow the chain of source maps to the beginning.

For example, let's say that you compiled `foo.ts` to `foo.js`, and minified it to `foo.min.js`.
If you want to combine `foo.js.map` and `foo.min.js.map`, you should specify `foo.min.js`.

#### Destination File

By default, `merge-source-maps` will overwrite the source map from the final compilation phase.
If you switch from an inlined source map to an external source map, it will write to `[filename].map` instead.

If specified, the corresponding destination file *must* be the source map file name that you desire.
However, if you specified `inlineSourceMap`, then `merge-source-maps` will ignore the destination file and modify the final generated file instead.

## Options

These options are valid for the command line client, the library, and the Grunt task.

### inlineSources (--inline-sources)

Type: `Boolean`

Default: `false`

If `true`, inlines the source code (from the first compilation step, e.g. TypeScript code) into the source map.

### inlineSourceMap (--inline-source-map)

Type: `Boolean`

Default: `false`

If `true`, inlines the source map into the generated JavaScript. The `dest` file for each `src` file *must* be the path to the generated JavaScript.

### ignoreMissingSourceMaps (--ignore-missing-source-maps)

Type: `Boolean`

Default: `false`

If `true`, ignores input files that are missing source maps. Otherwise, `merge-source-maps` will treat this event as a fatal error.

## Usage Examples

Below, we illustrate various useful configurations.

### Inlined source maps and sources

With this setup, the source map *and* the source code of your project will be embedded directly into the generated JavaScript file.
Thus, the JavaScript file alone is all that is needed to debug your program with source maps, provided the debugger supports
embedded source maps.
Perfect for scenarios where bandwidth is not an issue, such as Node projects or debug builds.

Grunt configuration:

```js
"merge-source-maps": {
    foo: {
        options: {
            inlineSourceMap: true,
            inlineSources: true
        },
        files: [{
            // src and dest are the same; merge-source-maps appends source map info to target file
            src: ['build/*.js'],
            expand: true
        }]
    }
}
```

On the command line:

```
merge-source-maps --inline-source-map --inline-sources build/*.js
```

### External source maps with inlined sources

With this setup, the generated JavaScript file will have a corresponding `.map` file that also contains the source code to the program.
The debugger will only need the JavaScript file and the map file to debug the code with source maps.
Perfect for production web projects, where you want small, minified JavaScript files but also want to be able to debug the original source code.

Grunt configuration:

```js
"merge-source-maps": {
    foo: {
        options: {
            inlineSources: true
        },
        files: [{
            // merge-source-maps will overwrite each file's source map.
            src: ['build/*js'],
            expand: true
        }]
    }
}
```

On the command line:

```
merge-source-maps --inline-sources build/*.js
```

### External source maps with external sources

With this setup, the generated JavaScript file will have a corresponding `.map` file that references external source code files.
The debugger will need to fetch the JavaScript file, the `.map` file, and each external source code file before you can debug
the code with source maps.
Ideal if you are already planning on hosting the original source files for some reason, as it minimizes redundant information
embedded within the source map.
Also ideal if your debugger does not support embedded source code in source maps.

Grunt configuration:

```js
"merge-source-maps": {
    foo: {
        files: [{
            // merge-source-maps will overwrite each file's source map.
            src: ['build/*.js'],
            expand: true
        }]
    }
}
```

On the command line:

```
merge-source-maps build/*.js
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

## Building

To build `merge-source-maps` from source, simply run `npm install`.

## What about {gulp,jake,broccoli}?

Do you use a different build system?
Let me know if you're interested in spearheading development of a similar plugin for those environments!
I can either include it in this package, or you can make a package that depends on this one.
