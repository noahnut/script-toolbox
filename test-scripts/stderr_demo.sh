#!/bin/bash
# Tests that stdout (white) and stderr (red) appear in the right colors.
echo "This goes to stdout (normal)"
echo "This also goes to stdout"
echo "This goes to stderr (error color)" >&2
echo "Back on stdout"
echo "Another stderr line" >&2
exit 1
