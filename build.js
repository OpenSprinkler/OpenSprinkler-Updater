// Define application name for packaged files
var appName = "OpenSprinkler-FW-Updater",
	NwBuilder = require( "node-webkit-builder" ),
	appPkg = require( "./desktop-app/package.json" ),
	fs = require( "fs" ),
	async = require( "async" ),
	archiver = require( "archiver" ),
	nw = new NwBuilder( {
	  files: "desktop-app/**",
	  platforms: [ "osx32", "win32", "linux" ],
	  appName: appName,
	  appVersion: appPkg.version,
	  winIco: "assets/win.ico",
	  macIcns: "assets/mac.icns",
	  buildType: "default",
	  macZip: false,
	  mergeZip: false
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
			packageReleases( callback );
		}
	] );
  } )
  .catch( function( error ) {
    console.error( error );
  } );

// Create the regular .nw file for updates
function createNW( callback ) {
	console.log( "Creating updater.nw for partial updates..." );

	var archive = archiver( "zip" ),
		output = fs.createWriteStream( "./build/" + appName + ".nw" );

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
	console.log( "Creating Mac OS X DMG..." );

	if ( fs.existsSync( "./build/" + appName + ".dmg" ) ) {
		fs.unlinkSync( "./build/" + appName + ".dmg" );
	}

	var appdmg = require( "appdmg" ),
		ee = appdmg( {
			source: "./assets/dmg.json",
			target: "./build/" + appName + ".dmg"
		} );

	ee.on( "finish", function() {
		console.log( "Mac OS X DMG successfully created" );
		callback();
	} );

	ee.on( "error", function( err ) {
		console.log( err );
	} );
}

// Create the final zip and tar files for all platforms for distrbution
function packageReleases() {
	var platforms = [ "win32", "linux32", "linux64" ],
		platform;

	for ( platform in platforms ) {
		if ( platforms.hasOwnProperty( platform ) ) {
			createPackage( platforms[platform] );
		}
	}
}

function createPackage( platform ) {
	var archive, output, type;

	console.log( "Creating package for " + platform + "..." );

	type = ( platform === "win32" ) ? "zip" : "tar";

	archive = archiver( type, {
		gzip: true,
		gzipOptions: {
			level: 9
		}
	} );

	output = fs.createWriteStream( "./build/OpenSprinkler-FW-Updater-" + platform + "." + type + ( platform === "win32" ? "" : ".gz" ) );

	output.on( "close", function() {
		console.log( "Package for " + platform + " completed successfully (" + ( archive.pointer() / 1000000 ).toFixed( 2 ) + "MB)" );
	} );

	archive.pipe( output );
	archive.bulk( [ {
		expand: true,
		cwd: "./build/" + appName + "/" + platform,
		src: [ "**" ],
		dest: "."
	} ] );
	archive.finalize();
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
			var filePath = dirPath + "/" + files[i];
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
