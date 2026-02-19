import json

try:
    with open('/home/clindbeck9/infinity-data/data/panoceania.json', 'r') as f:
        data = json.load(f)
        
    # Find all extras with type DISTANCE
    if 'filters' in data and 'extras' in data['filters']:
        extras = data['filters']['extras']
        
        print("All DISTANCE type extras:")
        distance_extras = [e for e in extras if e.get('type') == 'DISTANCE']
        for e in distance_extras:
            print(f"  ID {e['id']}: {e['name']}")
            
        print("\nNow let's look at how move is stored in profiles:")
        # Find a unit with move as an array
        for unit in data['units'][:5]:
            for pg in unit.get('profileGroups', []):
                for profile in pg.get('profiles', []):
                    move = profile.get('move')
                    print(f"Unit: {unit['name']}, Move: {move}")
                    break
                break
                    
except Exception as e:
    print(f"Error: {e}")
