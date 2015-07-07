var exec = require( "child_process" ).exec,
	async = require( "async" ),
	fs = require( "fs" ),

	// Define Github directory to use for firmware download
	githubFW = "https://raw.githubusercontent.com/salbahra/OpenSprinkler-FW-Updater/master/compiled-fw/",

	// Github API endpoint to request available firmware versions
	githubAPI = "https://api.github.com/repositories/38519612/contents/compiled-fw/",

	// Define regex to match dot seperated release name, eg: 2.1.5
	releaseNameFilter = /\d\.\d\.\d/g;

angular.module( "os-updater.controllers", [] )

.controller( "HomeCtrl", function( $scope, $ionicPopup, $http ) {

	var cwd = process.cwd(),
		arch = process.arch === "x64" ? "64" : "32",

		// Defines the base command to AVRDUDE per platform
		commandPrefix = {
			win: cwd + "\\avr\\win\\avrdude.exe -C " + cwd + "\\avr\\win\\avrdude.conf ",
			osx: cwd + "/avr/osx/avrdude -C " + cwd + "/avr/osx/avrdude.conf ",
			linux: cwd + "/avr/linux" + arch + "/avrdude -C " + cwd + "/avr/linux" + arch + "/avrdude.conf "
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

		// Flag to determine if the USB device is plugged in without drivers being installed
		is20Connected = false,

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
		var deviceFound = false;

		// Begin scanning for available serial ports
		if ( platform === "osx" ) {

			// For OS X, two commands are needed.
			async.parallel( {

				// The first command will list all Call-Up serial ports
				ports: function( callback ) {
					exec( "ls /dev/cu.*", { timeout: 1000 }, function( error, stdout, stderr ) {

						// Return the list delimited by line return
						callback( null, stdout.split( "\n" ) );
					} );
				},

				// The second command requests the USB informatin from system_profiler (command in bash script)
				devices: function( callback ) {
					exec( "avr/serial.osx.sh", { timeout: 1000 }, function( error, stdout, stderr ) {

						// Return the list delimited by line return
						callback( null, stdout.split( "\n" ) );
					} );
				}
			}, function( err, data ) {
				parseDevices( data.devices, data.ports, scan );
			} );
		} else if ( platform === "linux" ) {

			// Handle serial port scan for Linux platform by running shell script
			// which parses the /sys/bus/usb/devices path for connected devices
			exec( "./avr/serial.linux.sh", { timeout: 1000 }, function( error, stdout ) {
				parseDevices( stdout.split( "\n" ), null, scan );
			} );
		} else if ( platform === "win" ) {
			exec( "wmic path win32_pnpentity get caption, deviceid /format:csv", { timeout: 1000 }, function( error, stdout, stderr ) {
				parseDevices( stdout.split( "\n" ), null, scan );
			} );
		}
	};

	// Method to handle the update process for OpenSprinkler
	$scope.updateAction = function( type ) {

		// Define the actual update subroutine which will run after the confirmation to continue
		var update = function( version ) {

				// Disable the page buttons and update the status text
				$scope.upgradeLog = "";
				$scope.button.disabled = true;
				$scope.button.text = "Updating OpenSprinkler " + type + "...";

				// Run the download process to first grab the required file then subsequently update the device
				async.series( {
					download: function( callback ) {

						$scope.button.text = "Downloading firmware " + version + "...";
						file = version + ".hex";
						downloadFirmware( type, version, callback );
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
			confirmUpdate = function( versions ) {

				// Ensure the user intended to proceed with the firmware upgrade which will erase current settings on the device
				confirmPopup = $ionicPopup.confirm( {
					title: "Upgrade OpenSprinkler " + type,
					scope: $scope,
					template: "<div class='center'>Please note the device will be restored to it's default settings during the update so please make sure you already have a backup.<br><br>" +
						"<div class='list' style='padding-bottom:10px'>" +
							"<label class='item item-input item-select'>" +
								"<div class='input-label'>" +
									"Firmware" +
								"</div>" +
								"<select ng-init='selectedFirmware = latestRelease.name' ng-model='selectedFirmware' ng-change='changeFirmwareSelection(selectedFirmware)'>" + versions + "</select>" +
							"</label>" +
						"</div>" +
						"Are you sure you want to upgrade OpenSprinkler " + type + "?</div>"
				} ).then( function( result ) {
					if ( result ) {
						update( $scope.selectedFirmware );
					}
				} );
			},
			file, start;

		getAvailableFirmwares( type, function( versions ) {
			var html = "";

			for ( version in versions ) {
				if ( versions.hasOwnProperty( version ) ) {
					html += "<option " + ( versions[version].isLatest ? "selected='selected' " : "" ) +
						"value='" + versions[version].version + "'>" + versions[version].version + ( versions[version].isLatest ? " (Latest)" : "" ) + "</option>";
				}
			}

			confirmUpdate( html );
		} );
	};

	$scope.changeFirmwareSelection = function( now ) {
		$scope.selectedFirmware = now;
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
	$http.get( "https://api.github.com/repos/opensprinkler/opensprinkler-firmware/releases" ).then( function( releases ) {

		var line;

		releases = releases.data;

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

	}, networkFail );

	// When the page is loaded, start a scan for connected devices
	if ( platform === "linux" ) {

		var command = "chmod a+x " + cwd + "/avr/linux" + arch + "/avrdude " + cwd + "/avr/serial.linux.sh";

		// If the platform is Linux, set AVRDUDE permissions to executable
		exec( command, { timeout: 1000 }, $scope.checkDevices );
	} else {
		$scope.checkDevices();
	}

	// Method to query Github for all available firmware versions for a particular device type
	function getAvailableFirmwares( device, callback ) {
		var fileList = [];

		// Download the firmware
		$http.get( githubAPI + device ).then(
			function( files ) {
				var name;

				for ( file in files.data ) {
					if ( files.data.hasOwnProperty( file ) ) {
						name = files.data[file].name.match( releaseNameFilter );

						if ( name && files.data[file].type === "file" ) {
							fileList.push( {
								version: name[0],
								isLatest: name[0] === $scope.latestRelease.name
							} );
						}
					}
				}

				callback( fileList.reverse() );
			}, networkFail );
	}

	// Method to download a firmware based on the device and version.
	// A callback is called once the download is completed indicated success or failure
	function downloadFirmware( device, version, callback ) {

		// The default URL to grab compiled firmware will be the Github repository
		var url = githubFW + device + "/firmware" + version + ".hex";

		// If the directory for the hardware type doesn't exist then create it
		if ( !fs.existsSync( cwd + "/firmwares" ) ) {
			fs.mkdirSync( cwd + "/firmwares" );
		}

		if ( !fs.existsSync( cwd + "/firmwares/" + device ) ) {
			fs.mkdirSync( cwd + "/firmwares/" + device );
		}

		// Download the firmware
		$http.get( url ).then(
			function( response ) {

				// If successful then save the file
				fs.writeFile( cwd + "/firmwares/" + device + "/" + version + ".hex", response.data, callback );
				console.log( "Downloaded firmware " + version + " for OpenSprinkler " + version + " successfully!" );
			},
			function( err ) {

				// Do nothing if download failed
				networkFail();
				console.log( "Downloaded failed for firmware " + version + " for OpenSprinkler " + version );
			}
		);
	}

	// Define the actual scan subroutine which runs after all serial ports are scanned
	function scan() {

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
				exec( command, { timeout: 3000 }, function( error, stdout, stderr ) {
					stdout = stdout || stderr;

					console.log( "Command: " + command, device, stdout );

					// Check the device signature against the associated ID
					if ( stdout.indexOf( "Device signature = " ) !== -1 && regex.test( stdout ) ) {

						console.log( "Found OpenSprinkler " + key );

						// Push the device to the detected list
						$scope.deviceList.push( {
							type: key
						} );
					} else if ( stdout.indexOf( "Operation not permitted" ) !== -1 && platform === "linux" ) {
						$ionicPopup.alert( {
							title: "OpenSprinkler Updater Permissions",
							template: "<p class='center'>USB access on Linux required root permissions. Please re-run the application using sudo.</p>"
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

			if ( is20Connected && !$scope.deviceList.length ) {
				$ionicPopup.alert( {
					title: "OpenSprinkler v2.0 Drivers",
					template: "<p class='center'>OpenSprinkler v2.0 has been detected on your system however the required drivers are not installed." +
						"You may install them by following this link: <a target='_blank' href='http://zadig.akeo.ie/'>http://zadig.akeo.ie/</a>.</p>"
				} );
			}

			// Restore button state
			cleanUp();
		} );
	};

	function parseDevices( devices, ports, callback ) {

		// Handle reply after both commands have completed
		var item, pid, vid, location, device;

		// Reset v2.0 detection flag
		is20Connected = false;

		// Parse every USB devices detected
		for ( device in devices ) {
			if ( devices.hasOwnProperty( device ) ) {

				if ( platform === "osx" ) {

					// Each reply is delimited by a colon and contains: PID::VID::Location
					// Location coorelates with the serial port location and is used to confirm the association
					item = devices[device].split( ":" );

					pid = item[0] ? item[0].match( /^0x([\d|\w]+)$/ ) : "";
					if ( pid ) {
						pid = pid[1].toLowerCase();
					}

					vid = item[1] ? item[1].match( /^0x([\d|\w]+)$/ ) : "";
					if ( vid ) {
						vid = vid[1].toLowerCase();
					}

					location = item[2] ? item[2].split( "/" ) : "";
					if ( location.length ) {
						location = location[0].trim().replace( /^0x([\d\w]+)$/, "$1" ).substr( 0, 4 );
						location = findPort( ports, location );
					}

				} else if ( platform === "linux" ) {

					// The script returns each detected device is a double colon delimited value
					// which is in the following format: Location::PID::VID
					item = devices[device].split( "::" );
					pid = item[1] ? item[1].toLowerCase() : "";
					vid = item[2] ? item[2].toLowerCase() : "";
					location = item[0];

				} else if ( platform === "win" ) {

					// The script returns each detected device is a comma delimited value
					// which is in the following format: Platform,Device Name,Device PID/VID
					item = devices[device].split( "," );
					pid = item[2] ? item[2].match( /pid_([\d\w]+)/i ) : "";
					if ( pid ) {
						pid = pid[1].toLowerCase();
					}

					vid = item[2] ? item[2].match( /vid_([\d\w]+)/i ) : "";
					if ( vid ) {
						vid = vid[1].toLowerCase();
					}

					location = item[1] ? item[1].match( /COM(\d+)/i ) : "";
					if ( location ) {
						location = location[0];
					}
				}

				// Match OpenSprinkler v2.0 PID and VID and flag it for missing driver if no response from AVRDUDE
				if ( pid === "0c9f" && vid === "1781" ) {
					console.log( "Found OpenSprinkler v2.0" );

					is20Connected = true;
				}

				// Match OpenSprinkler v2.1 PID and VID and add it to the detected list since no scanning is needed
				if ( pid === "16c0" && vid === "05dc" ) {
					console.log( "Found OpenSprinkler v2.1" );

					$scope.deviceList.push( {
						type: "v2.1"
					} );
				}

				// Detected hardware v2.2 or v2.3 and coorelate the port value to the location
				if ( pid === "1a86" && vid === "7523" ) {
					port = location;
					console.log( "Found a match at: " + port );

				}
			}
		}

		callback();
	};

	function cleanUp() {
		setTimeout( function() {

			// Restore the buttons to their default state
			$scope.button.text = "Check for new devices";
			$scope.button.disabled = false;
			$scope.$apply();
		}, 500 );
	}

	function networkFail() {
		console.log( "Network failure..." );
	}

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
	    a = parseInt( a.match( releaseNameFilter )[0].replace( /\./g, "" ) );
	    b = parseInt( b.match( releaseNameFilter )[0].replace( /\./g, "" ) );
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
} );
