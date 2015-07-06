var exec = require( "child_process" ).exec,
	async = require( "async" ),
	fs = require( "fs" );

angular.module( "os-updater.controllers", [] )

.controller( "DashCtrl", function( $scope, $http ) {

	var arch = process.arch === "x64" ? "64" : "32",
		commandPrefix = {
			win: process.cwd() + "\\avr\\win\\avrdude.exe -C " + process.cwd() + "\\avr\\win\\avrdude.conf ",
			osx: "avr/osx/avrdude -C avr/osx/avrdude.conf ",
			linux: "./avr/linux" + arch + "/avrdude -C ./avr/linux" + arch + "/avrdude.conf "
		},
		deviceList = {
			"v2.0": {
				id: "0x1e96",
				command: "-c usbtiny -p m644 "
			},
			"v2.1": {
				id: "0x1e96",
				command: "-c usbasp -p m644 ",
				preventScan: true
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

					if ( device.preventScan !== true ) {

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
					} else {
						callback();
					}
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
							$scope.deviceList.push( {
								type: "v2.1"
							} );
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

						if ( item[0] === "0x16c0" && item[1] === "0x05dc" ) {
							console.log( "Found OpenSprinkler v2.1" );

							$scope.deviceList.push( {
								type: "v2.1"
							} );
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
		} else if ( platform === "linux" ) {
			exec( "./avr/serial.linux.sh", function( error, stdout, stderr ) {
				var data = stdout.split( "\n" ),
					item;

				for ( item in data ) {
					if ( data.hasOwnProperty( item ) ) {
						item = data[item].split( "::" );

						if ( item.length < 3 ) {
							continue;
						}

						if ( item[1] === "16c0" && item[2] === "05dc" ) {
							console.log( "Found OpenSprinkler v2.1" );

							$scope.deviceList.push( {
								type: "v2.1"
							} );
						}

						if ( item[1] === "1a86" && item[2] === "7523" ) {
							port = item[0];

							console.log( "Found a match at: " + port );
						}
					}
				}

				scan();
			} );
		} else if ( platform === "win" ) {
			exec( "wmic path win32_pnpentity get caption, deviceid /format:csv", function( error, stdout, stderr ) {
				var data = stdout.split( "\n" ),
					item;

				for ( item in data ) {
					if ( data.hasOwnProperty( item ) ) {
						item = data[item].split( "," );

						if ( item.length < 3 ) {
							continue;
						}

						if ( /VID_16C0/g.test( item[2] ) && /PID_05DC/g.test( item[2] ) ) {
							console.log( "Found OpenSprinkler v2.1" );

							$scope.deviceList.push( {
								type: "v2.1"
							} );
						}

						if ( /VID_1A86/g.test( item[2] ) && /PID_7523/g.test( item[2] ) ) {
							port = item[1].match( /COM(\d+)/i );
							port = port.length ? port[0] : undefined;

							console.log( "Found a match at: " + port );
						}
					}
				}

				scan();
			} );
		}
	};

	$scope.updateAction = function( type ) {

		var startTime = new Date().getTime(),
			cleanUp = function() {
				if ( new Date().getTime() - startTime < 800 ) {
					setTimeout( cleanUp, 800 );
					return;
				}
				$scope.button.text = "Check for new devices";
				$scope.button.disabled = false;
				$scope.$apply();
			};

		$scope.button.disabled = true;

		if ( typeof $scope.latestRelease !== "object" || !$scope.latestRelease.name ) {
			var available = fs.readdirSync( "firmwares/" + deviceList[type] ).sort( sortFirmwares );
		} else {
			$scope.button.text = "Downloading latest firmware...";

			async.series( {
				download: function( callback ) {
					downloadFirmware( type, $scope.latestRelease.name, callback );
				},
				status: function( callback ) {
					var command = commandPrefix[platform] + ( deviceList[type].usePort && port ? "-P " + port + " " : "" ) + " -q -F -U flash:w:" + deviceList[type].command;

					exec( command, function( error, stdout, stderr ) {
						stdout = stdout || stderr;

						var result = stdout.indexOf( "verified" ) === -1 ? false : true;

						callback( null, result );

						console.log( "OpenSprinkler " + type + " upgrade " + ( result ? "succeeded" : "failed" ) );
					} );
				}
			}, function( err, results ) {
				console.log( results );
				cleanUp();
			} );
		}
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

	function downloadFirmware( device, version, callback ) {
		var url = "https://raw.githubusercontent.com/salbahra/OpenSprinkler-FW-Updater/nodejs-rewrite/compiled-fw/" + device + "/firmware" + version + ".hex";

		// If the directory for the hardware type doesn't exist then create it
		if ( !fs.existsSync( "firmwares/" + device ) ) {
			fs.mkdirSync( "firmwares/" + device );
		}

		$http.get( url ).then(
			function( response ) {
				fs.writeFile( "firmwares/" + device + "/" + version + ".hex", response.data, callback );
				console.log( "Downloaded firmware " + version + " for OpenSprinkler " + version + " successfully!" );
			},
			function( err ) {
				callback();
				console.log( "Downloaded failed for firmware " + version + " for OpenSprinkler " + version );
			}
		);
	}
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

function sortFirmwares( a, b ) {
	var filter = /\d\.\d\.\d/g

    a = parseInt( a.match( filter )[0].replace( /\./g, "" ) );
    b = parseInt( b.match( filter )[0].replace( /\./g, "" ) );
    console.log( a, b );
    if ( a < b ) {
        return -1;
    }
    if ( a > b ) {
        return 1;
    }
    return 0;
};

// Resolves the Month / Day / Year of a Date object
function toUSDate( date ) {
	return ( date.getMonth() + 1 ) + "/" + date.getDate() + "/" + date.getFullYear();
}
