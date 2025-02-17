#!/bin/bash

# Define the packages path variable
common_path="./python/lib/python3.12/site-packages"

# Step 1: Create the directory structure
echo "Creating directory structure"
mkdir -p $common_path

# Step 2: Install dependencies in a virtual environment and generate requirements.txt
echo "Installing dependencies and generating requirements.txt"
pipenv install
pipenv run pip freeze > $common_path/requirements.txt

# Step 3: Fetch the required libraries using the generated requirements.txt
echo "Fetching libraries"
pipenv run pip install -r $common_path/requirements.txt --target $common_path

# Step 4: Copy the source code to the site-packages directory
echo "Copying source code to the site-packages directory"
cp -r src/*.py $common_path

# Step 5: List the contents of the site-packages directory
echo "Contents of the site-packages directory:"
ls -ltrh $common_path