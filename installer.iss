[Setup]
AppName=SURA Developer Productivity Suite
AppVersion=2.0.0
DefaultDirName={autopf}\SURA
DefaultGroupName=SURA
OutputDir=D:\sura\installer_output
OutputBaseFilename=SURA_v2.0.0_Setup
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "D:\sura\dist\sura.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\SURA"; Filename: "{app}\sura.exe"
Name: "{autodesktop}\SURA"; Filename: "{app}\sura.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\sura.exe"; Description: "{cm:LaunchProgram,SURA}"; Flags: nowait postinstall skipifsilent