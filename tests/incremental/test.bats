load ../test_setup.bash

setup_file() {
	rm -rf $BATS_TEST_DIRNAME/test-project/*
	cp -r $BATS_TEST_DIRNAME/test-resources/example/* $BATS_TEST_DIRNAME/test-project
	$NIM project deploy $BATS_TEST_DIRNAME/test-project
}

teardown_file() {
	rm -rf $BATS_TEST_DIRNAME/test-project/*
	delete_package "incremental"
}

patch_project () {
	patch -p1 -d $BATS_TEST_DIRNAME/test-project < $BATS_TEST_DIRNAME/test-resources/$1.patch
}

@test "deploy project incrementally with no changes" {
	run $NIM project deploy $BATS_TEST_DIRNAME/test-project --incremental
	assert_success
	assert_line "Skipped 5 unchanged actions"
	assert_line "Skipped 1 unchanged web resources"
}

@test "deploy project incrementally with action changes" {
	patch_project "change-actions"

	run $NIM project deploy $BATS_TEST_DIRNAME/test-project --incremental
	assert_success
	assert_line "Skipped 3 unchanged actions"
	assert_line "Skipped 1 unchanged web resources"
	assert_line "  - incremental/action3"
	assert_line "  - incremental/action4"
}

@test "deploy project incrementally with metadata & web changes" {
	patch_project "change-metadata-and-web"

	run $NIM project deploy $BATS_TEST_DIRNAME/test-project --incremental
	assert_success
	assert_line "Skipped 3 unchanged actions"
	assert_line "Deployed 1 web content items to"
	assert_line "  - incremental/action1"
	assert_line "  - incremental/action2"
}

@test "deploy project incrementally with include changes" {
	patch_project "change-include-file"

	run $NIM project deploy $BATS_TEST_DIRNAME/test-project --incremental
	assert_success
	assert_line "Skipped 4 unchanged actions"
	assert_line "Skipped 1 unchanged web resources"
	assert_line "  - incremental/action5"
}
