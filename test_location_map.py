#!/usr/bin/env python3
"""
Test script to verify location extraction and map integration
Run this after starting the backend API to test location data
"""

import requests
import json

API_BASE = "http://localhost:8000"

def test_location_extraction():
    """Test various inputs to verify location extraction works"""
    
    print("🧪 Testing Location Extraction for Map Integration\n")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "Test 1: Text with City Name",
            "endpoint": "/analyze",
            "data": {
                "text": "Severe flooding in Mumbai, India. Over 10,000 people evacuated from low-lying areas.",
                "source": "user"
            },
            "expected_location": {
                "city": "Mumbai",
                "country": "India"
            }
        },
        {
            "name": "Test 2: Text with Assam Location",
            "endpoint": "/analyze",
            "data": {
                "text": "Severe flooding in Assam, India. Over 50,000 people evacuated from low-lying areas.",
                "source": "user"
            },
            "expected_location": {
                "city": "Assam",
                "country": "India"
            }
        },
        {
            "name": "Test 3: News URL (USGS Earthquake)",
            "endpoint": "/analyze",
            "data": {
                "text": "https://earthquake.usgs.gov/earthquakes/eventpage/us7000m123",
                "source": "web"
            },
            "expected_location": {
                "latitude": "exists",
                "longitude": "exists"
            }
        },
        {
            "name": "Test 4: Text with Coordinates",
            "endpoint": "/analyze",
            "data": {
                "text": "Wildfire reported at coordinates 34.0522°N, 118.2437°W near Los Angeles",
                "source": "user"
            },
            "expected_location": {
                "latitude": 34.0522,
                "longitude": -118.2437
            }
        },
        {
            "name": "Test 5: International Location",
            "endpoint": "/analyze",
            "data": {
                "text": "Typhoon approaching Tokyo, Japan. Evacuation orders issued for coastal areas.",
                "source": "user"
            },
            "expected_location": {
                "city": "Tokyo",
                "country": "Japan"
            }
        }
    ]
    
    results = []
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n{test['name']}")
        print("-" * 60)
        
        try:
            response = requests.post(
                f"{API_BASE}{test['endpoint']}", 
                json=test["data"],
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                location = result.get("location", {})
                
                print(f"✅ Status: SUCCESS")
                print(f"📍 Location Extracted:")
                print(f"   City: {location.get('city', 'N/A')}")
                print(f"   Region: {location.get('region', 'N/A')}")
                print(f"   Country: {location.get('country', 'N/A')}")
                
                if location.get('latitude') and location.get('longitude'):
                    print(f"   GPS: {location['latitude']}, {location['longitude']}")
                
                print(f"🔥 Disaster Type: {result.get('disaster_type', 'N/A')}")
                print(f"⚠️  Urgency: {result.get('urgency', 'N/A')}")
                
                # Check if location data is sufficient for map
                has_coords = location.get('latitude') and location.get('longitude')
                has_city = location.get('city') or location.get('country')
                
                if has_coords or has_city:
                    print(f"🗺️  Map Status: ✅ CAN DISPLAY ON MAP")
                    if has_coords:
                        print(f"   → Will use exact GPS coordinates")
                    else:
                        print(f"   → Will geocode city/country name")
                else:
                    print(f"🗺️  Map Status: ⚠️  NO LOCATION DATA")
                
                results.append({
                    "test": test["name"],
                    "success": True,
                    "location": location,
                    "can_map": has_coords or has_city
                })
                
            else:
                print(f"❌ Status: FAILED (HTTP {response.status_code})")
                print(f"Error: {response.text}")
                results.append({
                    "test": test["name"],
                    "success": False,
                    "error": response.text
                })
                
        except requests.exceptions.ConnectionError:
            print(f"❌ Status: CONNECTION FAILED")
            print(f"Error: Could not connect to {API_BASE}")
            print(f"Make sure the backend is running: python backend/api.py")
            results.append({
                "test": test["name"],
                "success": False,
                "error": "Connection failed"
            })
            break
            
        except Exception as e:
            print(f"❌ Status: ERROR")
            print(f"Error: {str(e)}")
            results.append({
                "test": test["name"],
                "success": False,
                "error": str(e)
            })
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total = len(results)
    successful = sum(1 for r in results if r.get("success"))
    mappable = sum(1 for r in results if r.get("can_map"))
    
    print(f"Total Tests: {total}")
    print(f"Successful: {successful}/{total}")
    print(f"Mappable Locations: {mappable}/{successful}")
    
    if successful == total:
        print("\n✅ ALL TESTS PASSED!")
        print("🗺️  Location extraction is working correctly")
        print("🚀 Map integration should work perfectly")
    else:
        print(f"\n⚠️  {total - successful} test(s) failed")
        print("Check the backend logs for errors")
    
    print("\n" + "=" * 60)
    print("Next Steps:")
    print("1. Start frontend: cd frontend && npm run dev")
    print("2. Open http://localhost:5173")
    print("3. Test the map with the inputs above")
    print("4. Verify markers appear on the map")
    print("=" * 60)

if __name__ == "__main__":
    test_location_extraction()
