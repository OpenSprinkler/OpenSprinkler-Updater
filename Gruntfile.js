module.exports = function(grunt) {

  // Load node-modules;
  grunt.loadNpmTasks("grunt-contrib-compress");

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),

    compress: {
      windows: {
        options: {
          archive: "build/osFWUpdater_win32.zip"
        },
        files: [{
          src: ["**"],
          cwd: "Windows/",
          expand: true
        }]
      },
      osx: {
        options: {
          archive: "build/osFWUpdater_MacOSX.zip"
        },
        files: [{
          src: ["**"],
          cwd: "MacOSX/",
          expand: true
        }]
      },
      linux: {
        options: {
          archive: "build/osFWUpdater_linux.zip"
        },
        files: [{
          src: ["**"],
          cwd: "Linux/",
          expand: true
        }]
      }
    }
  });

  // Default task(s).
  grunt.registerTask("build",["compress:windows","compress:osx","compress:linux"]);
  grunt.registerTask("default",["build"]);

};
