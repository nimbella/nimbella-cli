SET BUILD="gradle"

IF BUILD == "gradle"  THEN
        goto :gradleBuild 
    ELSE 
        echo Unknown Build

:gradleBuild 
   gradlew jar
   @echo build/libs/gradle-1.0.jar > .include
   goto :eof
