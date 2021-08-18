# PURPOSE:
# I will test the following commands: web create, get, list, update, delete, and clean.
load ../test_setup.bash

# constants
FILES=$BATS_TEST_DIRNAME/test_files/*


# Ensure no previous test files are left over
setup_file() {
  $NIM web clean --force
}

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
  file_list="404.html"$'\n'"test1.html"$'\n'"test2.html"

  run $NIM web list
  assert_success
  run diff <(echo $output) <(echo $file_list)
  assert_success
}

@test "web update" { # web update test
  for f in $FILES
  do
    filename=$(basename $f)
    updated_file=$BATS_TEST_DIRNAME/updated_files/$filename

    run $NIM web update -d "$filename" $updated_file
    assert_success
    assert_output --partial "done"

    run $NIM web get -p $filename
    assert_success
    assert_output --partial "$(cat $updated_file)" # checking if file content is correct
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
