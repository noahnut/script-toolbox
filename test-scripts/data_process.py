# @description Process a list of numbers and print statistics
# @param COUNT default:10 "How many random numbers to generate"
# @param SEED optional "Random seed for reproducibility"
# @param FORMAT default:table "Output format (table|json)"

import os, random, json

count = int(os.environ.get('COUNT', 10))
seed  = os.environ.get('SEED')
fmt   = os.environ.get('FORMAT', 'table')

if seed:
    random.seed(int(seed))

numbers = [random.randint(1, 100) for _ in range(count)]
stats = {
    'count': len(numbers),
    'min':   min(numbers),
    'max':   max(numbers),
    'sum':   sum(numbers),
    'mean':  round(sum(numbers) / len(numbers), 2),
}

if fmt == 'json':
    print(json.dumps({'numbers': numbers, 'stats': stats}, indent=2))
else:
    print(f"Numbers: {numbers}")
    print()
    for k, v in stats.items():
        print(f"  {k:<8} {v}")
