#!/bin/bash
# Render build script with system dependencies

# Install system dependencies for Pillow and OpenCV
apt-get update && apt-get install -y \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libopenjp2-7-dev \
    libtiff-dev \
    libwebp-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libxcb1-dev \
    || echo "System packages not available, using defaults"

# Install Python packages
pip install --no-cache-dir --upgrade pip
pip install --no-cache-dir -r requirements.txt
