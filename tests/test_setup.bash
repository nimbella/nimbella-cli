load "./node_modules/bats-support/load.bash"
load "./node_modules/bats-assert/load.bash"
load "./node_modules/bats-file/load.bash"

if [ -z "$NIM" ]; then
	NIM=$BATS_TEST_DIRNAME/../../bin/run
fi

# Utility function to clear our all package resources.
# Turns into no-op if no resources are available in that package.
delete_package() {
	for action in $($NIM action list | grep -o "$1.*"); do
		nim action delete $action
	done
	for package in $($NIM package list | grep -o "$1.*"); do
		nim package delete $package
	done
}

delete_web_content() {
	for web in $($NIM web list | grep -o "$1.*"); do
		nim web delete $web
	done
}

test_binary_action() {
	run $NIM action invoke $1 -f
	assert_success
	assert_output --partial '"status": "success"'
	assert_output --partial $2

	run $NIM action get $1
	assert_success
	assert_output --partial '"binary": true'
}
