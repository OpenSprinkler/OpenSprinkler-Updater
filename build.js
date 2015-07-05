// TODO: automate updating desktop-app/package.json version
console.log( "Before running, make sure versions are updated in both package.json and desktop-app/package.json" );

var NwBuilder = require( "node-webkit-builder" ),
  appPkg = require( "./desktop-app/package.json" ),
  fs = require( "fs" ),
  appName = "OS-Updater";

var nw = new NwBuilder( {
  files: "desktop-app/**",
  platforms: [ "osx", "win", "linux" ],
  appName: appName,
  appVersion: appPkg.version,
  winIco: "assets/win.ico",
  macIcns: "assets/mac.icns",
  buildType: "default",
  macZip: false,
  mergeZip: false
} );

nw.on( "log", console.log );

nw.build()
  .then( function() {
    console.log( "All apps have been built successfully!" );
    createDMG();
    createNW();
  } )
  .catch( function( error ) {
    console.error( error );
  } );

// create the regular .nw file for updates
function createNW() {
  console.log( "Creating regular updater.nw for updates..." );
  var archiver = require( "archiver" ),
    archive = archiver( "zip" );

  var output = fs.createWriteStream( "./build/" + appName + "/OS-Updater-" + appPkg.version + ".nw" );
  output.on( "close", function() {
    console.log( ( archive.pointer() / 1000000 ).toFixed( 2 ) + "mb compressed" );
  } );

  archive.pipe( output );
  archive.bulk( [
    { expand: true, cwd: "desktop-app", src: [ "**" ], dest: "." }
  ] );
  archive.finalize();
}

// create the mac DMG installer
function createDMG() {
  console.log( "Creating Mac OS X DMG..." );

  if ( fs.existsSync( "./build/" + appName + "/OS-Updater.dmg" ) ) {
    fs.unlinkSync( "./build/" + appName + "/OS-Updater.dmg" );
  }

  var appdmg = require( "appdmg" ),
    ee = appdmg( {
    source: "assets/dmg.json",
    target: "./build/" + appName + "/OS-Updater.dmg"
  } );

  ee.on( "progress", function( info ) {

    // info.current is the current step
    // info.total is the total number of steps
    // info.type is on of 'step-begin', 'step-end'

    // 'step-begin'
    // info.title is the title of the current step

    // 'step-end'
    // info.status is one of 'ok', 'skip', 'fail'
    console.log( "DMG step " + info.current + "/" + info.total );

  } );

  ee.on( "finish", function() {
    console.log( "Mac OS X DMG successfully created" );
  } );

  ee.on( "error", function( err ) {
    console.log( err );
  } );
}
