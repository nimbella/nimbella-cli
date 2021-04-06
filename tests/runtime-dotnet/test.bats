load ../test_setup.bash

setup_file() {
	$NIM project deploy $BATS_TEST_DIRNAME
}

teardown_file() {
	delete_package "test_dotnet_runtime"
}

@test "can execute actions using dotnet runtime" {
	run $NIM project deploy $BATS_TEST_DIRNAME
	run $NIM action invoke test_dotnet_runtime/hello
	assert_success
	assert_output --partial '"greeting": "Hello, stranger!"'
}
