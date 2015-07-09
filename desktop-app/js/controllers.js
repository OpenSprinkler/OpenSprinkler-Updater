var exec = require( "child_process" ).exec,
	async = require( "async" ),
	fs = require( "fs" ),

	// Define Github directory to use for firmware download
	githubFW = "https://raw.githubusercontent.com/OpenSprinkler/OpenSprinkler-Compiled-Firmware/master/",

	// Define Github API endpoint to request latest firmware release
	githubRelease = "https://api.github.com/repos/OpenSprinkler/OpenSprinkler-Firmware/releases",

	// Github API endpoint to request available firmware versions
	githubAPI = "https://api.github.com/repos/opensprinkler/OpenSprinkler-Compiled-Firmware/contents/",

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
				id: /0x1e96/g,
				command: "-c usbtiny -p m644 "
			},
			"v2.1": {
				id: /0x1e96/g,
				command: "-c usbasp -p m644 "
			},
			"v2.2": {
				id: /0x1e96/g,

				// Indicates a serial port must be specified to interface with this device
				usePort: true,
				command: "-c arduino -p m644p -b 115200 "
			},
			"v2.3": {
				id: /0x1e97/g,
				usePort: true,
				command: "-c arduino -p m1284p -b 115200 "
			}
		},

		// Default platform is Linux unless otherwise detected below
		platform = "linux",

		// Define the actual scan subroutine which run for each possibly detected device
		scanQueue = async.queue( function( task, callback ) {

			var device = deviceList[task.type],

				// Assign the signature filter to be used for scanning purposes
				filter = task.filter || device.id,

				// Generate command to probe for device version
				command = commandPrefix[platform] + ( device.usePort && task.port ? "-P " + task.port + " " : "" ) + device.command;

			// Execute the AVRDUDE command and parse the reply
			exec( command, { timeout: 3000 }, function( error, stdout, stderr ) {
				stdout = stdout || stderr;

				console.log( "Command: " + command, device, stdout );

				var matches = stdout.match( filter ),
					matchFound;

				// Check the device signature against the associated ID
				if ( stdout.indexOf( "Device signature = " ) !== -1 && matches ) {
					matchFound = matches[0];
				} else if ( stdout.indexOf( "Operation not permitted" ) !== -1 && platform === "linux" ) {
					$ionicPopup.alert( {
						title: "OpenSprinkler Updater Permissions",
						template: "<p class='center'>USB access on Linux requires root permission. Please re-run the application using sudo.</p>"
					} );
				} else if ( !matchFound && platform === "win" && ( task.type === "v2.0" || task.type === "v2.1" ) ) {
					$ionicPopup.alert( {
						title: "OpenSprinkler Drivers",
						template: "<p class='center'>OpenSprinkler v2.0 has been detected on your system however the required drivers are not installed." +
							"You may install them by following this link: <a href='http://raysfiles.com/drivers/zadig.zip'>http://raysfiles.com/drivers/zadig.zip</a>.</p>"
					} );
				} else if ( !matchFound && platform === "osx" && ( task.type === "v2.2" ) ) {
					if ( platform === "osx" ) {
						$ionicPopup.alert( {
							title: "OpenSprinkler Drivers",
							template: "<p class='center'>OpenSprinkler v2.2 or newer has been detected on your system however the required drivers are not installed." +
								"You may install them by following this link: <a href='http://raysfiles.com/drivers/ch341ser_mac.zip'>http://raysfiles.com/drivers/ch341ser_mac.zip</a>.</p>"
						} );
					}
				}

				// Delay the next scan by 200 milliseconds to avoid error accessing serial ports
				setTimeout( function() {
					callback( matchFound, task.port );
				}, 200 );
			} );
		} );

	// Clean up the page after the scan queue is complete
	scanQueue.drain = cleanUp;

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
				parseDevices( data.devices, data.ports );
			} );
		} else if ( platform === "linux" ) {

			// Handle serial port scan for Linux platform by running shell script
			// which parses the /sys/bus/usb/devices path for connected devices
			exec( "./avr/serial.linux.sh", { timeout: 1000 }, function( error, stdout ) {
				parseDevices( stdout.split( "\n" ), null );
			} );
		} else if ( platform === "win" ) {
			exec( "wmic path win32_pnpentity get caption, deviceid /format:csv", { timeout: 1000 }, function( error, stdout, stderr ) {
				parseDevices( stdout.split( "\n" ), null );
			} );
		}
	};

	// Method to handle the update process for OpenSprinkler
	$scope.updateAction = function( type, port ) {

		// Define the actual update subroutine which will run after the confirmation to continue
		var update = function( version ) {

				// Disable the page buttons and update the status text
				$scope.updateLog = "";
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

							// If no file is defined then do not attempt to update but instead just fail
							callback( null, { status: false } );
							return;
						}

						// Define the command to be used for updating
						var command = commandPrefix[platform] +
								( deviceList[type].usePort && port ? "-P " + port + " " : "" ) +
								deviceList[type].command + " -q -F -U flash:w:" + "firmwares/" + type + "/" + file;

						// Update buttons to indicate download complete and the updating has starting
						$scope.button.text = "Flashing firmware " + version + " on OpenSprinkler " + type + "...";
						$scope.$apply();

						// Execute the AVRDUDE update process and process the result
						exec( command, function( error, stdout, stderr ) {
							stdout = stdout || stderr;

							// At the end of the AVRDUDE command, the flash memory is verified and if successful a message indicating so is displayed
							// Check for that message as a means to verify the update was successful
							var result = stdout.indexOf( "verified" ) === -1 ? false : true;

							if ( !result ) {

								// If the update failed, load the log into the page for the user to see
								$scope.updateLog = "<pre>" + stdout.replace( "\n", "<br>" ) + "</pre>";
							}

							// Return the result to the final callback handler
							callback( null, result );

							console.log( "OpenSprinkler " + type + " firmware " + version + " install " + ( result ? "succeeded" : "failed" ) );
						} );
					}
				}, function( err, results ) {

					// Process results once the download and update process has completed. If the status was successful indicate so to the user.
					if ( results.status ) {
						$ionicPopup.alert( {
							title: "OpenSprinkler " + type + " Update",
							template: "<p class='center'>The firmware update was successful and the device is rebooting. Please note the device will be restored to its factory settings.</p>"
						} );
					} else {

						// Otherwise, let the user know it failed
						$ionicPopup.alert( {
							title: "OpenSprinkler " + type + " Update",
							template: "<p class='center'>The firmware update was <strong>NOT</strong> successful.<br><br>" +
							"Please review the log output and try again or <a target='_blank' href='https://support.opensprinkler.com'>contact support</a> if you continue to have problems.</p>"
						} );
					}

					// Clean up the page buttons after update completion
					cleanUp();
				} );
			},
			confirmUpdate = function( versions ) {

				// Ensure the user intended to proceed with the firmware update which will erase current settings on the device
				confirmPopup = $ionicPopup.confirm( {
					title: "OpenSprinkler " + type + " Update",
					scope: $scope,
					cssClass: "wide",
					template: "<div class='center'>Please note the device will be restored to it's default settings during the update so please make sure you already have a backup.<br><br>" +
						"<div class='list' style='padding-bottom:10px'>" +
							"<label class='item item-input item-select'>" +
								"<div class='input-label'>" +
									"Firmware" +
								"</div>" +
								"<select ng-init='fwv = \"" + ( $scope.selectedFirmware || $scope.latestRelease.name ) + "\"' ng-model='fwv' ng-change='changeFirmwareSelection(fwv)'>" + versions + "</select>" +
							"</label>" +
						"</div>" +
						"Are you sure you want to update OpenSprinkler " + type + "?</div>"
				} ).then( function( result ) {
					if ( result ) {
						update( $scope.selectedFirmware || $scope.latestRelease.name );
					}
				} );
			},
			file, start;

		getAvailableFirmwares( type, function( versions ) {
			var html = "",
				version;

			for ( version in versions ) {
				if ( versions.hasOwnProperty( version ) ) {
					html += "<option " + ( versions[version].isLatest ? "selected='selected' " : "" ) +
						"value='" + versions[version].version + "'>" + versions[version].version + ( versions[version].isLatest ? " (Latest)" : "" ) + "</option>";
				}
			}

			confirmUpdate( html );
		} );
	};

	$scope.changeFirmwareSelection = function( fwv ) {
		$scope.selectedFirmware = fwv;
	};

	// Method to show the change log in a popup to the user
	$scope.showChangelog = function() {
		$ionicPopup.alert( {
			title: "Firmware " + $scope.latestRelease.name + " Changelog",
			template: $scope.latestRelease.changeLog,
			cssClass: "wide"
		} );
	};

	// Github API to get releases for OpenSprinkler firmware
	$http.get( githubRelease ).then( function( releases ) {

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

		// If the platform is Linux, set AVRDUDE permissions to executable.
		// This is done because the permissions may not be preserved due to the packaging method
		// and as a result will not run in distribution. OS X does not compress the files therefore
		// this issue is not encountered.
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
				var name, file;

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
				console.log( "Downloaded firmware " + version + " for OpenSprinkler " + device + " successfully!" );
			},
			function( err ) {

				// Do nothing if download failed
				networkFail();
				console.log( "Downloaded failed for firmware " + version + " for OpenSprinkler " + device );
			}
		);
	}

	// Handle reply after both commands have completed
	function parseDevices( devices, ports ) {

		var usePortFilter = makeUsePortFilter(),

			// Defines the total number of scans initiated
			scanTotal = 0,
			item, pid, vid, port, device;

		// Parse every USB devices detected
		for ( device in devices ) {
			if ( devices.hasOwnProperty( device ) ) {

				if ( platform === "osx" ) {

					// Each reply is delimited by a colon and contains: VID::PID::Location
					// Location correlates with the serial port location and is used to confirm the association
					item = devices[device].split( ":" );

					vid = item[0] ? item[0].match( /^0x([\d|\w]+)$/ ) : "";
					if ( vid ) {
						vid = vid[1].toLowerCase();
					}

					pid = item[1] ? item[1].match( /^0x([\d|\w]+)$/ ) : "";
					if ( pid ) {
						pid = pid[1].toLowerCase();
					}

					port = item[2] ? item[2].split( "/" ) : "";
					if ( port.length ) {
						port = port[0].trim().replace( /^0x([\d\w]+)$/, "$1" ).substr( 0, 4 );
						port = findPort( ports, port );
					}

				} else if ( platform === "linux" ) {

					// The script returns each detected device in a double colon delimited value
					// which is in the following format: Location::VID::PID
					item = devices[device].split( "::" );
					pid = item[2] ? item[2].toLowerCase() : "";
					vid = item[1] ? item[1].toLowerCase() : "";
					port = item[0];

				} else if ( platform === "win" ) {

					// The script returns each detected device in a comma delimited value
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

					port = item[1] ? item[1].match( /COM(\d+)/i ) : "";
					if ( port ) {
						port = port[0];
					}
				}

				// Match OpenSprinkler v2.0 PID and VID and flag it for missing driver if no response from AVRDUDE
				if ( vid === "1781" && pid === "0c9f" ) {
					scanQueue.push( { type: "v2.0" }, addDevice );
					scanTotal++;
				}

				// Match OpenSprinkler v2.1 PID and VID and add it to the detected list since no scanning is needed
				if ( vid === "16c0" && pid === "05dc" ) {
					console.log( "Found OpenSprinkler v2.1" );

					$scope.deviceList.push( {
						type: "v2.1"
					} );
				}

				// Detected hardware v2.2 or v2.3 and correlate the port value to the location
				if ( vid === "1a86" && pid === "7523" ) {
					console.log( "Found a possible match located at: " + port );

					scanQueue.push( { type: "v2.2", filter: usePortFilter, port: port }, addDevice );
					scanTotal++;
				}
			}
		}

		if ( scanTotal === 0 ) {
			cleanUp();
		}
	}

	function addDevice( result, port ) {

		if ( !result ) {
			return;
		}

		// Get version from the returned device signature
		var version = getMatchVersion( result, ( port ? true : false ) );

		if ( version ) {

			// Push the device to the detected list
			$scope.deviceList.push( {
				type: version,
				port: port
			} );

			console.log( "Found OpenSprinkler " + version + ( port ? " on port " + port : "" ) );
		}
	}

	// Method to scan all available devices and create a regex to match them all
	function makeUsePortFilter() {
		var regex = [],
			device;

		for ( device in deviceList ) {
			if ( deviceList.hasOwnProperty( device ) && deviceList[device].usePort === true ) {
				regex.push( new RegExp( deviceList[device].id ).source );
			}
		}

		return new RegExp( "(" + regex.join( "|" ) + ")" );
	}

	function getMatchVersion( result, usePort ) {
		var device;
		for ( device in deviceList ) {
			/*jshint -W018 */
			if ( deviceList.hasOwnProperty( device ) && new RegExp( deviceList[device].id ).source === result && !!deviceList[device].usePort === usePort ) {
				return device;
			}
			/*jshint +W018 */
		}

		return false;
	}

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
