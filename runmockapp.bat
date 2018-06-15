REM start server
cd %~dp0
start cmd /k call runmockserver.bat
REM open app
cd %~dp0/win-unpacked
VTS-Play-Sim.exe
exit