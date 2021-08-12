# PURPOSE:
# I will test the following commands: object create, get, list, update, url, delete, and clean.
load ../test_setup.bash

# constants
FILES=$BATS_TEST_DIRNAME/test_files/*

@test "object create" { # object create test
  for f in $FILES
  do
    run $NIM object create "$f"
    assert_success
    assert_output --partial "done"
  done
}

@test "object get" { # object get test
  for f in $FILES
  do
    filename=$(basename $f)
    run $NIM object get -p $filename
    assert_success
    assert_output --partial "done" 
    assert_output --partial "getting $filename" 
    # check file contents is correct
    assert_output --partial "$(cat $f)" 
  done
}

@test "object list" { # object list test
  path=$BATS_TEST_DIRNAME/test_files
  list=$(ls $path)

  run $NIM object list
  assert_success
  assert [ "$output" == "$list" ]
}

@test "object url" { # object url test
  for f in $FILES
  do
    filename=$(basename $f)
    run $NIM object url $filename
    assert_success
    run diff $f <(curl -s $output)
    assert_success
  done
}

@test "object update" { # object update test
  for f in $FILES
  do
    run $NIM object update "$f"
    assert_success
    assert_output --partial "done"
  done
}

@test "object delete" { # object delete test
  for f in $FILES
  do
    run $NIM object delete "$(basename $f)"
    assert_success
    assert_output --partial "done"
  done
}

@test "object clean" { # object clean test
  run $NIM object clean --force
  assert_success
  assert_output --partial "done"

  run $NIM object list
  assert_success
  assert_output ""
}
