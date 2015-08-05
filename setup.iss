#define LaunchProgram "Start OpenSprinkler Updater program"
#define DesktopIcon "Create shortcut on the desktop"
#define CreateDesktopIcon "Do you want to create a desktop shortcut?"

[Setup]
AppName = OpenSprinkler Updater
AppVerName = OpenSprinkler Updater 1.0.0
AppPublisher = OpenSprinkler
AppPublisherURL = https://opensprinkler.com
AppVersion = 1.0.0
DefaultDirName = {pf}\OpenSprinkler\OpenSprinkler Updater
DefaultGroupName = OpenSprinkler
Compression = lzma
SolidCompression = yes
OutputDir=..\

[Files]
Source: "build\OpenSprinkler Updater\win32\*"; DestDir: "{app}"; Flags: replacesameversion recursesubdirs createallsubdirs

[Tasks]
Name: "desktopicon"; Description: "{#CreateDesktopIcon}"; GroupDescription: "{#DesktopIcon}"

[Icons]
Name: "{group}\OpenSprinkler Updater"; Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"
Name: "{userstartup}\OpenSprinkler Updater"; Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"
Name: "{userdesktop}\OpenSprinkler Updater"; Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{group}\Uninstall OpenSprinkler Updater"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\OpenSprinkler Updater.exe"; WorkingDir: "{app}"; Description: {#LaunchProgram}; Flags: postinstall shellexec
