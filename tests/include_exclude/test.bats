load ../test_setup.bash

teardown() {
	delete_package "test-ie-admin"
	delete_package "test-ie-printer"
	delete_web_content "test-ie"
}

@test "deploy project including web content" {
	run $NIM project deploy $BATS_TEST_DIRNAME --include web
	assert_success
	assert_output --partial 'Deployed 1 web content items'
	refute_output --partial 'test-ie-admin'
	refute_output --partial 'test-ie-printer'
}

@test "deploy project excluding folder " {
	run $NIM project deploy $BATS_TEST_DIRNAME --exclude test-ie-admin
	assert_success
	assert_output --partial 'Deployed 1 web content items'
	assert_output --partial 'test-ie-printer'
	refute_output --partial 'test-ie-admin'
}

@test "deploy project including folder " {
	run $NIM project deploy $BATS_TEST_DIRNAME --include test-ie-printer/notify
	assert_success
	assert_output --partial 'test-ie-printer/notify'
	refute_output --partial 'test-ie-printer/update'
	refute_output --partial 'test-ie-printer/list'
	refute_output --partial 'test-ie-printer/get'
	refute_output --partial 'test-ie-printer/create'
	refute_output --partial 'test-ie-admin'
	refute_output --partial 'Deployed 1 web content items'
}

@test "deploy project with multiple include/excludes" {
	run $NIM project deploy $BATS_TEST_DIRNAME --include test-ie-admin/,test-ie-printer,web --exclude test-ie-printer/notify,test-ie-printer/update
	assert_success
	assert_output --partial 'Deployed 1 web content items'
	assert_output --partial 'test-ie-admin'
	assert_output --partial 'test-ie-printer/get'
	assert_output --partial 'test-ie-printer/create'
	assert_output --partial 'test-ie-printer/list'
	refute_output --partial 'test-ie-printer/notify'
	refute_output --partial 'test-ie-printer/update'
}
