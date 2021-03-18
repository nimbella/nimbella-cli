SET BUILD="maven"

IF BUILD == "maven" THEN
   goto :mavenBuild 

:mavenBuild 
   mvn install
   @echo target/qr-1.0.0-jar-with-dependencies.jar > .include
   goto :eof
