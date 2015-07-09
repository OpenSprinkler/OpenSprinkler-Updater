module.exports = function( grunt ) {

	// Load node-modules;
	grunt.loadNpmTasks( "grunt-contrib-jshint" );
	grunt.loadNpmTasks( "grunt-github-releaser" );

	// Project configuration.
	grunt.initConfig( {
		pkg: grunt.file.readJSON( "package.json" ),

		jshint: {
			main: [ "Gruntfile.js", "build.js", "desktop-app/js/*.js" ],
			options: {
				jshintrc: true
			}
		},

		"github-release": {
			options: {
				repository: "salbahra/OpenSprinkler-FW-OpenSprinkler",
				auth: {
					user: "username",
					password: process.env.GITHUB_TERMINAL
				}
			},
			files: {
				"dest": [	"OpenSprinkler-FW-Updater-win32.zip",
							"OpenSprinkler-FW-Updater-linux32.tar.gz",
							"OpenSprinkler-FW-Updater-linux64.tar.gz",
							"OpenSprinkler-FW-Updater.dmg"
				]
			}
		}

	} );

	// Default task(s).
	grunt.registerTask( "default", [ "jshint" ] );

};
