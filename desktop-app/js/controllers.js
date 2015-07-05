var exec = require( "child_process" ).exec,
	async = require( "async" );

angular.module( "starter.controllers", [] )

.controller( "DashCtrl", function( $scope, $http ) {

	var commandPrefix = {
			win: "avr/win/avrdude.exe -C avr/win/avrdude.conf ",
			osx: "avr/osx/avrdude -C avr/osx/avrdude.conf ",
			linux: "avrdude "
		},
		deviceList = {
			"v2.0": {
				id: "0x1e96",
				command: "-c usbtiny -p m644 "
			},
			"v2.1": {
				id: "0x1e96",
				command: "-c usbasp -p m644 "
			},
			"v2.2": {
				id: "0x1e96",
				command: "-c arduino -p m644 -b 115200 "
			},
			"v2.3": {
				id: "0x1e97",
				command: "-c arduino -p m1284p -b 115200 "
			}
		},
		platform = "linux";

	if ( /^win/.test( process.platform ) ) {
		platform = "win";
	} else if ( /^darwin/.test( process.platform ) ) {
		platform = "osx";
	}

	$scope.button = {};

	$scope.checkDevices = function() {

		// Indicate a device scan is underway
		$scope.button.text = "Checking for devices...";
		$scope.button.disabled = true;
		$scope.deviceList = [];

		var deviceFound = false;

		// Perform scan
		async.forEachOf( deviceList, function( device, key, callback ) {
			var regex = new RegExp( device.id, "g" );

			exec( commandPrefix[platform] + device.command, function( error, stdout, stderr ) {
				if ( regex.test( stderr ) ) {
					$scope.deviceList.push( {
						type: key
					} );
				}

				callback();
			} );
		}, function() {
			cleanUp();
		} );

		var cleanUp = function() {
			$scope.button.text = "Check for new devices";
			$scope.button.disabled = false;
			$scope.$apply();
		};
	};

	$scope.updateAction = function() {

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

	$scope.checkDevices();

} )

.controller( "AboutCtrl", function( $scope ) {} );

// Resolves the Month / Day / Year of a Date object
function toUSDate( date ) {
	return ( date.getMonth() + 1 ) + "/" + date.getDate() + "/" + date.getFullYear();
}
