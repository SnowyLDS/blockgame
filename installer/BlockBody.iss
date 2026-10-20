; 블록 바디 설치 파일 스크립트 (Inno Setup 6)
;  만들기: installer\build.ps1 실행  →  installer\output\BlockBody-Setup.exe
;  버전을 올릴 때는 아래 AppVersion 만 바꾸면 됩니다.

#define AppName "블록 바디"
#define AppVersion "0.1.0"
#define AppId "{{6A1F3C2E-8B7D-4E5A-9C3B-B10C4B0D1E01}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Block Body
DefaultDirName={autopf}\BlockBody
DefaultGroupName={#AppName}
; 설치 경로 선택 화면 보이기
DisableDirPage=no
DisableProgramGroupPage=yes
; 관리자 권한 없이도 설치 가능 (설치 시 "나만 / 모든 사용자" 선택)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=output
OutputBaseFilename=BlockBody-Setup
SetupIconFile=..\launcher\icon.ico
UninstallDisplayIcon={app}\icon.ico
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 만들기"; GroupDescription: "바로가기:"

[Files]
; 게임 파일
Source: "..\index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\style.css"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "ui_original\*,*_template.png,README.md"
; 실행기
Source: "..\launcher\BlockBody.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\launcher\BlockBody.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\launcher\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\BlockBody.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
Name: "{group}\{#AppName} 제거"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\BlockBody.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\BlockBody.vbs"""; Description: "지금 게임 시작하기"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
; 게임 창이 쓰던 저장 데이터(설정 등)도 같이 지움
Type: filesandordirs; Name: "{localappdata}\BlockBody"
