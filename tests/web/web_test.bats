# PURPOSE:
# I will test the following commands: web create, get, list, update, delete, and clean.
load ../test_setup.bash

# constants
FILES=$BATS_TEST_DIRNAME/test_files/*

@test "web create" { # web create test
  for f in $FILES
  do
    run $NIM web create "$f"
    assert_success
    assert_output --partial "done"
  done
}

@test "web get" { # web get test
  for f in $FILES
  do
    filename=$(basename $f)
    run $NIM web get -p $filename
    assert_success
    assert_output --partial "done"
    assert_output --partial "getting $filename"
    assert_output --partial "$(cat $f)" # checking if file content is correct
  done
}

@test "web list" { # web list test, 404.html is default in namespaces
  listString1="404.html"$'\n'"test1.html"
  listString2="test1.html"$'\n'"404.html"

  run $NIM web list
  assert_success
  if [ "$listString1" == "$output" ]; then
    assert true
  elif [ "$listString2" == "$output" ]; then
    assert true
  else
    echo "$output"
    assert false
  fi
}

@test "web update" { # web update test
  for f in $FILES
  do
    run $NIM web create $BATS_TEST_DIRNAME/updated_files/test1.html
    assert_success
    assert_output --partial "done"

    run $NIM web update "$f" -d $BATS_TEST_DIRNAME/updated_files/test1.html
    assert_success
    assert_output --partial "done"
  done
}

@test "web delete" { # web delete test
  for f in $FILES
  do
    run $NIM web delete "$(basename $f)"
    assert_success
    assert_output --partial "done"

    filename=$(basename $f)
    run $NIM web get -p $filename
    assert_success
    assert_output --partial "couldn't print content"
  done
}

@test "web clean" { # web clean test
  run $NIM web clean --force
  assert_success
  assert_output --partial "done"

  run $NIM web list
  assert_success
  assert_output "404.html" # 404.html is default in namespaces
}