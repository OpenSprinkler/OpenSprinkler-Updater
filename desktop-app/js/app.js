// OpenSprinkler-FW-Updater
// Samer Albahra

var gui = require( "nw.gui" ),
    win = gui.Window.get();

if ( process.platform === "darwin" ) {
    var nativeMenuBar = new gui.Menu( { type: "menubar" } );
    nativeMenuBar.createMacBuiltin( "OS FW Updater", {
      hideEdit: true
    } );
    win.menu = nativeMenuBar;
}

angular.module( "os-updater", [ "ionic", "os-updater.controllers" ] )

.config( function( $stateProvider, $urlRouterProvider ) {

    // Ionic uses AngularUI Router which uses the concept of states
    // Learn more here: https://github.com/angular-ui/ui-router
    // Set up the various states which the app can be in.
    // Each state's controller can be found in controllers.js
    $stateProvider

    // setup an abstract state for the tabs directive
    .state( "home", {
        url: "/home",
        controller: "HomeCtrl",
        templateUrl: "templates/home.html"
    } )

    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise( "/home" );

} );
