load ../test_setup.bash

# Function will block until text argument ($1) is seen in input
# stream from the watcher.output file.
wait_for() {
 	grep -Eq $1 <(tail -f -n0 $BATS_TEST_DIRNAME/watcher.output)
}

setup_file() {
	# Remove any previous project files - otherwise project create won't succeed.
	find $BATS_TEST_DIRNAME/watched -mindepth 1 -delete
	$NIM project create $BATS_TEST_DIRNAME/watched
	# Start project watch as a background process & re-direct output to file
	$NIM project watch $BATS_TEST_DIRNAME/watched > $BATS_TEST_DIRNAME/watcher.output &
	export BG_PID=$!
	# Wait for log message telling us that watch is being performed
	wait_for "Watching"
}

teardown_file() {
	# Kill the background process nicely - otherwise the test framework
	# complains about terminated sub-processes
	kill -INT $BG_PID
	# BUG: There's a random orphaned tail process still running after the test finishes.
	# This stops the test from finishing. It's not clear why this is still running - as 
	# the wait_for functions have all returned.
	# WORKAROUND: Kill the orphaned process manually.
	kill $(pgrep -f watcher)
}

@test "watch for project changes that trigger a build" {
	sleep 1
	# Touch a file to trigger a build
	touch $BATS_TEST_DIRNAME/watched/packages/default/hello.js
	wait_for "Resuming watch"

	sleep 1
  # Add a file to a new directory (will trigger a second build)
	mkdir $BATS_TEST_DIRNAME/watched/packages/default/hello2
  touch $BATS_TEST_DIRNAME/watched/packages/default/hello2/index.js
  wait_for "Resuming watch"
 
	# Add an .include file (third build)
	sleep 1
	echo "index.js" > $BATS_TEST_DIRNAME/watched/packages/default/hello2/.include
  wait_for "Resuming watch"

	run diff $BATS_TEST_DIRNAME/watcher.output $BATS_TEST_DIRNAME/expected-watcher.output
	assert_success
}

@test "watch for project changes that do not trigger a build" {
	sleep 1
	STAT_BEFORE=$(stat $BATS_TEST_DIRNAME/watcher.output)
	# Make a directory, which should not trigger another build
	mkdir $BATS_TEST_DIRNAME/watched/packages/default/another
	sleep 1

	# Make a .git directory, which should not trigger a build
	mkdir $BATS_TEST_DIRNAME/watched/.git
	sleep 1

	# TODO: Fails!
	# Add a file to the .git directory, which should not trigger a build
	#touch $BATS_TEST_DIRNAME/watched/.git/somefile
	#sleep 1

	STAT_AFTER=$(stat $BATS_TEST_DIRNAME/watcher.output)
	assert_equal "$STAT_BEFORE" "$STAT_AFTER"
}
