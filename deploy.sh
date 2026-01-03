#!/bin/bash

# Build script for deployment
# This builds the frontend and copies it to the backend for serving

echo "Building frontend..."
cd frontend
npm install
npm run build

echo "Copying frontend build to backend..."
rm -rf ../backend/static
cp -r dist ../backend/static

echo "Build complete! Ready for deployment."
echo ""
echo "The backend/static folder now contains the built frontend."
echo "Deploy the 'backend' folder to your hosting provider."
