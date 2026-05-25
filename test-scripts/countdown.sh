#!/bin/bash
# Tests live output streaming — each line appears one second apart.
echo "Starting countdown..."
for i in 5 4 3 2 1; do
  echo "  $i..."
  sleep 1
done
echo "Done!"
