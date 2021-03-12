load '/usr/local/lib/bats-support/load.bash'
load '/usr/local/lib/bats-assert/load.bash'
load '/usr/local/lib/bats-file/load.bash'

if [ -z "$NIM" ]; then
	NIM=$BATS_TEST_DIRNAME/../../bin/run
fi
