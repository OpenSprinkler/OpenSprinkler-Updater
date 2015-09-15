#define LaunchProgram "Start OpenSprinkler Updater program"
#define DesktopIcon "Create shortcut on the desktop"
#define CreateDesktopIcon "Do you want to create a desktop shortcut?"
#define DriverInstall "Install OpenSprinkler Hardware Driver"
#define DriverInstallMsg "Do you want to install the OpenSprinkler hardware driver?"

[Setup]
AppName = OpenSprinkler Updater
AppVerName = OpenSprinkler Updater 1.0.2
AppPublisher = OpenSprinkler
AppPublisherURL = https://opensprinkler.com
AppVersion = 1.0.2
DefaultDirName = {pf}\OpenSprinkler\OpenSprinkler Updater
DefaultGroupName = OpenSprinkler
Compression = lzma
SolidCompression = yes
OutputDir=build\
OutputBaseFilename=OpenSprinkler-Updater

[Files]
Source: "build\OpenSprinkler Updater\win32\*"; DestDir: "{app}"; Flags: replacesameversion recursesubdirs createallsubdirs
Source: "drivers\win.exe"; DestDir: "{app}"; Flags: replacesameversion

[Tasks]
Name: "driverinstall"; Description: "{#DriverInstallMsg}"; GroupDescription: "{#DriverInstall}"
Name: "desktopicon"; Description: "{#CreateDesktopIcon}"; GroupDescription: "{#DesktopIcon}"

[Icons]
Name: "{group}\OpenSprinkler Updater"; Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"
Name: "{userstartup}\OpenSprinkler Updater"; Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"
Name: "{userdesktop}\OpenSprinkler Updater"; Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{group}\Uninstall OpenSprinkler Updater"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\win.exe"; Parameters: "/silent"; Flags: "runhidden"; Tasks: driverinstall
Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"; Description: {#LaunchProgram}; Flags: postinstall shellexec
