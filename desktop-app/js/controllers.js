var exec = require( "child_process" ).exec,
	async = require( "async" ),
	fs = require( "fs" );

angular.module( "os-updater.controllers", [] )

.controller( "DashCtrl", function( $scope, $http ) {

	var commandPrefix = {
			win: process.cwd() + "\\avr\\win\\avrdude.exe -C avr\\win\\avrdude.conf ",
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
				usePort: true,
				command: "-c arduino -p m644 -b 115200 "
			},
			"v2.3": {
				id: "0x1e97",
				usePort: true,
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

		var deviceFound = false,
			startTime = new Date().getTime(),
			scan = function() {
				async.forEachOfSeries( deviceList, function( device, key, callback ) {
					var regex = new RegExp( device.id, "g" ),
						command = commandPrefix[platform] + ( device.usePort && port ? "-P " + port + " " : "" ) + device.command;

					exec( command, function( error, stdout, stderr ) {
						stdout = stdout || stderr;

						console.log( "Command: " + command, device, stdout );

						if ( stdout.indexOf( "Device signature = " ) !== -1 && regex.test( stdout ) ) {

							console.log( "Found OpenSprinkler " + key );

							$scope.deviceList.push( {
								type: key
							} );
						}

						setTimeout( callback, 200 );
					} );
				}, function() {
					cleanUp();
				} );
			},
			cleanUp = function() {
				if ( new Date().getTime() - startTime < 800 ) {
					setTimeout( cleanUp, 800 );
					return;
				}
				$scope.button.text = "Check for new devices";
				$scope.button.disabled = false;
				$scope.$apply();
			},
			port;

		if ( platform === "osx" ) {
			async.parallel( {
				ports: function( callback ) {
					exec( "ls /dev/cu.*", function( error, stdout, stderr ) {
						callback( null, stdout.split( "\n" ) );
					} );
				},
				devices: function( callback ) {
					exec( "avr/serial.osx.sh", function( error, stdout, stderr ) {
						callback( null, stdout.split( "\n" ) );
					} );
				}
			}, function( err, data ) {
				var item, location;

				for ( device in data.devices ) {
					if ( data.devices.hasOwnProperty( device ) ) {
						item = data.devices[device].split( ":" );
						if ( item.length < 2 ) {
							continue;
						}

						if ( item[0] === "0x1a86" && item[1] === "0x7523" ) {
							var location = item[2].split( "/" )[0].trim().replace( /^0x([\d\w]+)$/, "$1" ).substr( 0, 4 );
							port = findPort( data.ports, location );

							console.log( "Found a match at: " + port );

						}
					}
				}
				scan();
			} );
		}
	};

	$scope.updateAction = function( type ) {

		if ( typeof $scope.latestRelease !== "object" || !$scope.latestRelease.name ) {
			return;
		}

		// If the directory for the hardware type doesn't exist then create it
		if ( !fs.existsSync( "firmware/" + type ) ) {
			fs.mkdirSync( "firmware/" + type );
		}

		fs.writeFile( "firmware/" + type + "/" + $scope.latestRelease.name + ".hex", "Testing!", function( err ) {
		    if ( err ) {
		        console.log( err );
		    }
		} );

	};

	// Github API to get releases for OpenSprinkler firmware
	$http.get( "https://api.github.com/repos/opensprinkler/opensprinkler-firmware/releases" ).success( function( releases ) {

		$scope.latestRelease = {};

		// Update the release date time to a readable string
		$scope.latestRelease.releaseDate = toUSDate( new Date( releases[0].created_at ) );
		$scope.latestRelease.name = releases[0].name;

		// Update body text
		changeLog = releases[0].body.split( "\r\n" );

		for ( line in changeLog ) {
			if ( changeLog.hasOwnProperty( line ) ) {
				changeLog[line] = changeLog[line].replace( /^[\-|\*|\+]\s(.*)$/, "<li>$1</li>" );
				changeLog[line] = changeLog[line].replace( /^(?!<li>.*<\/li>$)(.*)$/, "<p>$1</p>" );
			}
		}

		$scope.latestRelease.changeLog = changeLog.join( "" );

	} );

	$scope.checkDevices();

} )

.controller( "AboutCtrl", function( $scope ) {} );

function findPort( ports, location ) {
	for ( port in ports ) {
		if ( ports.hasOwnProperty( port ) ) {
			if ( ports[port].indexOf( location ) !== -1 ) {
				return ports[port];
			}
		}
	}

	return false;
}

// Resolves the Month / Day / Year of a Date object
function toUSDate( date ) {
	return ( date.getMonth() + 1 ) + "/" + date.getDate() + "/" + date.getFullYear();
}
