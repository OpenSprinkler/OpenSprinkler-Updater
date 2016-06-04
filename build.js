// Define application name for packaged files
var appName = "OpenSprinkler Updater",
	NwBuilder = require( "nw-builder" ),
	appPkg = require( "./desktop-app/package.json" ),
	fs = require( "fs" ),
	async = require( "async" ),
	exec = require( "child_process" ).exec,
	archiver = require( "archiver" ),
	nw = new NwBuilder( {
	  files: "desktop-app/**",
	  platforms: [ "osx32", "win32", "linux" ],
	  version: "0.12.3",
	  appName: appName,
	  appVersion: appPkg.version,
	  winIco: "assets/win.ico",
	  macIcns: "assets/mac.icns",
	  buildType: "default",
	  zip: false,
	  mergeZip: false
	} ),
	createPackage = async.queue( function( task, callback ) {
		var archive, output, type;

		console.log( "Creating package for " + task.platform + "..." );

		type = ( task.platform === "win32" ) ? "zip" : "tar";

		archive = archiver( type, {
			gzip: true,
			gzipOptions: {
				level: 9
			}
		} );

		output = fs.createWriteStream( "./build/" + appName.replace( /\s/g, "-" ) + "-" + task.platform + "." + type + ( task.platform === "win32" ? "" : ".gz" ) );

		output.on( "close", function() {
			console.log( "Package for " + task.platform + " completed successfully (" + ( archive.pointer() / 1000000 ).toFixed( 2 ) + "MB)" );
			callback();
		} );

		archive.pipe( output );
		archive.bulk( [ {
			expand: true,
			cwd: "./build/" + appName + "/" + task.platform,
			src: [ "**" ],
			dest: "."
		} ] );
		archive.finalize();
	} );

// Clean up firmware directory before building
rmDir( "./desktop-app/firmwares", false );

// Add gitignore file to empty firmware folder
fs.writeFile( "./desktop-app/firmwares/.gitignore", "*\n!.gitignore\n" );

// Remove development binary in desktop-app, if present
if ( fs.existsSync( "./desktop-app/nwjs.app" ) ) {
	rmDir( "./desktop-app/nwjs.app" );
}

console.log( "Starting build of all selected platforms..." );

nw.build()
  .then( function() {
    console.log( "All platforms have been built successfully!" );
    async.series( [
		function( callback ) {
			createNW( callback );
		},
		function( callback ) {
			createDMG( callback );
		},
		function( callback ) {
			console.log( "Creating package for win32..." );
			exec( "wine 'C:\\Program Files\\Inno Setup 5\\Compil32.exe' '/cc' 'setup.iss'", function() {
				console.log( "Package for win32 completed successfully (" + ( fs.statSync( "./build/" + appName.replace( /\s/g, "-" ) + ".exe" ).size / 1000000 ).toFixed( 2 ) + "MB)" );
				callback();
			} );
		},
		function( callback ) {
			packageLinux( callback );
		}
	] );
  } )
  .catch( function( error ) {
    console.error( error );
  } );

// Create the regular .nw file for updates
function createNW( callback ) {
	console.log( "Creating regular updater.nw for partial updates..." );

	var archive = archiver( "zip" ),
		output = fs.createWriteStream( "./build/" + appName.replace( /\s/g, "-" ) + ".nw" );

	output.on( "close", function() {
		console.log( "Partial update package completed (" + ( archive.pointer() / 1000000 ).toFixed( 2 ) + "MB)" );
		callback();
	} );

	archive.pipe( output );
	archive.bulk( [ {
		expand: true,
		cwd: "desktop-app",
		src: [ "**" ],
		dest: "."
	} ] );
	archive.finalize();
}

// Create the mac DMG installer
function createDMG( callback ) {
	console.log( "Creating package for osx..." );

	var location = "./build/" + appName.replace( /\s/g, "-" ) + ".dmg";

	if ( fs.existsSync( location ) ) {
		fs.unlinkSync( location );
	}

	// Rename driver package in preparation for inclusion to disk image
	fs.renameSync( "./drivers/osx.pkg", "./drivers/Install Drivers.pkg" );

	var appdmg = require( "appdmg" ),
		ee = appdmg( {
			source: "./assets/dmg.json",
			target: location
		} );

	ee.on( "finish", function() {

		// Clean up by renaming OS X driver package back
		fs.renameSync( "./drivers/Install Drivers.pkg", "./drivers/osx.pkg" );

		console.log( "Package for osx completed successfully (" + ( fs.statSync( location ).size / 1000000 ).toFixed( 2 ) + "MB)"  );
		callback();
	} );

	ee.on( "error", function( err ) {
		console.log( err );
	} );
}

// Create the final  tar files for the linux platform for distrbution
function packageLinux() {
	var platforms = [ "linux32", "linux64" ],
		platform;

	for ( platform in platforms ) {
		if ( platforms.hasOwnProperty( platform ) ) {
			createPackage.push( {
				platform: platforms[ platform ]
			} );
		}
	}
}

function rmDir( dirPath, removeSelf ) {
	var files;

	if ( removeSelf === undefined ) {
		removeSelf = true;
	}

	try {
		files = fs.readdirSync( dirPath );
	} catch ( err ) { return; }

	if ( files.length > 0 ) {
		for ( var i = 0; i < files.length; i++ ) {
			var filePath = dirPath + "/" + files[ i ];
			if ( fs.statSync( filePath ).isFile() ) {
				fs.unlinkSync( filePath );
			} else {
				rmDir( filePath );
			}
		}
	}

	if ( removeSelf ) {
		fs.rmdirSync( dirPath );
	}
}
