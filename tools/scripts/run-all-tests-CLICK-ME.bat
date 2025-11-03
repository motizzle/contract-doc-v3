@echo off
:: This wrapper opens a persistent command window and runs the test script inside it
:: Double-click THIS file instead of run-all-tests.bat
start "Test Results" cmd /k "%~dp0run-all-tests.bat"

