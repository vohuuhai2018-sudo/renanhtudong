@echo off
echo Dang cap nhat code vao file EXE (Bản Sạch v3)... 
taskkill /F /IM "Son Hai AI Render.exe" /T >nul 2>&1

REM 1. Build code moi nhat
call npm run build

REM 2. Tao thu muc tam de dong goi sach
if exist temp_package rmdir /S /Q temp_package
mkdir temp_package
xcopy /E /I out temp_package\out
copy package.json temp_package\

REM 3. Cai dat thu vien production vao thu muc tam
cd temp_package
call npm install --omit=dev
cd ..

REM 4. Dong goi tu thu muc tam
call npx electron-packager temp_package "Son Hai AI Render" --platform=win32 --arch=x64 --out=release_v3 --overwrite

REM 5. Don dep
rmdir /S /Q temp_package

echo ========================================
echo Cap nhat xong! Dang mo Tool...
start "" "release_v3\Son Hai AI Render-win32-x64\Son Hai AI Render.exe"
exit
