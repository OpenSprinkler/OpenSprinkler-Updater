var exec = require( "child_process" ).exec,
	async = require( "async" ),
	fs = require( "fs" );

angular.module( "os-updater.controllers", [] )

.controller( "HomeCtrl", function( $scope, $ionicPopup, $http ) {

	var arch = process.arch === "x64" ? "64" : "32",

		// Defines the base command to AVRDUDE per platform
		commandPrefix = {
			win: process.cwd() + "\\avr\\win\\avrdude.exe -C " + process.cwd() + "\\avr\\win\\avrdude.conf ",
			osx: "avr/osx/avrdude -C avr/osx/avrdude.conf ",
			linux: "./avr/linux" + arch + "/avrdude -C ./avr/linux" + arch + "/avrdude.conf "
		},

		// Defines the available devices, their CPU signature and base command
		deviceList = {
			"v2.0": {
				id: "0x1e96",
				command: "-c usbtiny -p m644 "
			},
			"v2.1": {
				id: "0x1e96",
				command: "-c usbasp -p m644 ",

				// preventScan instruction because v2.1 requires a bootloader and the scan will
				// remove it from bootloader so instead we make a positive ID based on the PID:VID
				preventScan: true
			},
			"v2.2": {
				id: "0x1e96",

				// Indicates a serial port must be specified to interface with this device
				usePort: true,
				command: "-c arduino -p m644 -b 115200 "
			},
			"v2.3": {
				id: "0x1e97",
				usePort: true,
				command: "-c arduino -p m1284p -b 115200 "
			}
		},

		// Default platform is Linux unless otherwise detected below
		platform = "linux",

		// Define variable to be used for the identified port
		port;

	if ( /^win/.test( process.platform ) ) {

		// Detected Windows
		platform = "win";
	} else if ( /^darwin/.test( process.platform ) ) {

		// Detected OS X
		platform = "osx";
	}

	// Define object to carry properties for home page buttons
	$scope.button = {};

	// Method to scan for and find all connected devices (bound to check for devices button)
	$scope.checkDevices = function() {

		// Indicate a device scan is underway
		$scope.button.text = "Checking for devices...";
		$scope.button.disabled = true;
		$scope.deviceList = [];

		// Set the default state to no devices found
		var deviceFound = false,

			// Set the scan start time, if the scan is too quick we will artificially delay
			// it to avoid visual glitch like appearance
			startTime = new Date().getTime(),

			// Define the actual scan subroutine which runs after all serial ports are scanned
			scan = function() {

				// TODO: The scan needs to take into account the specific ports of each device detected so multiple
				// devices can truly be successfully updated while connected at the same time.

				// Parse each device possible and check for there presence
				async.forEachOfSeries( deviceList, function( device, key, callback ) {

					//Generate regex to search for the device signature in the AVRDUDE output
					var regex = new RegExp( device.id, "g" ),

						// Generate command to probe for device version
						command = commandPrefix[platform] + ( device.usePort && port ? "-P " + port + " " : "" ) + device.command;

					// Continue to scan unless the device type specifically requests not to scan
					if ( device.preventScan !== true ) {

						// Execute the AVRDUDE command and parse the reply
						exec( command, function( error, stdout, stderr ) {
							stdout = stdout || stderr;

							console.log( "Command: " + command, device, stdout );

							// Check the device signature against the associated ID
							if ( stdout.indexOf( "Device signature = " ) !== -1 && regex.test( stdout ) ) {

								console.log( "Found OpenSprinkler " + key );

								// Push the device to the detected list
								$scope.deviceList.push( {
									type: key
								} );
							}

							// Delay the next scan by 200 milliseconds to avoid error accessing serial ports
							setTimeout( callback, 200 );
						} );
					} else {

						// Be sure to continue to the next device type if one is excluded from scan
						callback();
					}
				}, function() {

					// Restore button state
					cleanUp();
				} );
			},
			cleanUp = function() {

				// If the scan time was too short, delay it to avoid a glitch like appearance
				if ( ( new Date().getTime() - startTime ) < 800 ) {
					setTimeout( cleanUp, 500 );
					return;
				}

				// Restore the buttons to their default state
				$scope.button.text = "Check for new devices";
				$scope.button.disabled = false;
				$scope.$apply();
			};

		// TODO: The serial detection code was whipped up quickly and needs refactoring to avoid
		// checking the same values three times.

		// Begin scanning for available serial ports
		if ( platform === "osx" ) {

			// For OS X, two commands are needed.
			async.parallel( {

				// The first command will list all Call-Up serial ports
				ports: function( callback ) {
					exec( "ls /dev/cu.*", function( error, stdout, stderr ) {

						// Return the list delimited by line return
						callback( null, stdout.split( "\n" ) );
					} );
				},

				// The second command requests the USB informatin from system_profiler (command in bash script)
				devices: function( callback ) {
					exec( "avr/serial.osx.sh", function( error, stdout, stderr ) {

						// Return the list delimited by line return
						callback( null, stdout.split( "\n" ) );
					} );
				}
			}, function( err, data ) {

				// Handle reply after both commands have completed
				var item, location, device;

				// Parse every USB devices detected
				for ( device in data.devices ) {
					if ( data.devices.hasOwnProperty( device ) ) {

						// Each reply is delimited by a colon and contains: PID::VID::Location
						// Location coorelates with the serial port location and is used to confirm the association
						item = data.devices[device].split( ":" );

						// If the list does not contain the required elements then continue
						if ( item.length < 2 ) {
							continue;
						}

						// Match OpenSprinkler v2.1 PID and VID and add it to the detected list since no scanning is needed
						if ( item[0] === "0x16c0" && item[1] === "0x05dc" ) {
							console.log( "Found OpenSprinkler v2.1" );

							$scope.deviceList.push( {
								type: "v2.1"
							} );
						}

						// Detected hardware v2.2 or v2.3 and coorelate the port value to the location
						if ( item[0] === "0x1a86" && item[1] === "0x7523" ) {
							location = item[2].split( "/" )[0].trim().replace( /^0x([\d\w]+)$/, "$1" ).substr( 0, 4 );
							port = findPort( data.ports, location );

							console.log( "Found a match at: " + port );

						}
					}
				}

				// Serial port scan is complete and device detection can start
				scan();
			} );
		} else if ( platform === "linux" ) {

			// Handle serial port scan for Linux platform by running shell script
			// which parses the /sys/bus/usb/devices path for connected devices
			exec( "./avr/serial.linux.sh", function( error, stdout, stderr ) {
				var data = stdout.split( "\n" ),
					item;

				// For each device detected parse the result
				for ( item in data ) {
					if ( data.hasOwnProperty( item ) ) {

						// The script returns each detected device is a double colon delimited value
						// which is in the following format: Location::PID::VID
						item = data[item].split( "::" );

						// If the item doesn't meet the required element number then continue
						if ( item.length < 3 ) {
							continue;
						}

						// Match OpenSprinkler v2.1 PID and VID and add it to the detected list since no scanning is needed
						if ( item[1] === "16c0" && item[2] === "05dc" ) {
							console.log( "Found OpenSprinkler v2.1" );

							$scope.deviceList.push( {
								type: "v2.1"
							} );
						}

						// Detected hardware v2.2 or v2.3 and coorelate the port value to the location
						if ( item[1] === "1a86" && item[2] === "7523" ) {
							port = item[0];

							console.log( "Found a match at: " + port );
						}
					}
				}

				// Serial port scan is complete and device detection can start
				scan();
			} );
		} else if ( platform === "win" ) {
			exec( "wmic path win32_pnpentity get caption, deviceid /format:csv", function( error, stdout, stderr ) {
				var data = stdout.split( "\n" ),
					item;

				for ( item in data ) {
					if ( data.hasOwnProperty( item ) ) {

						// The script returns each detected device is a comma delimited value
						// which is in the following format: Platform,Device Name,Device PID/VID
						item = data[item].split( "," );

						// If the item doesn't meet the required element number then continue
						if ( item.length < 3 ) {
							continue;
						}

						// Match OpenSprinkler v2.1 PID and VID and add it to the detected list since no scanning is needed
						if ( /VID_16C0/g.test( item[2] ) && /PID_05DC/g.test( item[2] ) ) {
							console.log( "Found OpenSprinkler v2.1" );

							$scope.deviceList.push( {
								type: "v2.1"
							} );
						}

						// Detected hardware v2.2 or v2.3 and coorelate the port value to the location
						if ( /VID_1A86/g.test( item[2] ) && /PID_7523/g.test( item[2] ) ) {
							port = item[1].match( /COM(\d+)/i );
							port = port.length ? port[0] : undefined;

							console.log( "Found a match at: " + port );
						}
					}
				}

				// Serial port scan is complete and device detection can start
				scan();
			} );
		}
	};

	// Method to handle the update process for OpenSprinkler
	$scope.updateAction = function( type ) {

		// Define the actual update subroutine which will run after the confirmation to continue
		var update = function() {

				// Disable the page buttons and update the status text
				$scope.upgradeLog = "";
				$scope.button.disabled = true;
				$scope.button.text = "Updating OpenSprinkler " + type + "...";

				// Define the start time of the update
				startTime = new Date().getTime();

				// Run the download process to first grab the required file then subsequently update the device
				async.series( {
					download: function( callback ) {

						// If the latest device is not detected then the Github API is not working or there is not network
						// Fallback to detecting if the files are present locally and use that
						if ( typeof $scope.latestRelease !== "object" || !$scope.latestRelease.name ) {
							file = fs.readdirSync( "firmwares/" + deviceList[type] ).sort( sortFirmwares )[0];

							if ( !file ) {

								// If no files are found proceed to the next step but indicate failure
								callback( null, false );
								return;
							}
						} else {
							$scope.button.text = "Downloading latest firmware...";
							file = $scope.latestRelease.name + ".hex";
							downloadFirmware( type, $scope.latestRelease.name, callback );
						}
					},
					status: function( callback ) {
						if ( !file ) {

							// If no file is defined then do not attempt to upgrade but instead just fail
							callback( null, { status: false } );
							return;
						}

						// Define the command to be used for upgrading
						var command = commandPrefix[platform] +
								( deviceList[type].usePort && port ? "-P " + port + " " : "" ) +
								deviceList[type].command + " -q -F -U flash:w:" + "firmwares/" + type + "/" + file;

						// Update buttons to indicate download complete and the upgrading has starting
						$scope.button.text = "Updating OpenSprinkler " + type + " firmware...";
						$scope.$apply();

						// Execute the AVRDUDE upgrade process and process the result
						exec( command, function( error, stdout, stderr ) {
							stdout = stdout || stderr;

							// At the end of the AVRDUDE command, the flash memory is verified and if successful a message indicating so is displayed
							// Check for that message as a means to verify the upgrade was successful
							var result = stdout.indexOf( "verified" ) === -1 ? false : true;

							if ( !result ) {

								// If the upgrade failed, load the log into the page for the user to see
								$scope.upgradeLog = stdout;
							}

							// Return the result to the final callback handler
							callback( null, result );

							console.log( "OpenSprinkler " + type + " upgrade " + ( result ? "succeeded" : "failed" ) );
						} );
					}
				}, function( err, results ) {

					// Process results once the download and upgrade process has completed. If the status was successful indicate so to the user.
					if ( results.status ) {
						$ionicPopup.alert( {
							title: "Upgrade OpenSprinkler " + type,
							template: "<p class='center'>The firmware update was successful and the device is rebooting. Please note the device will be restored to its factory settings.</p>"
						} );
					} else {

						// Otherwise, let the user know it failed
						$ionicPopup.alert( {
							title: "Upgrade OpenSprinkler " + type,
							template: "<p class='center'>The firmware update was <strong>NOT</strong> successful.<br><br>" +
							"Please review the log output for suggestions or <a target='_blank' href='https://support.opensprinkler.com'>contact support</a> if you continue to have problems.</p>"
						} );
					}

					// Clean up the page buttons after upgrade completion
					cleanUp();
				} );
			},
			cleanUp = function() {

				// If the upgrade time was too quick, introduce a small delay for to prevent a flicker appearance
				if ( ( new Date().getTime() - startTime ) < 800 ) {
					setTimeout( cleanUp, 800 );
					return;
				}

				// Restore buttons to their default state
				$scope.button.text = "Check for new devices";
				$scope.button.disabled = false;
				$scope.$apply();
			},
			file, start;

			// Ensure the user intended to proceed with the firmware upgrade which will erase current settings on the device
			confirmPopup = $ionicPopup.confirm( {
				title: "Upgrade OpenSprinkler " + type,
				template: "<p class='center'>Please note the device will be restored to it's default settings during the update so please make sure you already have a backup." +
					"<br><br>" +
					"Are you sure you want to upgrade OpenSprinkler " + type + " to firmware?</p>"
			} ).then( function( result ) {
				if ( result ) {
					update();
				}
			} );
	};

	// Method to show the change log in a popup to the user
	$scope.showChangelog = function() {
		$ionicPopup.alert( {
			title: "Firmware " + $scope.latestRelease.name + " Changelog",
			template: $scope.latestRelease.changeLog,
			cssClass: "changelog"
		} );
	};

	// Github API to get releases for OpenSprinkler firmware
	$http.get( "https://api.github.com/repos/opensprinkler/opensprinkler-firmware/releases" ).success( function( releases ) {

		var line;

		// Save all the releases to the allReleases scope for later parsing of older firmware versions (for downgrading)
		$scope.allReleases = releases;

		// Set up the default object for the latest release
		$scope.latestRelease = {};

		// Update the release date time to a readable string
		$scope.latestRelease.releaseDate = toUSDate( new Date( releases[0].created_at ) );

		// Set the version number to the latest release
		$scope.latestRelease.name = releases[0].name;

		// Update body text
		changeLog = releases[0].body.split( "\r\n" );

		for ( line in changeLog ) {
			if ( changeLog.hasOwnProperty( line ) ) {

				// Parse each line to convert the Markdown to HTML. If the item is a list item that starts with -, * or + then convert to a list item
				// Otherwise, assume it is a header for the proceeding list and wrap it as such
				changeLog[line] = changeLog[line].replace( /^[\-|\*|\+]\s(.*)$/, "<li>$1</li>" );
				changeLog[line] = changeLog[line].replace( /^(?!<li>.*<\/li>$)(.*)$/, "<p>$1</p>" );
			}
		}

		// Collapse the array of lines to a single string
		$scope.latestRelease.changeLog = changeLog.join( "" );

	} );

	// When the page is loaded, start a scan for connected devices
	$scope.checkDevices();

	// Method to download a firmware based on the device and version.
	// A callback is called once the download is completed indicated success or failure
	function downloadFirmware( device, version, callback ) {

		// The default URL to grab compiled firmware will be the Github repository
		var url = "https://raw.githubusercontent.com/salbahra/OpenSprinkler-FW-Updater/master/compiled-fw/" + device + "/firmware" + version + ".hex";

		// If the directory for the hardware type doesn't exist then create it
		if ( !fs.existsSync( "firmwares/" + device ) ) {
			fs.mkdirSync( "firmwares/" + device );
		}

		// Download the firmware
		$http.get( url ).then(
			function( response ) {

				// If successful then save the file
				fs.writeFile( "firmwares/" + device + "/" + version + ".hex", response.data, callback );
				console.log( "Downloaded firmware " + version + " for OpenSprinkler " + version + " successfully!" );
			},
			function( err ) {

				// Do nothing if download failed
				callback();
				console.log( "Downloaded failed for firmware " + version + " for OpenSprinkler " + version );
			}
		);
	}
} );

// Takes a list of ports and looks for an associated location.
// If a match is found, the corresponding port is returned otherwise false
function findPort( ports, location ) {
	var port;

	for ( port in ports ) {
		if ( ports.hasOwnProperty( port ) ) {
			if ( ports[port].indexOf( location ) !== -1 ) {
				return ports[port];
			}
		}
	}

	return false;
}

// Sorts firmware versions in a string format such as: 2.1.5.hex by collapsing
// the numbers into an integer and comparing them
function sortFirmwares( a, b ) {

	// Filter that matches version numbers that are decimal delimited, eg: 2.1.5
	var filter = /\d\.\d\.\d/g;

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
}

// Resolves the Month / Day / Year of a Date object
function toUSDate( date ) {
	return ( date.getMonth() + 1 ) + "/" + date.getDate() + "/" + date.getFullYear();
}
