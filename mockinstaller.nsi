; version specification
!define PRODUCT_NAME "Mock Assessment App"
!define PRODUCT_VERSION "1.0"

; name the installer
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "mock-app-installer.exe"

; the default installation directory
InstallDir $PROGRAMFILES\MockAssessment

; install section
Section "Install"
	; set directory for python to be installed in
	SetOutPath $INSTDIR
	; install batch files to run application and server
	File runapp.bat
	File runserver.bat
	; install python server file
	File server.py
	; install python and dependencies
	File /r "Python36"
	; install necessary files
	File /r "win-unpacked"
	; start server for initial run
	Exec runserver.bat
	; run application installer
	Exec VTS-Play-Sim-Setup-1.0.0.exe
	
	; create start menu and desktop shortcuts
	CreateDirectory "$SMPROGRAMS\VTS Assessment"
	CreateShortCut "$SMPROGRAMS\VTS Assessment\VTS Assessment App.lnk" "$INSTDIR\runapp.bat"
SectionEnd

; uninstall section