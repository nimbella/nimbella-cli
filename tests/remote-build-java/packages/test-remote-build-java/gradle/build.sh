#!/bin/bash

set -e 

# set to 'maven' to use maven
# set to 'gradle' to use gradle
BUILD="gradle"

if [ $BUILD == "gradle" ]; then
    gradle jar
    echo build/libs/qr-java-1.0.jar > .include
else
    echo unknown builder
    exit -1
fi
