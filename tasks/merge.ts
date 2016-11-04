import mergeSourceMaps = require('../lib/index');
import IFile = mergeSourceMaps.IFile;
import ISourceMapMergerConfig = mergeSourceMaps.ISourceMapMergerConfig;

export = function(grunt: IGrunt) {
  grunt.registerMultiTask('merge-source-maps', 'Merges a chain of source maps into a single file.', function(this: grunt.task.IMultiTask<ISourceMapMergerConfig>) {
    const files: IFile[] = this.files.map((file) => {
      // Sanity checks.
      if (file.src.length > 1) {
        grunt.log.error(`Multiple source files specified for a single target: ${file.src.join(" ")}`);
      } else if (file.src.length === 0) {
        grunt.log.error(`No source files specified.`);
      }

      return {
        src: file.src[0],
        dest: file.dest
      };
    });
    mergeSourceMaps.merge(files, this.options({}));
  });
};
