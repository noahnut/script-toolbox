#!/bin/bash
echo "=== System Info ==="
echo "Hostname:  $(hostname)"
echo "OS:        $(uname -srm)"
echo "Uptime:   $(uptime | sed 's/.*up //' | sed 's/,.*//')"
echo ""
echo "=== CPU ==="
sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "N/A"
echo ""
echo "=== Memory ==="
vm_stat | awk '/Pages free/{free=$3} /Pages active/{active=$3} END{
  printf "Free:   %.0f MB\nActive: %.0f MB\n", free*4096/1048576, active*4096/1048576
}'
echo ""
echo "=== Disk ==="
df -h / | tail -1 | awk '{print "Used: "$3" / "$2" ("$5" full)"}'
