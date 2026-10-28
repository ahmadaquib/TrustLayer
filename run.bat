@echo off
echo ======================================================================
echo Starting TrustLayer Unified System (Backend + Frontend)
echo ======================================================================

echo [1/2] Building Frontend SPA...
cd frontend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed.
    exit /b %ERRORLEVEL%
)
cd ..

echo [2/2] Starting FastAPI Server (Serving API and Frontend Dashboard)...
echo Dashboard available at: http://localhost:8000
echo API Documentation at:   http://localhost:8000/docs
echo.
cd backend
uv run uvicorn trustlayer.main:app --reload --port 8000

