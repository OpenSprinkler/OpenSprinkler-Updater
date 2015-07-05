// OpenSprinkler-FW-Updater
// Samer Albahra

var gui = require( "nw.gui" ),
    win = gui.Window.get();

if ( process.platform === "darwin" ) {
    var nativeMenuBar = new gui.Menu( { type: "menubar" } );
    nativeMenuBar.createMacBuiltin( "OS Updater", {
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
    .state( "tab", {
        url: "/tab",
        abstract: true,
        templateUrl: "templates/tabs.html"
    } )

    // Each tab has its own nav history stack:

    .state( "tab.dash", {
        url: "/dash",
        views: {
            "tab-dash": {
                templateUrl: "templates/tab-dash.html",
                controller: "DashCtrl"
            }
        }
    } )

    .state( "tab.about", {
        url: "/about",
        views: {
            "tab-about": {
                templateUrl: "templates/tab-about.html",
                controller: "AboutCtrl"
            }
        }
    } );

    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise( "/tab/dash" );

} );
