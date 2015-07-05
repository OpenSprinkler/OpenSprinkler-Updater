angular.module( "starter.controllers", [] )

.controller( "DashCtrl", function( $scope, $http ) {

	$scope.button = {};

	var exec = require( "child_process" ).exec,
		checkDevices = function() {

			// Indicate a device scan is underway
			$scope.button.text = "Checking for devices...";
			$scope.button.disabled = true;
			$scope.deviceList = "";

			// Perform scan

			var cleanUp = function() {
				$scope.$apply( function() {
					$scope.button.text = "Check for new devices";
					$scope.button.disabled = false;
					$scope.deviceList = "No devices detected";
				} );
			};

			setTimeout( cleanUp, 400 );
		};

	// Github API to get releases for OpenSprinkler firmware
	$http.get( "https://api.github.com/repos/opensprinkler/opensprinkler-firmware/releases" ).success( function( releases ) {
		for ( release in releases ) {
			if ( releases.hasOwnProperty( release ) ) {

				// Update the release date time to a readable string
				releases[release].created_at = toUSDate( new Date( releases[release].created_at ) );

				// Update body text
				releases[release].body = releases[release].body.replace( /[\-|\*|\+]\s(.*)?(?:\r\n)?/g, "<li>$1</li>\r\n" );
			}
		}

		window.test = releases;
		$scope.fwReleases = releases;
	} );

	checkDevices();

} )

.controller( "AboutCtrl", function( $scope ) {} );

// Resolves the Month / Day / Year of a Date object
function toUSDate( date ) {
	return ( date.getMonth() + 1 ) + "/" + date.getDate() + "/" + date.getFullYear();
}
