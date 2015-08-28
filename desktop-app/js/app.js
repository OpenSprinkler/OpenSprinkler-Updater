/* global angular */

// OpenSprinkler Updater
// Samer Albahra

// Since we are using Node Webkit, require the GUI module
var gui = require( "nw.gui" ),
    win = gui.Window.get();

// On OS X add a menu bar configuration
if ( process.platform === "darwin" ) {
    var nativeMenuBar = new gui.Menu( { type: "menubar" } );
    nativeMenuBar.createMacBuiltin( "OpenSprinkler Updater", {
      hideEdit: true
    } );
    win.menu = nativeMenuBar;
}

// Show the main window once the app has loaded
onload = function() {
	gui.Window.get().show();
};

angular.module( "os-updater", [ "ionic", "os-updater.controllers" ] )

.config( function( $stateProvider, $urlRouterProvider ) {

    $stateProvider

    // Setup a route for the main page and associate it's controller
    .state( "home", {
        url: "/home",
        controller: "HomeCtrl",
        templateUrl: "templates/home.html"
    } );

    // Set the default page as the home page
    $urlRouterProvider.otherwise( "/home" );

} );

// Check and update application
var currentVersion = gui.App.manifest.version,
	updateParams = {
		channel: "beta",
		currentVersion: currentVersion,
		endpoint: "https://raw.githubusercontent.com/OpenSprinkler/OpenSprinkler-Updater/master/update.json",
		verify: false
	},
	updater = require( "nw-updater" )( updateParams );

updater.update();

updater.on( "download", function( version ) {
	console.log( "Downloading new version: " + version );
} );

updater.on( "installed", function() {
	alert( "The OpenSprinkler Updater has just been updated to the latest version, please restart the app to update." );
} );

updater.on( "error", function( err ) {
	console.log( err );
} );
