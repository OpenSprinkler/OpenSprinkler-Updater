angular.module( "starter.controllers", [] )

.controller( "DashCtrl", function( $scope, $http ) {

	var exec = require( "child_process" ).exec;

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

} )

.controller( "AboutCtrl", function( $scope ) {} );

// Resolves the Month / Day / Year of a Date object
function toUSDate( date ) {
	return ( date.getMonth() + 1 ) + "/" + date.getDate() + "/" + date.getFullYear();
}
