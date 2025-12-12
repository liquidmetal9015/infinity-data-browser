
import json

try:
    with open('/home/clindbeck9/infinity-data/data/panoceania.json', 'r') as f:
        data = json.load(f)
        
    print("Root keys:", list(data.keys()))
    
    if 'filters' in data:
        print("Filters keys:", list(data['filters'].keys()))
        if 'extras' in data['filters']:
            print("Found extras!")
            extras = data['filters']['extras']
            # Print first 20 extras
            for e in extras[:20]:
                print(e)
            
            # Look for values that look like distances (e.g. 5, 10, 15)
            print("\nExtras with values 5, 10, 15:")
            for e in extras:
                if e.get('name') in ['+5', '+10', '+15', '+5cm', '+10cm', '-5', '-10']:
                    print(e)
                    
except Exception as e:
    print(f"Error: {e}")
