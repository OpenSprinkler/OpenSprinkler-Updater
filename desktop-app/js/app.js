// OpenSprinkler-FW-Updater
// Samer Albahra

// Since we are using Node Webkit, require the GUI module
var gui = require( "nw.gui" ),
    win = gui.Window.get();

// On OS X add a menu bar configuration
if ( process.platform === "darwin" ) {
    var nativeMenuBar = new gui.Menu( { type: "menubar" } );
    nativeMenuBar.createMacBuiltin( "OS FW Updater", {
      hideEdit: true
    } );
    win.menu = nativeMenuBar;
}

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
